import os

from flask import Blueprint, request, send_from_directory
from werkzeug.utils import secure_filename

from ..auth import is_admin, require_user
from ..config import Config
from ..db import get_db
from ..models import Event, Feedback, Match, MatchMember, Segment, TeamCurrent, TeamVariant, User, UserSettings
from ..utils import err, ok

bp = Blueprint("me", __name__)

_VENUE_MAP = {"зал1": "Эксперт", "зал2": "Маракана"}


def _display_venue(venue: str | None) -> str | None:
    if not venue:
        return venue
    return _VENUE_MAP.get(venue, venue)


@bp.get("/me")
def get_me():
    user = require_user()
    if user.custom_avatar and user.custom_avatar.startswith("/uploads/"):
        filename = os.path.basename(user.custom_avatar.split("?", 1)[0])
        target_path = os.path.join(Config.UPLOADS_DIR, filename)
        if not os.path.exists(target_path):
            user.custom_avatar = None
            get_db().commit()
    elif user.custom_avatar and "/uploads/" in user.custom_avatar:
        path = user.custom_avatar.split("?", 1)[0]
        filename = os.path.basename(path)
        target_path = os.path.join(Config.UPLOADS_DIR, filename)
        if not os.path.exists(target_path):
            user.custom_avatar = None
            get_db().commit()
    return ok(
        {
            "tg_id": user.tg_id,
            "tg_name": user.tg_name,
            "tg_avatar": user.tg_avatar,
            "custom_name": user.custom_name,
            "custom_avatar": user.custom_avatar,
            "is_admin": is_admin(user),
        }
    )


@bp.patch("/me")
def patch_me():
    user = require_user()
    data = request.get_json(silent=True) or {}
    if "custom_name" in data:
        value = data.get("custom_name")
        user.custom_name = None if value in (None, "") else value
    if "custom_avatar" in data:
        value = data.get("custom_avatar")
        user.custom_avatar = None if value in (None, "") else value
    get_db().commit()
    return ok()


@bp.post("/me/avatar")
def upload_avatar():
    user = require_user()
    file = request.files.get("file")
    if file is None or not file.filename:
        return err("file_missing", 400)

    os.makedirs(Config.UPLOADS_DIR, exist_ok=True)
    filename = secure_filename(file.filename)
    _, ext = os.path.splitext(filename)
    ext = ext.lower() if ext else ".jpg"
    target_name = f"{user.tg_id}{ext}"
    target_path = os.path.join(Config.UPLOADS_DIR, target_name)

    if user.custom_avatar and user.custom_avatar.startswith("/uploads/"):
        old_name = os.path.basename(user.custom_avatar)
        old_path = os.path.join(Config.UPLOADS_DIR, old_name)
        if os.path.exists(old_path) and old_path != target_path:
            os.remove(old_path)

    file.save(target_path)
    user.custom_avatar = f"/uploads/{target_name}"
    get_db().commit()
    return ok({"url": user.custom_avatar})


@bp.get("/me/settings")
def get_settings():
    user = require_user()
    db = get_db()
    settings = db.query(UserSettings).filter_by(tg_id=user.tg_id).one()
    return ok({"theme": settings.theme, "mode_18plus": settings.mode_18plus})


@bp.patch("/me/settings")
def patch_settings():
    user = require_user()
    data = request.get_json(silent=True) or {}
    db = get_db()
    settings = db.query(UserSettings).filter_by(tg_id=user.tg_id).one()
    theme = data.get("theme")
    if theme not in (None, "light", "dark"):
        return err("invalid_theme", 400)
    if theme:
        settings.theme = theme
    if "mode_18plus" in data:
        settings.mode_18plus = bool(data["mode_18plus"])
    db.commit()
    return ok()


@bp.get("/uploads/<path:filename>")
def serve_upload(filename: str):
    return send_from_directory(Config.UPLOADS_DIR, filename)


@bp.get("/me/profile")
def get_profile():
    user = require_user()
    return ok(_build_profile(user.tg_id))


@bp.get("/users/<int:tg_id>/profile")
def get_user_profile(tg_id: int):
    require_user()
    return ok(_build_profile(tg_id))


def _build_profile(tg_id: int):
    db = get_db()
    memberships = (
        db.query(MatchMember, Match)
        .join(Match, MatchMember.match_id == Match.id)
        .filter(MatchMember.tg_id == tg_id)
        .order_by(Match.created_at.desc())
        .all()
    )

    history = []
    seen = set()
    for member, match in memberships:
        if match.id in seen:
            continue
        seen.add(match.id)
        members = (
            db.query(MatchMember, User)
            .join(User, MatchMember.tg_id == User.tg_id)
            .filter(MatchMember.match_id == match.id, MatchMember.role.in_(["player", "organizer"]))
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

        current = db.query(TeamCurrent).filter_by(match_id=match.id).one_or_none()
        if current:
            teams = current.current_teams_json
        else:
            recommended = (
                db.query(TeamVariant)
                .filter_by(match_id=match.id, is_recommended=True)
                .order_by(TeamVariant.variant_no.asc())
                .first()
            )
            teams = recommended.teams_json if recommended else {"A": [], "B": []}

        team_a_ids = [int(tg_id) for tg_id in teams.get("A", []) if str(tg_id).isdigit()]
        team_b_ids = [int(tg_id) for tg_id in teams.get("B", []) if str(tg_id).isdigit()]

        segments = (
            db.query(Segment)
            .filter_by(match_id=match.id)
            .order_by(Segment.seg_no.asc())
            .all()
        )
        final_segment = next((seg for seg in reversed(segments) if seg.ended_at), segments[-1] if segments else None)
        score_a = final_segment.score_a if final_segment else 0
        score_b = final_segment.score_b if final_segment else 0

        history.append(
            {
                "id": match.id,
                "status": match.status,
                "scheduled_at": match.scheduled_at.isoformat() if match.scheduled_at else None,
                "venue": _display_venue(match.venue),
                "created_at": match.created_at.isoformat(),
                "finished_at": match.finished_at.isoformat() if match.finished_at else None,
                "score_a": score_a,
                "score_b": score_b,
                "team_a_members": [member_map[tg_id] for tg_id in team_a_ids if tg_id in member_map],
                "team_b_members": [member_map[tg_id] for tg_id in team_b_ids if tg_id in member_map],
            }
        )

    finished_matches = [m for m in history if m["status"] == "finished"]
    finished_ids = {m["id"] for m in finished_matches}

    goals = (
        db.query(Event)
        .filter(Event.scorer_tg_id == tg_id, Event.is_deleted.is_(False))
        .count()
    )
    assists = (
        db.query(Event)
        .filter(Event.assist_tg_id == tg_id, Event.is_deleted.is_(False))
        .count()
    )
    mvp = db.query(Feedback).filter(Feedback.mvp_vote_tg_id == tg_id).count()

    wins = 0
    losses = 0
    for match_id in finished_ids:
        current = db.query(TeamCurrent).filter_by(match_id=match_id).one_or_none()
        if current:
            teams = current.current_teams_json
        else:
            recommended = (
                db.query(TeamVariant)
                .filter_by(match_id=match_id, is_recommended=True)
                .order_by(TeamVariant.variant_no.asc())
                .first()
            )
            teams = recommended.teams_json if recommended else {"A": [], "B": []}

        team_a = [str(p) for p in teams.get("A", [])]
        team_b = [str(p) for p in teams.get("B", [])]
        user_id = str(tg_id)
        if user_id in team_a:
            user_team = "A"
        elif user_id in team_b:
            user_team = "B"
        else:
            continue

        segments = db.query(Segment).filter_by(match_id=match_id).all()
        score_a = sum(seg.score_a for seg in segments)
        score_b = sum(seg.score_b for seg in segments)
        if score_a == score_b:
            continue
        if user_team == "A":
            wins += 1 if score_a > score_b else 0
            losses += 1 if score_a < score_b else 0
        else:
            wins += 1 if score_b > score_a else 0
            losses += 1 if score_b < score_a else 0

    return {
        "stats": {
            "matches": len(finished_matches),
            "wins": wins,
            "losses": losses,
            "goals": goals,
            "assists": assists,
            "mvp": mvp,
        },
        "history": history,
    }
