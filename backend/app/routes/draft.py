"""Routes for Captain's Draft: init, captain selection, pick, undo, status."""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, request

from ..auth import is_admin, require_user
from ..db import get_db
from ..models import (
    DraftPick,
    DraftSession,
    DraftStatus,
    Match,
    MatchMember,
    User,
)
from ..services.draft import (
    build_snake_order_1221,
    compute_draft_teams,
    compute_team_r_eff,
    get_available_pool,
    suggest_captains,
    suggest_pair,
)
from ..services.model_state import load_state
from ..utils import err, ok

bp = Blueprint("draft", __name__)


# ── helpers ──────────────────────────────────────────────────────────────

def _is_organizer_or_admin(db, match, user) -> bool:
    if is_admin(user):
        return True
    member = (
        db.query(MatchMember)
        .filter_by(match_id=match.id, tg_id=user.tg_id, role="organizer")
        .one_or_none()
    )
    return member is not None


def _player_info(db, tg_ids: list[int]) -> dict[int, dict]:
    """Fetch basic user info for a list of tg_ids."""
    users = db.query(User).filter(User.tg_id.in_(tg_ids)).all()
    return {
        u.tg_id: {
            "tg_id": u.tg_id,
            "name": u.custom_name or u.tg_name,
            "avatar": u.custom_avatar or u.tg_avatar,
        }
        for u in users
    }


# ── Draft initialization ────────────────────────────────────────────────

@bp.post("/matches/<int:match_id>/draft/init")
def init_draft(match_id: int):
    """Initialize a draft session for a match. Suggests captain pairs."""
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not _is_organizer_or_admin(db, match, user):
        return err("forbidden", 403)

    # Check existing draft
    existing = db.query(DraftSession).filter_by(match_id=match_id).one_or_none()
    if existing and existing.status in (DraftStatus.PICKING.value, DraftStatus.COMPLETED.value):
        return err("draft_already_active", 400)

    # Cancel old draft if exists
    if existing:
        db.query(DraftPick).filter_by(draft_id=existing.id).delete()
        db.delete(existing)
        db.flush()

    # Get participants
    members = (
        db.query(MatchMember)
        .filter(MatchMember.match_id == match_id, MatchMember.role.in_(["player", "organizer"]))
        .all()
    )
    participant_ids = [str(m.tg_id) for m in members]
    if len(participant_ids) < 4:
        return err("too_few_players", 400)

    # AI suggest captains
    state = load_state(db, match.context_id)
    for pid in participant_ids:
        state.ensure_player(pid, match.venue, state.config.global_start_rating, False)
    captain_suggestions = suggest_captains(state, participant_ids, match.venue)

    # Create draft session in captain_selection phase
    draft = DraftSession(
        match_id=match_id,
        status=DraftStatus.CAPTAIN_SELECTION.value,
    )
    db.add(draft)
    db.commit()

    # Build user info
    all_tg_ids = [int(pid) for pid in participant_ids]
    info = _player_info(db, all_tg_ids)

    return ok({
        "draft_id": draft.id,
        "status": draft.status,
        "captain_suggestions": [
            {
                "captain_a": {**info.get(int(s["captain_a"]), {}), "rating": s["rating_a"]},
                "captain_b": {**info.get(int(s["captain_b"]), {}), "rating": s["rating_b"]},
                "diff": s["diff"],
            }
            for s in captain_suggestions
        ],
        "participants": [info.get(tg_id, {"tg_id": tg_id}) for tg_id in all_tg_ids],
    })


# ── Set captains ─────────────────────────────────────────────────────────

@bp.post("/matches/<int:match_id>/draft/captains")
def set_captains(match_id: int):
    """Set captains and start the picking phase."""
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not _is_organizer_or_admin(db, match, user):
        return err("forbidden", 403)

    draft = db.query(DraftSession).filter_by(match_id=match_id).one_or_none()
    if draft is None:
        return err("draft_not_found", 404)
    if draft.status != DraftStatus.CAPTAIN_SELECTION.value:
        return err("invalid_draft_state", 400)

    data = request.get_json(silent=True) or {}
    captain_a = data.get("captain_a_tg_id")
    captain_b = data.get("captain_b_tg_id")
    if not captain_a or not captain_b:
        return err("missing_captains", 400)
    captain_a = int(captain_a)
    captain_b = int(captain_b)
    if captain_a == captain_b:
        return err("same_captain", 400)

    # Verify both are participants
    members = (
        db.query(MatchMember)
        .filter(MatchMember.match_id == match_id, MatchMember.role.in_(["player", "organizer"]))
        .all()
    )
    member_ids = {m.tg_id for m in members}
    if captain_a not in member_ids or captain_b not in member_ids:
        return err("captain_not_participant", 400)

    # Pool size = participants minus 2 captains
    pool_size = len(member_ids) - 2
    snake = build_snake_order_1221(pool_size)

    draft.captain_a_tg_id = captain_a
    draft.captain_b_tg_id = captain_b
    draft.status = DraftStatus.PICKING.value
    draft.current_pick_number = 0
    draft.snake_order_json = snake
    # First pick is captain A
    draft.current_captain_tg_id = captain_a if snake[0] == "A" else captain_b
    draft.updated_at = datetime.now(timezone.utc)

    # Generate first suggested pair
    state = load_state(db, match.context_id)
    available = get_available_pool(draft, db)
    pair = suggest_pair(state, [str(tg) for tg in available], match.venue)
    if pair:
        draft.suggested_pair_json = [int(pair[0]), int(pair[1])]
    else:
        draft.suggested_pair_json = None

    db.commit()

    info = _player_info(db, list(member_ids))
    return ok({
        "draft_id": draft.id,
        "status": draft.status,
        "current_pick_number": draft.current_pick_number,
        "current_captain_tg_id": draft.current_captain_tg_id,
        "suggested_pair": draft.suggested_pair_json,
        "snake_order": draft.snake_order_json,
        "pool": [info.get(tg, {"tg_id": tg}) for tg in available],
    })


# ── Make a pick ──────────────────────────────────────────────────────────

@bp.post("/matches/<int:match_id>/draft/pick")
def make_pick(match_id: int):
    """
    Captain picks one player from the suggested pair.
    The other is auto-assigned to maintain balance.
    """
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)

    draft = db.query(DraftSession).filter_by(match_id=match_id).one_or_none()
    if draft is None:
        return err("draft_not_found", 404)
    if draft.status != DraftStatus.PICKING.value:
        return err("draft_not_picking", 400)

    # Only current captain or organizer can pick
    is_captain = user.tg_id == draft.current_captain_tg_id
    is_org = _is_organizer_or_admin(db, match, user)
    if not is_captain and not is_org:
        return err("not_your_turn", 403)

    data = request.get_json(silent=True) or {}
    picked_tg_id = data.get("picked_tg_id")
    if picked_tg_id is None:
        return err("missing_picked_tg_id", 400)
    picked_tg_id = int(picked_tg_id)

    # Validate pick is from suggested pair
    pair = draft.suggested_pair_json or []
    if picked_tg_id not in pair:
        return err("not_in_suggested_pair", 400)

    # Determine teams
    snake = draft.snake_order_json or []
    pick_idx = draft.current_pick_number
    if pick_idx >= len(snake):
        return err("draft_complete", 400)

    captain_team = snake[pick_idx]  # "A" or "B"
    other_team = "B" if captain_team == "A" else "A"

    # The auto-assigned player
    auto_tg_id = [p for p in pair if p != picked_tg_id]
    auto_assigned_tg_id = auto_tg_id[0] if auto_tg_id else None

    # Record pick
    pick = DraftPick(
        draft_id=draft.id,
        pick_number=pick_idx,
        captain_tg_id=draft.current_captain_tg_id,
        picked_tg_id=picked_tg_id,
        auto_assigned_tg_id=auto_assigned_tg_id,
        assigned_team=captain_team,
        auto_assigned_team=other_team if auto_assigned_tg_id else None,
    )
    db.add(pick)

    # Advance draft state
    next_pick = pick_idx + 1
    # Each pick assigns 2 players (picked + auto), so we advance by 1 in snake
    # but the pool shrinks by 2
    available_after = get_available_pool(draft, db)
    # Remove the 2 we just assigned
    available_after = [
        tg for tg in available_after
        if tg != picked_tg_id and tg != auto_assigned_tg_id
    ]

    if next_pick >= len(snake) or len(available_after) == 0:
        # Draft complete — handle odd player
        if len(available_after) == 1:
            # Assign last player to weaker team
            state = load_state(db, match.context_id)
            teams = compute_draft_teams(draft, db)
            # Include current pick manually since it's not committed yet
            if captain_team == "A":
                teams["A"].append(str(picked_tg_id))
            else:
                teams["B"].append(str(picked_tg_id))
            if auto_assigned_tg_id:
                if other_team == "A":
                    teams["A"].append(str(auto_assigned_tg_id))
                else:
                    teams["B"].append(str(auto_assigned_tg_id))

            r_a = compute_team_r_eff(state, teams["A"], match.venue)
            r_b = compute_team_r_eff(state, teams["B"], match.venue)
            last_player = available_after[0]
            weaker_team = "A" if r_a <= r_b else "B"
            # Record as auto-pick
            db.add(DraftPick(
                draft_id=draft.id,
                pick_number=next_pick,
                captain_tg_id=draft.current_captain_tg_id,
                picked_tg_id=last_player,
                auto_assigned_tg_id=None,
                assigned_team=weaker_team,
                auto_assigned_team=None,
            ))

        draft.status = DraftStatus.COMPLETED.value
        draft.current_pick_number = next_pick
        draft.current_captain_tg_id = None
        draft.suggested_pair_json = None
    else:
        draft.current_pick_number = next_pick
        # Set next captain from snake
        next_team = snake[next_pick] if next_pick < len(snake) else None
        if next_team == "A":
            draft.current_captain_tg_id = draft.captain_a_tg_id
        elif next_team == "B":
            draft.current_captain_tg_id = draft.captain_b_tg_id
        else:
            draft.current_captain_tg_id = None

        # Suggest next pair
        state = load_state(db, match.context_id)
        pair_result = suggest_pair(state, [str(tg) for tg in available_after], match.venue)
        if pair_result:
            draft.suggested_pair_json = [int(pair_result[0]), int(pair_result[1])]
        else:
            draft.suggested_pair_json = None

    draft.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Return current state
    final_teams = compute_draft_teams(draft, db)
    info = _player_info(db, [int(p) for team in final_teams.values() for p in team])
    return ok({
        "draft_id": draft.id,
        "status": draft.status,
        "current_pick_number": draft.current_pick_number,
        "current_captain_tg_id": draft.current_captain_tg_id,
        "suggested_pair": draft.suggested_pair_json,
        "teams": final_teams,
        "pool": [{"tg_id": tg} for tg in get_available_pool(draft, db)],
    })


# ── Undo last pick ──────────────────────────────────────────────────────

@bp.post("/matches/<int:match_id>/draft/undo")
def undo_pick(match_id: int):
    """Undo the last pick. Organizer-only override."""
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not _is_organizer_or_admin(db, match, user):
        return err("forbidden", 403)

    draft = db.query(DraftSession).filter_by(match_id=match_id).one_or_none()
    if draft is None:
        return err("draft_not_found", 404)

    # Find last non-undone pick
    last_pick = (
        db.query(DraftPick)
        .filter_by(draft_id=draft.id, is_undone=False)
        .order_by(DraftPick.pick_number.desc())
        .first()
    )
    if last_pick is None:
        return err("nothing_to_undo", 400)

    last_pick.is_undone = True

    # If draft was completed, revert to picking
    if draft.status == DraftStatus.COMPLETED.value:
        draft.status = DraftStatus.PICKING.value

    # Revert to the pick number of the undone pick
    draft.current_pick_number = last_pick.pick_number
    snake = draft.snake_order_json or []
    if last_pick.pick_number < len(snake):
        team_letter = snake[last_pick.pick_number]
        draft.current_captain_tg_id = (
            draft.captain_a_tg_id if team_letter == "A" else draft.captain_b_tg_id
        )

    # Regenerate suggested pair from updated available pool
    state = load_state(db, match.context_id)
    available = get_available_pool(draft, db)
    # Re-add the undone players to available
    available_with_undone = list(set(available) | {last_pick.picked_tg_id})
    if last_pick.auto_assigned_tg_id:
        available_with_undone.append(last_pick.auto_assigned_tg_id)
    available_with_undone = list(set(available_with_undone))

    pair_result = suggest_pair(state, [str(tg) for tg in available_with_undone], match.venue)
    if pair_result:
        draft.suggested_pair_json = [int(pair_result[0]), int(pair_result[1])]
    else:
        draft.suggested_pair_json = None

    draft.updated_at = datetime.now(timezone.utc)
    db.commit()

    final_teams = compute_draft_teams(draft, db)
    return ok({
        "draft_id": draft.id,
        "status": draft.status,
        "current_pick_number": draft.current_pick_number,
        "current_captain_tg_id": draft.current_captain_tg_id,
        "suggested_pair": draft.suggested_pair_json,
        "teams": final_teams,
        "pool": [{"tg_id": tg} for tg in available_with_undone],
    })


# ── Draft status / state ────────────────────────────────────────────────

@bp.get("/matches/<int:match_id>/draft")
def get_draft_status(match_id: int):
    """Get current draft state."""
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)

    draft = db.query(DraftSession).filter_by(match_id=match_id).one_or_none()
    if draft is None:
        return err("draft_not_found", 404)

    picks = (
        db.query(DraftPick)
        .filter_by(draft_id=draft.id, is_undone=False)
        .order_by(DraftPick.pick_number.asc())
        .all()
    )

    teams = compute_draft_teams(draft, db)
    available = get_available_pool(draft, db)
    all_tg_ids = set()
    all_tg_ids.update(int(p) for team in teams.values() for p in team)
    all_tg_ids.update(available)
    if draft.captain_a_tg_id:
        all_tg_ids.add(draft.captain_a_tg_id)
    if draft.captain_b_tg_id:
        all_tg_ids.add(draft.captain_b_tg_id)
    info = _player_info(db, list(all_tg_ids))

    return ok({
        "draft_id": draft.id,
        "match_id": draft.match_id,
        "status": draft.status,
        "captain_a": info.get(draft.captain_a_tg_id) if draft.captain_a_tg_id else None,
        "captain_b": info.get(draft.captain_b_tg_id) if draft.captain_b_tg_id else None,
        "current_pick_number": draft.current_pick_number,
        "current_captain_tg_id": draft.current_captain_tg_id,
        "suggested_pair": draft.suggested_pair_json,
        "snake_order": draft.snake_order_json,
        "teams": teams,
        "pool": [info.get(tg, {"tg_id": tg}) for tg in available],
        "picks": [
            {
                "pick_number": p.pick_number,
                "captain_tg_id": p.captain_tg_id,
                "picked_tg_id": p.picked_tg_id,
                "auto_assigned_tg_id": p.auto_assigned_tg_id,
                "assigned_team": p.assigned_team,
                "auto_assigned_team": p.auto_assigned_team,
            }
            for p in picks
        ],
    })


# ── Cancel draft ─────────────────────────────────────────────────────────

@bp.post("/matches/<int:match_id>/draft/cancel")
def cancel_draft(match_id: int):
    """Cancel a draft. Organizer-only."""
    user = require_user()
    db = get_db()
    match = db.query(Match).filter_by(id=match_id).one_or_none()
    if match is None:
        return err("match_not_found", 404)
    if not _is_organizer_or_admin(db, match, user):
        return err("forbidden", 403)

    draft = db.query(DraftSession).filter_by(match_id=match_id).one_or_none()
    if draft is None:
        return err("draft_not_found", 404)

    draft.status = DraftStatus.CANCELLED.value
    draft.updated_at = datetime.now(timezone.utc)
    db.commit()
    return ok()
