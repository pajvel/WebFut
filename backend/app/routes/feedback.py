from datetime import datetime, timedelta

from flask import Blueprint, request

from ..auth import require_user
from ..db import get_db
from ..models import Feedback, InteractionLog, Match, RatingLog, UserSettings
from ..services.match import build_feedback, build_team_model_match
from ..services.model_state import load_state, save_state
from ..utils import err, ok
from team_model.team_model import Config as TeamConfig
from team_model.team_model import ModelState as TeamModelState
from team_model.team_model import update_from_match_with_breakdown

bp = Blueprint("feedback", __name__, url_prefix="/matches/<int:match_id>")


@bp.get("/feedback")
def get_feedback(match_id: int):
    user = require_user()
    db = get_db()
    record = db.query(Feedback).filter_by(match_id=match_id, tg_id=user.tg_id).one_or_none()
    if record is None:
        return ok({"answers_json": None, "mvp_vote_tg_id": None})
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


def log_interaction_diffs(
    db,
    context_id: int,
    prev_state: TeamModelState,
    next_state: TeamModelState,
    *,
    match_id: int | None = None,
    source: str = "feedback"
) -> None:
    def _diff_map(prev_map: dict, next_map: dict) -> dict:
        keys = set(prev_map.keys()) | set(next_map.keys())
        return {key: (prev_map.get(key, 0.0), next_map.get(key, 0.0)) for key in keys}

    threshold = 1e-6
    prev_syn = prev_state.interactions.synergy
    next_syn = next_state.interactions.synergy
    for venue in set(prev_syn.keys()) | set(next_syn.keys()):
        for key, (before, after) in _diff_map(prev_syn.get(venue, {}), next_syn.get(venue, {})).items():
            if abs(after - before) <= threshold:
                continue
            players = list(key)
            if len(players) != 2:
                continue
            db.add(
                InteractionLog(
                    context_id=context_id,
                    match_id=match_id,
                    venue=venue,
                    kind="synergy",
                    player_a=str(players[0]),
                    player_b=str(players[1]),
                    value_before=before,
                    value_after=after,
                    source=source,
                )
            )

    prev_dom = prev_state.interactions.domination
    next_dom = next_state.interactions.domination
    for venue in set(prev_dom.keys()) | set(next_dom.keys()):
        for key, (before, after) in _diff_map(prev_dom.get(venue, {}), next_dom.get(venue, {})).items():
            if abs(after - before) <= threshold:
                continue
            if not isinstance(key, tuple) or len(key) != 2:
                continue
            db.add(
                InteractionLog(
                    context_id=context_id,
                    match_id=match_id,
                    venue=venue,
                    kind="domination",
                    player_a=str(key[0]),
                    player_b=str(key[1]),
                    value_before=before,
                    value_after=after,
                    source=source,
                )
            )
