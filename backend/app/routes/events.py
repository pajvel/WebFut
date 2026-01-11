from datetime import datetime

from flask import Blueprint, request

from ..auth import is_admin, require_user
from ..db import get_db
from ..models import Event, Match, MatchMember, Segment
from ..services.match import ensure_active_segment
from ..utils import err, ok

bp = Blueprint("events", __name__, url_prefix="/matches/<int:match_id>/events")


def _can_edit(db, match_id: int, user_id: int) -> bool:
    member = db.query(MatchMember).filter_by(match_id=match_id, tg_id=user_id).one_or_none()
    return member is not None and (member.can_edit or member.role == "organizer")

def _can_score(db, match_id: int, user_id: int) -> bool:
    member = db.query(MatchMember).filter_by(match_id=match_id, tg_id=user_id).one_or_none()
    return member is not None and (member.role in ("player", "organizer", "spectator") or member.can_edit)


def _match_or_404(db, match_id: int):
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return None
    return match


def _apply_score(segment, team: str, delta: int) -> None:
    if team == "A":
        segment.score_a += delta
    else:
        segment.score_b += delta


@bp.post("/goal")
def goal(match_id: int):
    user = require_user()
    db = get_db()
    match = _match_or_404(db, match_id)
    if match is None:
        return err("match_not_found", 404)
    if not (is_admin(user) or _can_score(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    team = data.get("team")
    scorer = data.get("scorer_tg_id")
    assist = data.get("assist_tg_id")
    if team not in ("A", "B") or scorer is None:
        return err("invalid_payload", 400)
    segment = ensure_active_segment(db, match_id)
    event = Event(
        match_id=match_id,
        segment_id=segment.id,
        event_type="goal",
        team=team,
        scorer_tg_id=scorer,
        assist_tg_id=assist,
        created_by_tg_id=user.tg_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        is_deleted=False,
    )
    db.add(event)
    _apply_score(segment, team, 1)
    db.commit()
    return ok({"event_id": event.id})


@bp.post("/own-goal")
def own_goal(match_id: int):
    user = require_user()
    db = get_db()
    match = _match_or_404(db, match_id)
    if match is None:
        return err("match_not_found", 404)
    if not (is_admin(user) or _can_score(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    team = data.get("team")
    if team not in ("A", "B"):
        return err("invalid_payload", 400)
    segment = ensure_active_segment(db, match_id)
    opponent = "B" if team == "A" else "A"
    event = Event(
        match_id=match_id,
        segment_id=segment.id,
        event_type="own_goal",
        team=opponent,
        scorer_tg_id=None,
        assist_tg_id=None,
        created_by_tg_id=user.tg_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        is_deleted=False,
    )
    db.add(event)
    _apply_score(segment, opponent, 1)
    db.commit()
    return ok({"event_id": event.id})


@bp.patch("/<int:event_id>")
def patch_event(match_id: int, event_id: int):
    user = require_user()
    db = get_db()
    match = _match_or_404(db, match_id)
    if match is None:
        return err("match_not_found", 404)
    if not (is_admin(user) or _can_edit(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    event = db.query(Event).filter_by(id=event_id, match_id=match_id).one_or_none()
    if event is None:
        return err("event_not_found", 404)
    data = request.get_json(silent=True) or {}
    event.scorer_tg_id = data.get("scorer_tg_id", event.scorer_tg_id)
    event.assist_tg_id = data.get("assist_tg_id", event.assist_tg_id)
    event.updated_at = datetime.utcnow()
    db.commit()
    return ok()


@bp.delete("/<int:event_id>")
def delete_event(match_id: int, event_id: int):
    user = require_user()
    db = get_db()
    match = _match_or_404(db, match_id)
    if match is None:
        return err("match_not_found", 404)
    if not (is_admin(user) or _can_edit(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    event = db.query(Event).filter_by(id=event_id, match_id=match_id).one_or_none()
    if event is None:
        return err("event_not_found", 404)
    if not event.is_deleted:
        event.is_deleted = True
        segment = db.query(Segment).filter_by(id=event.segment_id).one()
        _apply_score(segment, event.team, -1)
    db.commit()
    return ok()
