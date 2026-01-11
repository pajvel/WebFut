from __future__ import annotations

from datetime import datetime
import copy

from flask import Blueprint, request

from ..auth import is_admin, require_user
from ..db import get_db
from ..models import (
    Context,
    Event,
    Feedback,
    InteractionLog,
    Match,
    MatchMember,
    PaymentInfo,
    PaymentRequest,
    PaymentStatus,
    RatingLog,
    Segment,
    TeamCurrent,
    TeamVariant,
    User,
    UserSettings,
)
from ..routes.feedback import log_interaction_diffs
from ..services.match import build_feedback, build_team_model_match
from ..services.model_state import load_state, save_state
from ..utils import err, ok
from team_model.team_model import Config as TeamConfig
from team_model.team_model import ModelState as TeamModelState
from team_model.team_model import update_from_match_with_breakdown

bp = Blueprint("admin", __name__, url_prefix="/admin")

_VENUE_ALIASES = {
    "Эксперт": ["Эксперт", "зал1", "Зал 1", "зал 1"],
    "Маракана": ["Маракана", "зал2", "Зал 2", "зал 2"],
}


def _venue_keys(venue: str) -> list[str]:
    return _VENUE_ALIASES.get(venue, [venue])


def _require_admin():
    user = require_user()
    if not is_admin(user):
        return None
    return user


def _rebind_player(state: TeamModelState, source_id: str, target_id: str) -> None:
    if source_id == target_id:
        return
    source = state.players.get(source_id)
    if source is None:
        return
    target = state.ensure_player(target_id, "Эксперт", source.global_rating, source.is_guest)
    target.global_rating = source.global_rating
    target.venue_ratings = dict(source.venue_ratings)
    target.is_guest = source.is_guest
    target.guest_matches = source.guest_matches
    target.tier_bonus = source.tier_bonus
    if source_id in state.tier_bonus:
        state.tier_bonus[target_id] = state.tier_bonus[source_id]
        del state.tier_bonus[source_id]

    for venue, pairs in state.interactions.synergy.items():
        updated = {}
        for pair, value in pairs.items():
            players = [target_id if name == source_id else name for name in pair]
            if players[0] == players[1]:
                continue
            key = frozenset(players)
            updated[key] = updated.get(key, 0.0) + value
        state.interactions.synergy[venue] = updated

    for venue, pairs in state.interactions.domination.items():
        updated = {}
        for (dominator, dominated), value in pairs.items():
            new_dom = target_id if dominator == source_id else dominator
            new_victim = target_id if dominated == source_id else dominated
            if new_dom == new_victim:
                continue
            key = (new_dom, new_victim)
            updated[key] = updated.get(key, 0.0) + value
        state.interactions.domination[venue] = updated

    if source_id in state.players:
        del state.players[source_id]


def _replace_id(value, source_id: str, target_id: str, source_tg: int, target_tg: int):
    if isinstance(value, dict):
        return {key: _replace_id(val, source_id, target_id, source_tg, target_tg) for key, val in value.items()}
    if isinstance(value, list):
        return [_replace_id(val, source_id, target_id, source_tg, target_tg) for val in value]
    if isinstance(value, (int, str)):
        if str(value) == source_id or value == source_tg:
            return target_tg if isinstance(value, int) else target_id
    return value


def _rebind_members(db, source_tg: int, target_tg: int) -> None:
    rows = db.query(MatchMember).filter_by(tg_id=source_tg).all()
    for row in rows:
        exists = (
            db.query(MatchMember)
            .filter_by(match_id=row.match_id, tg_id=target_tg)
            .one_or_none()
        )
        if exists:
            db.delete(row)
        else:
            row.tg_id = target_tg


def _rebind_feedback(db, source_tg: int, target_tg: int, source_id: str, target_id: str) -> None:
    rows = db.query(Feedback).filter_by(tg_id=source_tg).all()
    for row in rows:
        exists = (
            db.query(Feedback)
            .filter_by(match_id=row.match_id, tg_id=target_tg)
            .one_or_none()
        )
        if exists:
            db.delete(row)
            continue
        row.tg_id = target_tg
        row.answers_json = _replace_id(row.answers_json, source_id, target_id, source_tg, target_tg)
        if row.mvp_vote_tg_id == source_tg:
            row.mvp_vote_tg_id = target_tg

    mvp_rows = db.query(Feedback).filter_by(mvp_vote_tg_id=source_tg).all()
    for row in mvp_rows:
        row.mvp_vote_tg_id = target_tg


def _rebind_payments(db, source_tg: int, target_tg: int) -> None:
    payer_rows = db.query(PaymentInfo).filter_by(payer_tg_id=source_tg).all()
    for row in payer_rows:
        row.payer_tg_id = target_tg

    req_rows = db.query(PaymentRequest).filter_by(tg_id=source_tg).all()
    for row in req_rows:
        exists = (
            db.query(PaymentRequest)
            .filter_by(match_id=row.match_id, tg_id=target_tg)
            .one_or_none()
        )
        if exists:
            db.delete(row)
        else:
            row.tg_id = target_tg

    status_rows = db.query(PaymentStatus).filter_by(tg_id=source_tg).all()
    for row in status_rows:
        exists = (
            db.query(PaymentStatus)
            .filter_by(match_id=row.match_id, tg_id=target_tg)
            .one_or_none()
        )
        if exists:
            db.delete(row)
        else:
            row.tg_id = target_tg


def _rebind_events(db, source_tg: int, target_tg: int) -> None:
    rows = (
        db.query(Event)
        .filter(
            (Event.scorer_tg_id == source_tg)
            | (Event.assist_tg_id == source_tg)
            | (Event.created_by_tg_id == source_tg)
        )
        .all()
    )
    for row in rows:
        if row.scorer_tg_id == source_tg:
            row.scorer_tg_id = target_tg
        if row.assist_tg_id == source_tg:
            row.assist_tg_id = target_tg
        if row.created_by_tg_id == source_tg:
            row.created_by_tg_id = target_tg


def _rebind_match_owner(db, source_tg: int, target_tg: int) -> None:
    rows = db.query(Match).filter_by(created_by=source_tg).all()
    for row in rows:
        row.created_by = target_tg


def _rebind_team_json(db, source_id: str, target_id: str) -> None:
    for row in db.query(TeamCurrent).all():
        teams = row.current_teams_json or {}
        updated = _replace_id(teams, source_id, target_id, int(source_id), int(target_id))
        row.current_teams_json = updated
    for row in db.query(TeamVariant).all():
        teams = row.teams_json or {}
        updated = _replace_id(teams, source_id, target_id, int(source_id), int(target_id))
        row.teams_json = updated


def _rebind_rating_logs(db, source_id: str, target_id: str) -> None:
    rows = db.query(RatingLog).filter_by(player_id=source_id).all()
    for row in rows:
        row.player_id = target_id


def _rebind_interaction_logs(db, source_id: str, target_id: str) -> None:
    rows = (
        db.query(InteractionLog)
        .filter((InteractionLog.player_a == source_id) | (InteractionLog.player_b == source_id))
        .all()
    )
    for row in rows:
        if row.player_a == source_id:
            row.player_a = target_id
        if row.player_b == source_id:
            row.player_b = target_id


def _log_match_deltas(db, match: Match, state: TeamModelState) -> None:
    team_match = build_team_model_match(db, match.id)
    venue = team_match.venue
    pre_global = {name: player.global_rating for name, player in state.players.items()}
    pre_venue = {
        name: player.venue_ratings.get(venue, state.config.venue_start_rating)
        for name, player in state.players.items()
    }
    quick_feedback, expanded_feedback = build_feedback(db, match.id)
    deltas, breakdown = update_from_match_with_breakdown(
        state, team_match, quick_feedback=quick_feedback, expanded_feedback=expanded_feedback
    )
    goals: dict[str, int] = {}
    assists: dict[str, int] = {}
    for ev in team_match.events:
        if ev.event_type == "goal":
            goals[ev.player] = goals.get(ev.player, 0) + 1
        elif ev.event_type == "assist":
            assists[ev.player] = assists.get(ev.player, 0) + 1
    for player_id, delta in deltas.items():
        player = state.players.get(player_id)
        if not player:
            continue
        post_global = player.global_rating
        post_venue = player.venue_ratings.get(venue, state.config.venue_start_rating)
        before_global = pre_global.get(player_id, post_global - delta)
        before_venue = pre_venue.get(player_id, post_venue - delta)
        db.add(
            RatingLog(
                match_id=match.id,
                player_id=player_id,
                venue=venue,
                delta=delta,
                pre_global=before_global,
                post_global=post_global,
                pre_venue=before_venue,
                post_venue=post_venue,
                goals=goals.get(player_id, 0),
                assists=assists.get(player_id, 0),
                details_json=breakdown.get(player_id),
            )
        )


@bp.get("/users")
def list_users():
    if not _require_admin():
        return err("forbidden", 403)
    db = get_db()
    users = db.query(User).order_by(User.tg_name.asc()).all()
    return ok(
        {
            "users": [
                {
                    "tg_id": u.tg_id,
                    "tg_name": u.tg_name,
                    "tg_avatar": u.tg_avatar,
                    "custom_name": u.custom_name,
                    "custom_avatar": u.custom_avatar,
                }
                for u in users
            ]
        }
    )


@bp.post("/users")
def create_user():
    if not _require_admin():
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    tg_id = data.get("tg_id")
    name = data.get("name")
    if not name:
        return err("missing_name", 400)
    db = get_db()
    if tg_id is None:
        tg_id = int(f"-{int(datetime.utcnow().timestamp())}")
    user = db.query(User).filter_by(tg_id=tg_id).one_or_none()
    if user is None:
        user = User(tg_id=tg_id, tg_name=name, tg_avatar=None)
        db.add(user)
        db.add(UserSettings(tg_id=tg_id))
    else:
        user.tg_name = name
    db.commit()
    return ok({"tg_id": user.tg_id})


@bp.patch("/users/<int:tg_id>")
def patch_user(tg_id: int):
    if not _require_admin():
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    db = get_db()
    user = db.query(User).filter_by(tg_id=tg_id).one_or_none()
    if user is None:
        return err("user_not_found", 404)
    user.custom_name = data.get("custom_name", user.custom_name)
    user.custom_avatar = data.get("custom_avatar", user.custom_avatar)
    db.commit()
    return ok()


@bp.get("/state")
def get_state():
    if not _require_admin():
        return err("forbidden", 403)
    db = get_db()
    context_id = request.args.get("context_id", type=int) or 1
    state = load_state(db, context_id)
    return ok(
        {
            "context_id": context_id,
            "players": [
                {
                    "player_id": name,
                    "global_rating": player.global_rating,
                    "venue_ratings": player.venue_ratings,
                    "role_tendencies": player.role_tendencies,
                    "is_guest": player.is_guest,
                    "guest_matches": player.guest_matches,
                    "tier_bonus": player.tier_bonus,
                }
                for name, player in state.players.items()
            ],
        }
    )


@bp.patch("/state/player")
def patch_state_player():
    if not _require_admin():
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    player_id = data.get("player_id")
    context_id = data.get("context_id", 1)
    if player_id is None:
        return err("missing_player_id", 400)
    db = get_db()
    state = load_state(db, context_id)
    player = state.ensure_player(str(player_id), "Эксперт", TeamConfig().global_start_rating, False)
    if "global_rating" in data:
        player.global_rating = float(data["global_rating"])
    if "venue_ratings" in data:
        for venue, value in (data["venue_ratings"] or {}).items():
            player.venue_ratings[venue] = float(value)
    if "is_guest" in data:
        player.is_guest = bool(data["is_guest"])
    if "guest_matches" in data:
        player.guest_matches = int(data["guest_matches"])
    if "tier_bonus" in data:
        player.tier_bonus = float(data["tier_bonus"])
        state.tier_bonus[str(player_id)] = float(data["tier_bonus"])
    save_state(db, context_id, state)
    return ok()


@bp.patch("/state/player/bind")
def bind_state_player():
    if not _require_admin():
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    source_id = data.get("player_id")
    target_id = data.get("tg_id")
    context_id = data.get("context_id", 1)
    if source_id is None or target_id is None:
        return err("missing_player_id", 400)
    source_id = str(source_id)
    target_id = str(target_id)
    try:
        source_tg = int(source_id)
        target_tg = int(target_id)
    except ValueError:
        return err("invalid_player_id", 400)
    db = get_db()
    target_user = db.query(User).filter_by(tg_id=target_tg).one_or_none()
    if target_user is None:
        target_user = User(tg_id=target_tg, tg_name=f"User {target_tg}", tg_avatar=None)
        db.add(target_user)
        db.add(UserSettings(tg_id=target_tg))
        db.commit()
    state = load_state(db, context_id)
    _rebind_player(state, str(source_id), str(target_id))
    _rebind_members(db, source_tg, target_tg)
    _rebind_feedback(db, source_tg, target_tg, source_id, target_id)
    _rebind_payments(db, source_tg, target_tg)
    _rebind_events(db, source_tg, target_tg)
    _rebind_match_owner(db, source_tg, target_tg)
    _rebind_team_json(db, source_id, target_id)
    _rebind_rating_logs(db, source_id, target_id)
    _rebind_interaction_logs(db, source_id, target_id)
    source_user = db.query(User).filter_by(tg_id=source_tg).one_or_none()
    target_user = db.query(User).filter_by(tg_id=target_tg).one_or_none()
    if source_user and target_user:
        if not target_user.custom_name and source_user.custom_name:
            target_user.custom_name = source_user.custom_name
        if not target_user.custom_avatar and source_user.custom_avatar:
            target_user.custom_avatar = source_user.custom_avatar
        db.query(UserSettings).filter_by(tg_id=source_tg).delete()
        db.delete(source_user)
    save_state(db, context_id, state)
    db.commit()
    return ok()


@bp.post("/state/rebuild")
def rebuild_state():
    if not _require_admin():
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    context_id = int(data.get("context_id", 1))
    db = get_db()
    context = db.query(Context).filter_by(id=context_id).one_or_none()
    if context is None:
        return err("context_not_found", 404)
    state = TeamModelState.empty(TeamConfig())
    matches = (
        db.query(Match)
        .filter_by(context_id=context_id, status="finished")
        .order_by(Match.created_at.asc())
        .all()
    )
    for match in matches:
        team_match = build_team_model_match(db, match.id)
        update_from_match(state, team_match)
    save_state(db, context_id, state)
    return ok({"matches": len(matches)})


@bp.post("/matches/<int:match_id>/members")
def add_match_members(match_id: int):
    if not _require_admin():
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    members = data.get("members") or []
    if not members:
        return err("missing_members", 400)
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    for member in members:
        tg_id = int(member["tg_id"])
        role = member.get("role", "player")
        can_edit = bool(member.get("can_edit", False))
        name = member.get("name")
        rating = member.get("rating")
        invited_by_tg_id = member.get("invited_by_tg_id")
        
        record = (
            db.query(MatchMember)
            .filter_by(match_id=match_id, tg_id=tg_id)
            .one_or_none()
        )
        if record is None:
            db.add(
                MatchMember(
                    match_id=match_id,
                    tg_id=tg_id,
                    role=role,
                    can_edit=can_edit,
                    name=name,
                    rating=rating,
                    invited_by_tg_id=invited_by_tg_id,
                )
            )
        else:
            record.role = role
            record.can_edit = can_edit
            record.name = name
            record.rating = rating
            record.invited_by_tg_id = invited_by_tg_id
    db.commit()
    return ok()


@bp.delete("/matches/<int:match_id>/members/<int:tg_id>")
def remove_match_member(match_id: int, tg_id: int):
    if not _require_admin():
        return err("forbidden", 403)
    db = get_db()
    member = db.query(MatchMember).filter_by(match_id=match_id, tg_id=tg_id).one_or_none()
    if member is None:
        return err("member_not_found", 404)
    db.delete(member)
    db.commit()
    return ok()


@bp.patch("/matches/<int:match_id>/segments/<int:segment_id>")
def patch_segment(match_id: int, segment_id: int):
    if not _require_admin():
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    db = get_db()
    segment = db.query(Segment).filter_by(id=segment_id, match_id=match_id).one_or_none()
    if segment is None:
        return err("segment_not_found", 404)
    if "score_a" in data:
        segment.score_a = int(data["score_a"])
    if "score_b" in data:
        segment.score_b = int(data["score_b"])
    if data.get("ended_at") == "now":
        segment.ended_at = datetime.utcnow()
    db.commit()
    return ok()


@bp.delete("/matches/<int:match_id>")
def delete_match(match_id: int):
    if not _require_admin():
        return err("forbidden", 403)
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    
    # Удаляем все связанные данные в правильном порядке
    # 1. Rating logs
    db.query(RatingLog).filter_by(match_id=match_id).delete()
    
    # 2. Interaction logs
    db.query(InteractionLog).filter_by(match_id=match_id).delete()
    
    # 3. Feedback
    db.query(Feedback).filter_by(match_id=match_id).delete()
    
    # 4. Events
    db.query(Event).filter_by(match_id=match_id).delete()
    
    # 5. Segments
    db.query(Segment).filter_by(match_id=match_id).delete()
    
    # 6. Payment requests
    db.query(PaymentRequest).filter_by(match_id=match_id).delete()
    
    # 7. Payment statuses
    db.query(PaymentStatus).filter_by(match_id=match_id).delete()
    
    # 8. Payment info
    db.query(PaymentInfo).filter_by(match_id=match_id).delete()
    
    # 9. Match members
    db.query(MatchMember).filter_by(match_id=match_id).delete()
    
    # 10. Team variants
    db.query(TeamVariant).filter_by(match_id=match_id).delete()
    
    # 11. Team current
    db.query(TeamCurrent).filter_by(match_id=match_id).delete()
    
    # 12. Сам матч
    db.delete(match)
    
    db.commit()
    return ok()


@bp.get("/rating-logs")
def rating_logs():
    if not _require_admin():
        return err("forbidden", 403)
    db = get_db()
    player_id = request.args.get("player_id")
    match_id = request.args.get("match_id", type=int)
    query = db.query(RatingLog).order_by(RatingLog.created_at.desc())
    if player_id:
        query = query.filter_by(player_id=str(player_id))
    if match_id:
        query = query.filter_by(match_id=match_id)
    logs = query.limit(200).all()
    return ok(
        {
            "logs": [
                {
                    "id": log.id,
                    "match_id": log.match_id,
                    "player_id": log.player_id,
                    "venue": log.venue,
                    "delta": log.delta,
                    "pre_global": log.pre_global,
                    "post_global": log.post_global,
                    "pre_venue": log.pre_venue,
                    "post_venue": log.post_venue,
                    "goals": log.goals,
                    "assists": log.assists,
                    "details": log.details_json,
                    "created_at": log.created_at.isoformat(),
                }
                for log in logs
            ]
        }
    )


@bp.get("/interactions")
def list_interactions():
    if not _require_admin():
        return err("forbidden", 403)
    db = get_db()
    context_id = request.args.get("context_id", type=int) or 1
    venue = request.args.get("venue") or "__global__"
    kind = request.args.get("kind") or "synergy"
    state = load_state(db, context_id)
    players = sorted(state.players.keys())
    values: list[list[float]] = []
    if kind == "synergy":
        if venue == "all":
            matrix = {}
            for _, entries in state.interactions.synergy.items():
                for key, value in entries.items():
                    matrix[key] = matrix.get(key, 0.0) + value
        else:
            matrix = {}
            for key_name in _venue_keys(venue):
                for key, value in state.interactions.synergy.get(key_name, {}).items():
                    matrix[key] = matrix.get(key, 0.0) + value
        for a in players:
            row = []
            for b in players:
                if a == b:
                    row.append(0.0)
                else:
                    row.append(matrix.get(frozenset({a, b}), 0.0))
            values.append(row)
    else:
        if venue == "all":
            matrix = {}
            for _, entries in state.interactions.domination.items():
                for key, value in entries.items():
                    matrix[key] = matrix.get(key, 0.0) + value
        else:
            matrix = {}
            for key_name in _venue_keys(venue):
                for key, value in state.interactions.domination.get(key_name, {}).items():
                    matrix[key] = matrix.get(key, 0.0) + value
        for a in players:
            row = []
            for b in players:
                if a == b:
                    row.append(0.0)
                else:
                    row.append(matrix.get((a, b), 0.0))
            values.append(row)
    return ok({"players": players, "values": values, "venue": venue, "kind": kind})


@bp.patch("/interactions")
def patch_interaction():
    if not _require_admin():
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    context_id = int(data.get("context_id", 1))
    venue = data.get("venue")
    kind = data.get("kind")
    player_a = data.get("player_a")
    player_b = data.get("player_b")
    value = data.get("value")
    if not (venue and kind and player_a and player_b):
        return err("missing_fields", 400)
    if venue == "all":
        return err("global_readonly", 400)
    db = get_db()
    state = load_state(db, context_id)
    before = 0.0
    if kind == "synergy":
        state.interactions.synergy.setdefault(venue, {})
        key = frozenset({str(player_a), str(player_b)})
        before = state.interactions.synergy[venue].get(key, 0.0)
        state.interactions.synergy[venue][key] = float(value)
    else:
        state.interactions.domination.setdefault(venue, {})
        key = (str(player_a), str(player_b))
        before = state.interactions.domination[venue].get(key, 0.0)
        state.interactions.domination[venue][key] = float(value)
    save_state(db, context_id, state)
    db.add(
        InteractionLog(
            context_id=context_id,
            venue=venue,
            kind=kind,
            player_a=str(player_a),
            player_b=str(player_b),
            value_before=before,
            value_after=float(value),
            source="manual",
        )
    )
    db.commit()
    return ok()


@bp.get("/interaction-logs")
def interaction_logs():
    if not _require_admin():
        return err("forbidden", 403)
    db = get_db()
    context_id = request.args.get("context_id", type=int) or 1
    venue = request.args.get("venue")
    kind = request.args.get("kind")
    player = request.args.get("player")
    query = db.query(InteractionLog).filter_by(context_id=context_id).order_by(InteractionLog.created_at.desc())
    if venue and venue not in ("all", "__global__"):
        venue_keys = _venue_keys(venue)
        if len(venue_keys) == 1:
            query = query.filter(InteractionLog.venue == venue_keys[0])
        else:
            query = query.filter(InteractionLog.venue.in_(venue_keys))
    if kind:
        query = query.filter_by(kind=kind)
    if player:
        query = query.filter(
            (InteractionLog.player_a == str(player)) | (InteractionLog.player_b == str(player))
        )
    logs = query.limit(200).all()
    return ok(
        {
            "logs": [
                {
                    "id": log.id,
                    "context_id": log.context_id,
                    "match_id": log.match_id,
                    "venue": log.venue,
                    "kind": log.kind,
                    "player_a": log.player_a,
                    "player_b": log.player_b,
                    "value_before": log.value_before,
                    "value_after": log.value_after,
                    "source": log.source,
                    "created_at": log.created_at.isoformat(),
                }
                for log in logs
            ]
        }
    )


@bp.post("/interaction-logs/rebuild")
def rebuild_interaction_logs():
    if not _require_admin():
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    context_id = int(data.get("context_id", 1))
    db = get_db()
    db.query(InteractionLog).filter_by(context_id=context_id).delete()
    state = TeamModelState.empty(TeamConfig())
    matches = (
        db.query(Match)
        .filter_by(context_id=context_id, status="finished")
        .order_by(Match.created_at.asc())
        .all()
    )
    for match in matches:
        team_match = build_team_model_match(db, match.id)
        quick_feedback, expanded_feedback = build_feedback(db, match.id)
        state_match = copy.deepcopy(state)
        update_from_match_with_breakdown(state_match, team_match, quick_feedback=None, expanded_feedback=None)
        log_interaction_diffs(db, context_id, state, state_match, match_id=match.id, source="match")
        if quick_feedback or expanded_feedback:
            state_feedback = copy.deepcopy(state)
            update_from_match_with_breakdown(
                state_feedback,
                team_match,
                quick_feedback=quick_feedback,
                expanded_feedback=expanded_feedback,
            )
            log_interaction_diffs(
                db,
                context_id,
                state_match,
                state_feedback,
                match_id=match.id,
                source="feedback",
            )
            state = state_feedback
        else:
            state = state_match
    db.commit()
    return ok({"matches": len(matches)})


@bp.post("/rating-logs/rebuild")
def rebuild_rating_logs():
    if not _require_admin():
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    context_id = int(data.get("context_id", 1))
    db = get_db()
    db.query(RatingLog).delete()
    state = TeamModelState.empty(TeamConfig())
    matches = (
        db.query(Match)
        .filter_by(context_id=context_id, status="finished")
        .order_by(Match.created_at.asc())
        .all()
    )
    for match in matches:
        _log_match_deltas(db, match, state)
    db.commit()
    return ok({"matches": len(matches)})
