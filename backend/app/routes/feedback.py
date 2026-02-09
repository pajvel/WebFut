from datetime import datetime, timedelta

from flask import Blueprint, request

from ..auth import require_user
from ..db import get_db
from ..models import Feedback, Match, MatchMember, RatingLog, TeamCurrent, TeamVariant, UserSettings
from ..services.interaction_log import log_interaction_diffs
from ..services.match import build_feedback, build_team_model_match
from ..services.model_state import load_state, save_state
from ..utils import err, ok
from team_model.team_model import Config as TeamConfig
from team_model.team_model import ModelState as TeamModelState
from team_model.team_model import update_from_match_with_breakdown

bp = Blueprint("feedback", __name__, url_prefix="/matches/<int:match_id>")

def _resolve_teams(db, match_id: int) -> dict:
    current = db.query(TeamCurrent).filter_by(match_id=match_id).one_or_none()
    if current:
        return current.current_teams_json or {"A": [], "B": []}
    recommended = (
        db.query(TeamVariant)
        .filter_by(match_id=match_id, is_recommended=True)
        .order_by(TeamVariant.variant_no.asc())
        .first()
    )
    return recommended.teams_json if recommended else {"A": [], "B": []}


def _pair_for_user(pool: list[str], user_id: str, base_index: int) -> list[str]:
    pool = [p for p in pool if p != user_id]
    if not pool:
        return []
    if len(pool) == 1:
        return [pool[0], pool[0]]
    a = pool[base_index % len(pool)]
    b = pool[(base_index + 1) % len(pool)]
    if a == b and len(pool) > 1:
        b = pool[(base_index + 2) % len(pool)]
    return [a, b]

def _cross_pair_for_user(team_a: list[str], team_b: list[str], user_id: str, base_index: int) -> list[str]:
    left_pool = [p for p in team_a if p != user_id]
    right_pool = [p for p in team_b if p != user_id]
    if not left_pool or not right_pool:
        return []
    left = left_pool[base_index % len(left_pool)]
    right = right_pool[(base_index + 1) % len(right_pool)]
    return [left, right]

def _generate_comparison_pairs(db, match_id: int, user_id: int) -> dict:
    teams = _resolve_teams(db, match_id)
    team_a = [str(v) for v in teams.get("A", [])]
    team_b = [str(v) for v in teams.get("B", [])]
    all_players = [p for p in team_a + team_b if p]
    if not all_players:
        members = (
            db.query(MatchMember)
            .filter_by(match_id=match_id)
            .filter(MatchMember.role != "spectator")
            .all()
        )
        all_players = [str(m.tg_id) for m in members]
    all_players = sorted(set(all_players))
    user_id_str = str(user_id)
    base_index = all_players.index(user_id_str) if user_id_str in all_players else abs(hash(user_id_str)) % (len(all_players) or 1)

    if user_id_str in team_a:
        my_team = team_a
        opp_team = team_b
    elif user_id_str in team_b:
        my_team = team_b
        opp_team = team_a
    else:
        my_team = all_players
        opp_team = all_players

    return {
        "cmp_own": _pair_for_user(my_team, user_id_str, base_index),
        "cmp_opp": _pair_for_user(opp_team, user_id_str, base_index + 1),
        "cmp_cross": _cross_pair_for_user(my_team, opp_team, user_id_str, base_index + 2),
    }


@bp.get("/feedback")
def get_feedback(match_id: int):
    user = require_user()
    db = get_db()
    record = db.query(Feedback).filter_by(match_id=match_id, tg_id=user.tg_id).one_or_none()
    if record is None:
        pairs = _generate_comparison_pairs(db, match_id, user.tg_id)
        record = Feedback(
            match_id=match_id,
            tg_id=user.tg_id,
            mode_18plus=False,
            answers_json={"comparison_pairs": pairs},
            mvp_vote_tg_id=None,
        )
        db.add(record)
        db.commit()
        return ok({"answers_json": record.answers_json, "mvp_vote_tg_id": None})
    return ok({"answers_json": record.answers_json, "mvp_vote_tg_id": record.mvp_vote_tg_id})


@bp.post("/feedback")
def submit_feedback(match_id: int):
    user = require_user()
    data = request.get_json(silent=True) or {}
    answers_json = data.get("answers_json")
    if answers_json is None:
        return err("missing_answers", 400)
    mvp_vote = data.get("mvp_vote_tg_id")
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if match.finished_at is None:
        return err("match_not_finished", 400)
    if datetime.utcnow() - match.finished_at > timedelta(hours=72):
        return err("feedback_closed", 403)
    settings = db.query(UserSettings).filter_by(tg_id=user.tg_id).one()
    record = db.query(Feedback).filter_by(match_id=match_id, tg_id=user.tg_id).one_or_none()
    if record is None:
        record = Feedback(
            match_id=match_id,
            tg_id=user.tg_id,
            mode_18plus=settings.mode_18plus,
            answers_json=answers_json,
            mvp_vote_tg_id=mvp_vote,
        )
        db.add(record)
    else:
        record.answers_json = answers_json
        record.mvp_vote_tg_id = mvp_vote
    db.commit()

    prev_state = load_state(db, match.context_id)
    state = TeamModelState.empty(TeamConfig())
    state.base_ratings = dict(getattr(prev_state, "base_ratings", {}) or {})
    state.tier_bonus = dict(getattr(prev_state, "tier_bonus", {}) or {})
    matches = (
        db.query(Match)
        .filter_by(context_id=match.context_id, status="finished")
        .order_by(Match.created_at.asc())
        .all()
    )
    match_ids = [m.id for m in matches]
    if match_ids:
        db.query(RatingLog).filter(RatingLog.match_id.in_(match_ids)).delete(synchronize_session=False)
    for finished in matches:
        team_match = build_team_model_match(db, finished.id)
        quick, expanded = build_feedback(db, finished.id)
        deltas, breakdown = update_from_match_with_breakdown(
            state, team_match, quick_feedback=quick, expanded_feedback=expanded
        )
        venue = team_match.venue
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
            db.add(
                RatingLog(
                    match_id=finished.id,
                    player_id=player_id,
                    venue=venue,
                    delta=delta,
                    pre_global=post_global - delta,
                    post_global=post_global,
                    pre_venue=post_venue - delta,
                    post_venue=post_venue,
                    goals=goals.get(player_id, 0),
                    assists=assists.get(player_id, 0),
                    details_json=breakdown.get(player_id),
                )
            )
    save_state(db, match.context_id, state)
    log_interaction_diffs(db, match.context_id, prev_state, state, match_id=match.id, source="feedback")
    db.commit()
    return ok()
