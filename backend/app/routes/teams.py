from flask import Blueprint, request

from ..auth import is_admin, require_user
from ..db import get_db
from ..models import Match, MatchMember, TeamCurrent, TeamVariant, User
from ..services.model_state import load_state, save_state
from ..utils import err, ok
from team_model.team_model.teamgen import evaluate_split, generate_teams

bp = Blueprint("teams", __name__, url_prefix="/matches/<int:match_id>/teams")


def _is_organizer(db, match_id: int, tg_id: int) -> bool:
    member = (
        db.query(MatchMember)
        .filter_by(match_id=match_id, tg_id=tg_id, role="organizer")
        .one_or_none()
    )
    return member is not None


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


def _normalize_team_payload(data: dict) -> dict | None:
    teams = data.get("teams") or {}
    team_a = teams.get("A") or teams.get("team_a")
    team_b = teams.get("B") or teams.get("team_b")
    if not isinstance(team_a, list) or not isinstance(team_b, list):
        return None
    return {"A": [str(p) for p in team_a], "B": [str(p) for p in team_b]}


def _team_name_from_current(current: TeamCurrent | None, team_key: str) -> str:
    if current and current.current_teams_json.get(team_key):
        return current.current_teams_json.get(team_key)
    return "Команда A" if team_key == "name_a" else "Команда B"


def _build_custom_reason(
    base_eval: dict,
    custom_eval: dict,
    members: list[MatchMember],
    users: list[User],
    teams: dict,
    current: TeamCurrent | None,
    state,
) -> str:
    name_map = {u.tg_id: (u.custom_name or u.tg_name) for u in users}
    ratings = {}
    for member in members:
        player = state.players.get(str(member.tg_id))
        ratings[member.tg_id] = float(player.global_rating) if player else state.config.global_start_rating

    team_a_ids = [int(tg_id) for tg_id in teams.get("A", []) if str(tg_id).isdigit()]
    team_b_ids = [int(tg_id) for tg_id in teams.get("B", []) if str(tg_id).isdigit()]
    avg_a = sum(ratings.get(tg_id, 0) for tg_id in team_a_ids) / max(1, len(team_a_ids))
    avg_b = sum(ratings.get(tg_id, 0) for tg_id in team_b_ids) / max(1, len(team_b_ids))

    team_a_name = _team_name_from_current(current, "name_a")
    team_b_name = _team_name_from_current(current, "name_b")
    reasons = []

    if abs(avg_a - avg_b) > 0.1:
        stronger = team_a_name if avg_a > avg_b else team_b_name
        diff = abs(avg_a - avg_b)
        reasons.append(f"Перекос по силе: {stronger} сильнее примерно на {diff:.1f}.")

    top_players = sorted(ratings.items(), key=lambda item: item[1], reverse=True)[:4]
    top_ids = [tg_id for tg_id, _ in top_players]
    in_a = [tg_id for tg_id in top_ids if tg_id in team_a_ids]
    in_b = [tg_id for tg_id in top_ids if tg_id in team_b_ids]
    if custom_eval["components"]["syn"] > base_eval["components"]["syn"]:
        if len(in_a) >= 2:
            names = ", ".join(name_map.get(tg_id, str(tg_id)) for tg_id in in_a[:2])
            reasons.append(f"Синергия перекошена: вместе в {team_a_name} {names}.")
        elif len(in_b) >= 2:
            names = ", ".join(name_map.get(tg_id, str(tg_id)) for tg_id in in_b[:2])
            reasons.append(f"Синергия перекошена: вместе в {team_b_name} {names}.")
    if len(in_a) >= 2 and len(in_a) > len(in_b):
        names = ", ".join(name_map.get(tg_id, str(tg_id)) for tg_id in in_a[:3])
        reasons.append(f"Сильные игроки вместе в {team_a_name}: {names}.")
    elif len(in_b) >= 2 and len(in_b) > len(in_a):
        names = ", ".join(name_map.get(tg_id, str(tg_id)) for tg_id in in_b[:3])
        reasons.append(f"Сильные игроки вместе в {team_b_name}: {names}.")

    if not reasons:
        reasons.append(_why_text(base_eval, custom_eval))

    return " ".join(reasons)


@bp.post("/generate")
def generate(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not (is_admin(user) or _is_organizer(db, match_id, user.tg_id)):
        return err("forbidden", 403)

    members = (
        db.query(MatchMember)
        .filter(MatchMember.match_id == match_id, MatchMember.role.in_(["player", "organizer"]))
        .order_by(MatchMember.joined_at.asc())
        .all()
    )
    participants = [str(m.tg_id) for m in members]
    if len(participants) < 2:
        return err("not_enough_players", 400)

    state = load_state(db, match.context_id)
    for name in participants:
        state.ensure_player(name, match.venue, state.config.global_start_rating, False)
    save_state(db, match.context_id, state)
    variants = generate_teams(state, participants, match.venue, top_n=3)
    db.query(TeamVariant).filter_by(match_id=match_id).delete()

    base_eval = evaluate_split(state, variants[0]["team_a"], variants[0]["team_b"], match.venue)
    for idx, variant in enumerate(variants, start=1):
        eval_split = evaluate_split(state, variant["team_a"], variant["team_b"], match.venue)
        why = None
        if idx != 1:
            why = _why_text(base_eval, eval_split)
        db.add(
            TeamVariant(
                match_id=match_id,
                variant_no=idx,
                is_recommended=idx == 1,
                teams_json={"A": variant["team_a"], "B": variant["team_b"]},
                why_text=why,
            )
        )
    db.commit()
    return ok(
        {
            "variants": [
                {
                    "variant_no": idx + 1,
                    "is_recommended": idx == 0,
                    "teams": variants[idx],
                    "why_text": None if idx == 0 else db.query(TeamVariant)
                    .filter_by(match_id=match_id, variant_no=idx + 1)
                    .one()
                    .why_text,
                }
                for idx in range(len(variants))
            ]
        }
    )


@bp.post("/select")
def select(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not (is_admin(user) or _is_organizer(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    variant_no = int(data.get("variant_no", 1))
    team_name_a = data.get("team_name_a")
    team_name_b = data.get("team_name_b")
    variant = (
        db.query(TeamVariant)
        .filter_by(match_id=match_id, variant_no=variant_no)
        .one_or_none()
    )
    if variant is None:
        return err("variant_not_found", 404)

    current = db.query(TeamCurrent).filter_by(match_id=match_id).one_or_none()
    current_names = current.current_teams_json if current else None

    def _apply_names(teams_json: dict) -> dict:
        if team_name_a:
            teams_json["name_a"] = team_name_a
        elif current_names and current_names.get("name_a"):
            teams_json["name_a"] = current_names.get("name_a")
        if team_name_b:
            teams_json["name_b"] = team_name_b
        elif current_names and current_names.get("name_b"):
            teams_json["name_b"] = current_names.get("name_b")
        return teams_json

    teams_json = _apply_names(dict(variant.teams_json))
    if current is None:
        current = TeamCurrent(
            match_id=match_id,
            base_variant_no=variant_no,
            current_teams_json=teams_json,
            is_custom=False,
            why_now_worse_text=None,
        )
        db.add(current)
    else:
        current.base_variant_no = variant_no
        current.current_teams_json = teams_json
        current.is_custom = False
        current.why_now_worse_text = None
    db.commit()
    return ok()


@bp.post("/custom")
def set_custom(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not (is_admin(user) or _is_organizer(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    data = request.get_json(silent=True) or {}
    teams = _normalize_team_payload(data)
    if teams is None:
        return err("invalid_payload", 400)
    base_variant_no = int(data.get("base_variant_no", 1))
    variant = (
        db.query(TeamVariant)
        .filter_by(match_id=match_id, variant_no=base_variant_no)
        .one_or_none()
    )
    if variant is None:
        return err("variant_not_found", 404)

    member_rows = (
        db.query(MatchMember)
        .filter(MatchMember.match_id == match_id, MatchMember.role.in_(["player", "organizer"]))
        .all()
    )
    participants = [str(m.tg_id) for m in member_rows]
    user_rows = (
        db.query(User)
        .filter(User.tg_id.in_([m.tg_id for m in member_rows]))
        .all()
    )
    state = load_state(db, match.context_id)
    for name in participants:
        state.ensure_player(name, match.venue, state.config.global_start_rating, False)
    save_state(db, match.context_id, state)

    current = db.query(TeamCurrent).filter_by(match_id=match_id).one_or_none()
    base_eval = evaluate_split(state, variant.teams_json["A"], variant.teams_json["B"], match.venue)
    custom_eval = evaluate_split(state, teams["A"], teams["B"], match.venue)
    why_text = _build_custom_reason(base_eval, custom_eval, member_rows, user_rows, teams, current, state)
    preserved_names = {}
    if current:
        preserved_names = {
            key: current.current_teams_json.get(key)
            for key in ("name_a", "name_b")
            if current.current_teams_json.get(key)
        }
        current.base_variant_no = base_variant_no
        current.current_teams_json = {**teams, **preserved_names}
        current.is_custom = True
        current.why_now_worse_text = why_text
    else:
        current = TeamCurrent(
            match_id=match_id,
            base_variant_no=base_variant_no,
            current_teams_json={**teams, **preserved_names},
            is_custom=True,
            why_now_worse_text=why_text,
        )
        db.add(current)
    db.commit()
    return ok({"why_text": why_text})


@bp.post("/revert")
def revert(match_id: int):
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not (is_admin(user) or _is_organizer(db, match_id, user.tg_id)):
        return err("forbidden", 403)
    current = db.query(TeamCurrent).filter_by(match_id=match_id).one_or_none()
    if current is None:
        return err("current_not_found", 404)
    variant = (
        db.query(TeamVariant)
        .filter_by(match_id=match_id, variant_no=current.base_variant_no)
        .one_or_none()
    )
    if variant is None:
        return err("variant_not_found", 404)
    current.current_teams_json = variant.teams_json
    current.is_custom = False
    current.why_now_worse_text = None
    db.commit()
    return ok()
