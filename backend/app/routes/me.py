import os

from flask import Blueprint, request, send_from_directory
from werkzeug.utils import secure_filename

from ..auth import is_admin, require_user
from ..config import Config
from ..db import get_db
from ..models import (
    Event,
    Feedback,
    Match,
    MatchMember,
    RatingLog,
    Segment,
    TeamCurrent,
    TeamVariant,
    User,
    UserSettings,
)
from team_model.team_model import Config as TeamConfig
from ..services.model_state import load_state
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
    state = load_state(db, 1)
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

        mvp_votes = (
            db.query(Feedback.mvp_vote_tg_id)
            .filter(Feedback.match_id == match.id, Feedback.mvp_vote_tg_id.is_not(None))
            .all()
        )
        vote_counts = {}
        for (tg_id,) in mvp_votes:
            vote_counts[tg_id] = vote_counts.get(tg_id, 0) + 1

        player_stats = {}
        events = db.query(Event).filter_by(match_id=match.id).all()
        for event in events:
            if event.event_type == "own_goal":
                continue
            if event.scorer_tg_id:
                stats = player_stats.setdefault(event.scorer_tg_id, {"goals": 0, "assists": 0})
                stats["goals"] += 1
            if event.assist_tg_id:
                stats = player_stats.setdefault(event.assist_tg_id, {"goals": 0, "assists": 0})
                stats["assists"] += 1

        top_mvp = None
        if vote_counts:
            def mvp_key(tg_id):
                stats = player_stats.get(tg_id, {"goals": 0, "assists": 0})
                useful = stats["goals"] + stats["assists"]
                return (vote_counts.get(tg_id, 0), useful, stats["goals"])

            top_mvp = max(vote_counts.keys(), key=mvp_key)

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
                "mvp": {
                    "top_tg_id": top_mvp,
                    "votes": vote_counts,
                },
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
    player_key = str(tg_id)
    player_state = state.players.get(player_key) if hasattr(state, "players") else None
    last_rating = (
        db.query(RatingLog)
        .filter_by(player_id=player_key)
        .order_by(RatingLog.created_at.desc())
        .first()
    )
    # Profile should show the same current global rating as admin/state.
    if player_state is not None:
        global_rating = float(player_state.global_rating)
    else:
        base_rating = state.base_ratings.get(player_key) if hasattr(state, "base_ratings") else None
        global_rating = float(base_rating) if base_rating is not None else float(TeamConfig().global_start_rating)

    if last_rating:
        last_delta = float(last_rating.delta)
        last_match_id = last_rating.match_id
        last_updated_at = last_rating.created_at.isoformat()
    else:
        last_delta = None
        last_match_id = None
        last_updated_at = None

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
        "rating": {
            "global": global_rating,
            "last_delta": last_delta,
            "last_match_id": last_match_id,
            "last_updated_at": last_updated_at,
        },
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


@bp.get("/me/leaderboard")
def get_leaderboard():
    require_user()
    db = get_db()
    state = load_state(db, 1)
    base_ratings = getattr(state, "base_ratings", {}) or {}

    finished_matches = db.query(Match).filter(Match.status == "finished").all()
    stats: dict[str, dict[str, int]] = {}
    for match in finished_matches:
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

        team_a_ids = [str(tg_id) for tg_id in teams.get("A", []) if str(tg_id).isdigit()]
        team_b_ids = [str(tg_id) for tg_id in teams.get("B", []) if str(tg_id).isdigit()]

        segments = db.query(Segment).filter_by(match_id=match.id).all()
        score_a = sum(seg.score_a for seg in segments)
        score_b = sum(seg.score_b for seg in segments)
        if score_a == score_b:
            winner = None
        else:
            winner = "A" if score_a > score_b else "B"

        for player_id in team_a_ids:
            entry = stats.setdefault(player_id, {"games": 0, "wins": 0, "losses": 0})
            entry["games"] += 1
            if winner == "A":
                entry["wins"] += 1
            elif winner == "B":
                entry["losses"] += 1

        for player_id in team_b_ids:
            entry = stats.setdefault(player_id, {"games": 0, "wins": 0, "losses": 0})
            entry["games"] += 1
            if winner == "B":
                entry["wins"] += 1
            elif winner == "A":
                entry["losses"] += 1

    rating_by_player: dict[str, RatingLog] = {}
    for row in db.query(RatingLog).order_by(RatingLog.created_at.desc()).all():
        if row.player_id not in rating_by_player:
            rating_by_player[row.player_id] = row

    users = db.query(User).all()
    user_map = {str(user.tg_id): user for user in users}
    player_ids = set(stats.keys()) | set(rating_by_player.keys())
    tg_id_threshold = 100_000

    entries = []
    for player_id in player_ids:
        user = user_map.get(player_id)
        last_rating = rating_by_player.get(player_id)
        global_rating = (
            float(last_rating.post_global)
            if last_rating
            else float(base_ratings.get(player_id, TeamConfig().global_start_rating))
        )
        last_delta = float(last_rating.delta) if last_rating else None
        entry_stats = stats.get(player_id, {"games": 0, "wins": 0, "losses": 0})
        games = entry_stats["games"]
        has_tg = user is not None and user.tg_id >= tg_id_threshold
        if has_tg:
            if games < 1:
                continue
        else:
            if games < 3:
                continue
        entries.append(
            {
                "tg_id": int(player_id) if player_id.isdigit() else None,
                "name": (user.custom_name or user.tg_name) if user else player_id,
                "avatar": (user.custom_avatar or user.tg_avatar) if user else None,
                "games": games,
                "wins": entry_stats["wins"],
                "losses": entry_stats["losses"],
                "rating": global_rating,
                "last_delta": last_delta,
            }
        )

    entries.sort(key=lambda item: (item["rating"], item["games"]), reverse=True)
    return ok({"items": entries})
