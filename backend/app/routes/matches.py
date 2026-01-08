from datetime import datetime
import copy

from flask import Blueprint, request

from ..auth import is_admin, require_user
from ..config import Config
from ..db import get_db
from ..models import (
    Context,
    Event,
    Feedback,
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
)
from ..routes.feedback import log_interaction_diffs
from ..services.match import build_feedback, build_team_model_match, ensure_active_segment, finish_segment
from ..services.model_state import load_state, save_state
from ..utils import err, ok
from team_model.team_model import ModelState as TeamModelState
from team_model.team_model import update_from_match_with_breakdown
from team_model.team_model import Config as TeamConfig
from team_model.team_model.teamgen import evaluate_split, generate_teams

bp = Blueprint("matches", __name__, url_prefix="/matches")

_VENUE_MAP = {"зал1": "Эксперт", "зал2": "Маракана"}


def _display_venue(venue: str | None) -> str | None:
    if not venue:
        return venue
    return _VENUE_MAP.get(venue, venue)


def _normalize_venue(venue: str | None) -> str | None:
    if not venue:
        return venue
    reverse = {v: k for k, v in _VENUE_MAP.items()}
    return reverse.get(venue, venue)


def _require_member(db, match_id: int, tg_id: int) -> MatchMember | None:
    return db.query(MatchMember).filter_by(match_id=match_id, tg_id=tg_id).one_or_none()


def _require_admin_or_organizer(db, match: Match, user) -> bool:
    if is_admin(user):
        return True
    member = _require_member(db, match.id, user.tg_id)
    return member is not None and member.role == "organizer"


def _can_edit(db, match_id: int, user_id: int) -> bool:
    member = db.query(MatchMember).filter_by(match_id=match_id, tg_id=user_id).one_or_none()
    return member is not None and (member.can_edit or member.role == "organizer")


def _why_text(base_eval: dict, alt_eval: dict) -> str:
    reasons = []
    if abs(alt_eval["d_hat"]) > abs(base_eval["d_hat"]):
        reasons.append("больший разрыв рейтинга")
    if alt_eval["components"]["syn"] > base_eval["components"]["syn"]:
        reasons.append("больше стакинга синергии")
    if alt_eval["components"]["dom"] > base_eval["components"]["dom"]:
        reasons.append("больше доминирования")
    if alt_eval["components"]["role"] > base_eval["components"]["role"]:
        reasons.append("хуже баланс ролей")
    if alt_eval["components"]["top"] > base_eval["components"]["top"]:
        reasons.append("слишком сильные игроки в одной команде")
    return ", ".join(reasons) or "слегка хуже по общему балансу"


@bp.get("")
def list_matches():
    user = require_user()
    context_id = request.args.get("context_id", type=int)
    db = get_db()
    query = db.query(Match)
    if context_id:
        query = query.filter_by(context_id=context_id)
    matches = query.order_by(Match.created_at.desc()).all()
    response_matches = []
    for m in matches:
        members = (
            db.query(MatchMember, User)
            .join(User, MatchMember.tg_id == User.tg_id)
            .filter(MatchMember.match_id == m.id, MatchMember.role.in_(["player", "organizer"]))
            .order_by(MatchMember.joined_at.asc())
            .all()
        )
        member_map = {
            member.tg_id: {
                "tg_id": member.tg_id,
                "name": user_row.custom_name or user_row.tg_name,
                "avatar": user_row.custom_avatar or user_row.tg_avatar,
            }
            for member, user_row in members
        }

        current = db.query(TeamCurrent).filter_by(match_id=m.id).one_or_none()
        if current:
            teams = current.current_teams_json
        else:
            recommended = (
                db.query(TeamVariant)
                .filter_by(match_id=m.id, is_recommended=True)
                .order_by(TeamVariant.variant_no.asc())
                .first()
            )
            teams = recommended.teams_json if recommended else {"A": [], "B": []}

        team_a_ids = [int(tg_id) for tg_id in teams.get("A", []) if str(tg_id).isdigit()]
        team_b_ids = [int(tg_id) for tg_id in teams.get("B", []) if str(tg_id).isdigit()]

        segments = (
            db.query(Segment)
            .filter_by(match_id=m.id)
            .order_by(Segment.seg_no.asc())
            .all()
        )
        final_segment = next((seg for seg in reversed(segments) if seg.ended_at), segments[-1] if segments else None)
        score_a = final_segment.score_a if final_segment else 0
        score_b = final_segment.score_b if final_segment else 0

        response_matches.append(
            {
                "id": m.id,
                "context_id": m.context_id,
                "created_by": m.created_by,
                "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None,
                    "venue": _display_venue(m.venue),
                "status": m.status,
                "created_at": m.created_at.isoformat(),
                "finished_at": m.finished_at.isoformat() if m.finished_at else None,
                "score_a": score_a,
                "score_b": score_b,
                "team_a_members": [member_map[tg_id] for tg_id in team_a_ids if tg_id in member_map],
                "team_b_members": [member_map[tg_id] for tg_id in team_b_ids if tg_id in member_map],
            }
        )

    return ok({"matches": response_matches})


@bp.post("")
def create_match():
    user = require_user()
    data = request.get_json(silent=True) or {}
    context_id = data.get("context_id") or Config.DEFAULT_CONTEXT_ID
    venue = data.get("venue")
    venue = _normalize_venue(venue)
    if not context_id or not venue:
        return err("missing_context_or_venue", 400)
    db = get_db()
    context = db.query(Context).filter_by(id=context_id).one_or_none()
    if context is None:
        context = Context(id=context_id, title=Config.DEFAULT_CONTEXT_TITLE)
        db.add(context)
        db.commit()
    scheduled_at = None
    if data.get("scheduled_at"):
        scheduled_at = datetime.fromisoformat(data["scheduled_at"])
    match = Match(
        context_id=context_id,
        created_by=user.tg_id,
        scheduled_at=scheduled_at,
        venue=venue,
        status="created",
    )
    db.add(match)
    db.flush()
    db.add(
        MatchMember(
            match_id=match.id,
            tg_id=user.tg_id,
            role="organizer",
            can_edit=True,
        )
    )
    db.commit()
    return ok({"id": match.id})


@bp.post("/<int:match_id>/join")
def join_match(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    member = _require_member(db, match_id, user.tg_id)
    if member is None:
        member = MatchMember(match_id=match_id, tg_id=user.tg_id, role="player", can_edit=False)
        db.add(member)
    db.commit()
    return ok()


@bp.post("/<int:match_id>/spectate")
def spectate_match(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    member = _require_member(db, match_id, user.tg_id)
    if member is None:
        member = MatchMember(match_id=match_id, tg_id=user.tg_id, role="spectator", can_edit=False)
        db.add(member)
    db.commit()
    return ok()


@bp.post("/<int:match_id>/start")
def start_match(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not _require_admin_or_organizer(db, match, user):
        return err("forbidden", 403)
    match.status = "live"
    if db.query(Segment).filter_by(match_id=match_id).count() == 0:
        db.add(Segment(match_id=match_id, seg_no=1, score_a=0, score_b=0))
    db.commit()
    return ok()


@bp.post("/<int:match_id>/finish")
def finish_match(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not _require_admin_or_organizer(db, match, user):
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    finish_segment(db, match_id, is_butt_game=bool(data.get("is_butt_game", False)))
    match.status = "finished"
    match.finished_at = datetime.utcnow()

    state = load_state(db, match.context_id)
    prev_state = TeamModelState.empty(TeamConfig())
    prev_state.interactions = copy.deepcopy(state.interactions)
    team_match = build_team_model_match(db, match_id)
    venue = team_match.venue
    pre_global = {name: player.global_rating for name, player in state.players.items()}
    pre_venue = {
        name: player.venue_ratings.get(venue, state.config.venue_start_rating)
        for name, player in state.players.items()
    }
    quick_feedback, expanded_feedback = build_feedback(db, match_id)
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
    save_state(db, match.context_id, state)
    log_interaction_diffs(
        db,
        match.context_id,
        prev_state,
        state,
        match_id=match.id,
        source="match",
    )
    db.commit()
    return ok()


@bp.post("/<int:match_id>/segments/new")
def new_segment(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    member = _require_member(db, match_id, user.tg_id)
    if not (is_admin(user) or (member and member.role in ("player", "organizer")) or _can_edit(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    finish_segment(db, match_id, is_butt_game=bool(data.get("is_butt_game", False)))
    segment = ensure_active_segment(db, match_id)
    return ok({"segment_id": segment.id, "seg_no": segment.seg_no})


@bp.delete("/<int:match_id>/segments/<int:segment_id>")
def delete_segment(match_id: int, segment_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    member = _require_member(db, match_id, user.tg_id)
    if not (is_admin(user) or (member and member.role in ("player", "organizer")) or _can_edit(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    segment = db.query(Segment).filter_by(id=segment_id, match_id=match_id).one_or_none()
    if segment is None:
        return err("segment_not_found", 404)
    if segment.ended_at is None:
        return err("segment_not_finished", 400)
    db.query(Event).filter_by(segment_id=segment_id, match_id=match_id).delete()
    db.delete(segment)
    db.commit()
    return ok()


@bp.patch("/<int:match_id>/members/<int:tg_id>/permissions")
def patch_member_permissions(match_id: int, tg_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not _require_admin_or_organizer(db, match, user):
        return err("forbidden", 403)
    member = _require_member(db, match_id, tg_id)
    if member is None:
        return err("member_not_found", 404)
    data = request.get_json(silent=True) or {}
    if "can_edit" not in data:
        return err("missing_can_edit", 400)
    member.can_edit = bool(data["can_edit"])
    db.commit()
    return ok()

@bp.post("/<int:match_id>/leave")
def leave_match(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    member = _require_member(db, match_id, user.tg_id)
    if member is None:
        return err("not_a_member", 400)
    if member.role == "organizer":
        return err("organizer_cannot_leave", 400)
    db.delete(member)
    db.commit()
    return ok()


@bp.post("/<int:match_id>/repeat")
def repeat_match(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if match.status != "finished":
        return err("match_not_finished", 400)
    if not _require_admin_or_organizer(db, match, user):
        return err("forbidden", 403)

    members = (
        db.query(MatchMember)
        .filter(MatchMember.match_id == match_id, MatchMember.role.in_(["player", "organizer"]))
        .all()
    )
    participant_ids = {m.tg_id for m in members}
    if not participant_ids:
        return err("no_participants", 400)

    try:
        new_match = Match(
            context_id=match.context_id,
            created_by=user.tg_id,
            scheduled_at=None,
            venue=match.venue,
            status="created",
        )
        db.add(new_match)
        db.flush()

        db.add(
            MatchMember(
                match_id=new_match.id,
                tg_id=user.tg_id,
                role="organizer",
                can_edit=True,
            )
        )
        for tg_id in participant_ids:
            if tg_id == user.tg_id:
                continue
            db.add(
                MatchMember(
                    match_id=new_match.id,
                    tg_id=tg_id,
                    role="player",
                    can_edit=False,
                )
            )

        state = load_state(db, new_match.context_id)
        participants = [str(tg_id) for tg_id in participant_ids]
        for name in participants:
            state.ensure_player(name, new_match.venue, state.config.global_start_rating, False)
        save_state(db, new_match.context_id, state)

        variants = generate_teams(state, participants, new_match.venue, top_n=3)
        base_eval = evaluate_split(state, variants[0]["team_a"], variants[0]["team_b"], new_match.venue)
        for idx, variant in enumerate(variants, start=1):
            eval_split = evaluate_split(state, variant["team_a"], variant["team_b"], new_match.venue)
            why = None if idx == 1 else _why_text(base_eval, eval_split)
            db.add(
                TeamVariant(
                    match_id=new_match.id,
                    variant_no=idx,
                    is_recommended=idx == 1,
                    teams_json={"A": variant["team_a"], "B": variant["team_b"]},
                    why_text=why,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return ok({"id": new_match.id})


@bp.get("/<int:match_id>")
def get_match(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)

    members = (
        db.query(MatchMember, User)
        .join(User, MatchMember.tg_id == User.tg_id)
        .filter(MatchMember.match_id == match_id)
        .order_by(MatchMember.joined_at.asc())
        .all()
    )
    segments = (
        db.query(Segment)
        .filter_by(match_id=match_id)
        .order_by(Segment.seg_no.asc())
        .all()
    )
    events = (
        db.query(Event)
        .filter_by(match_id=match_id, is_deleted=False)
        .order_by(Event.created_at.asc())
        .all()
    )
    variants = (
        db.query(TeamVariant)
        .filter_by(match_id=match_id)
        .order_by(TeamVariant.variant_no.asc())
        .all()
    )
    team_current = db.query(TeamCurrent).filter_by(match_id=match_id).one_or_none()
    payer_info = db.query(PaymentInfo).filter_by(match_id=match_id).one_or_none()
    payer_requests = db.query(PaymentRequest).filter_by(match_id=match_id).all()
    payment_statuses = db.query(PaymentStatus).filter_by(match_id=match_id).all()
    mvp_votes = (
        db.query(Feedback.mvp_vote_tg_id)
        .filter(Feedback.match_id == match_id, Feedback.mvp_vote_tg_id.is_not(None))
        .all()
    )
    vote_counts = {}
    for (tg_id,) in mvp_votes:
        vote_counts[tg_id] = vote_counts.get(tg_id, 0) + 1
    top_mvp = None
    if vote_counts:
        top_mvp = max(vote_counts.items(), key=lambda item: item[1])[0]

    return ok(
        {
            "match": {
                "id": match.id,
                "context_id": match.context_id,
                "created_by": match.created_by,
                "scheduled_at": match.scheduled_at.isoformat() if match.scheduled_at else None,
                "venue": _display_venue(match.venue),
                "status": match.status,
                "created_at": match.created_at.isoformat(),
                "finished_at": match.finished_at.isoformat() if match.finished_at else None,
            },
            "members": [
                {
                    "tg_id": member.tg_id,
                    "role": member.role,
                    "can_edit": member.can_edit,
                    "joined_at": member.joined_at.isoformat(),
                    "name": user_row.custom_name or user_row.tg_name,
                    "avatar": user_row.custom_avatar or user_row.tg_avatar,
                }
                for member, user_row in members
            ],
            "segments": [
                {
                    "id": segment.id,
                    "seg_no": segment.seg_no,
                    "ended_at": segment.ended_at.isoformat() if segment.ended_at else None,
                    "score_a": segment.score_a,
                    "score_b": segment.score_b,
                    "is_butt_game": bool(segment.is_butt_game),
                }
                for segment in segments
            ],
            "events": [
                {
                    "id": event.id,
                    "segment_id": event.segment_id,
                    "event_type": event.event_type,
                    "team": event.team,
                    "scorer_tg_id": event.scorer_tg_id,
                    "assist_tg_id": event.assist_tg_id,
                    "created_by_tg_id": event.created_by_tg_id,
                    "created_at": event.created_at.isoformat(),
                    "updated_at": event.updated_at.isoformat(),
                }
                for event in events
            ],
            "team_variants": [
                {
                    "variant_no": variant.variant_no,
                    "is_recommended": variant.is_recommended,
                    "teams": variant.teams_json,
                    "why_text": variant.why_text,
                }
                for variant in variants
            ],
            "team_current": (
                {
                    "base_variant_no": team_current.base_variant_no,
                    "current_teams": team_current.current_teams_json,
                    "is_custom": team_current.is_custom,
                    "why_now_worse_text": team_current.why_now_worse_text,
                }
                if team_current
                else None
            ),
            "payments": {
                "payer": (
                    {
                        "payer_tg_id": payer_info.payer_tg_id,
                        "payer_phone": payer_info.payer_phone,
                        "payer_fio": payer_info.payer_fio,
                        "payer_bank": payer_info.payer_bank,
                        "status": payer_info.status,
                    }
                    if payer_info
                    else None
                ),
                "requests": [{"tg_id": req.tg_id, "status": req.status} for req in payer_requests],
                "statuses": [{"tg_id": st.tg_id, "status": st.status} for st in payment_statuses],
            },
            "mvp": {
                "top_tg_id": top_mvp,
                "votes": vote_counts,
            },
            "me": {"tg_id": user.tg_id, "is_admin": is_admin(user)},
        }
    )
