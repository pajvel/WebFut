"""Draft business logic: captain suggestion, pair generation, pick fixing, balance."""
from __future__ import annotations

from typing import List, Tuple

from ..models import DraftPick, DraftSession, DraftStatus, MatchMember
from team_model.team_model import Config as TeamConfig
from team_model.team_model.ratings import effective_rating
from team_model.team_model.types import ModelState


# ── Snake order generator ────────────────────────────────────────────────

def build_snake_order(pool_size: int) -> list[str]:
    """
    Build 1-2-2-1 snake draft order for *pool_size* picks.
    Each pick assigns a team letter ('A' or 'B') to the picking captain.
    E.g. for pool_size=8 → ['A','B','B','A','A','B','B','A']
    """
    order: list[str] = []
    current = "A"
    direction = 1  # 1 = forward, -1 = reverse
    i = 0
    while len(order) < pool_size:
        order.append(current)
        i += 1
        # In snake draft, switch every 2 picks (except first pick is single)
        if i == 1 or (i > 1 and (i - 1) % 2 == 0):
            current = "B" if current == "A" else "A"
            direction *= -1
    return order


def build_snake_order_1221(pool_size: int) -> list[str]:
    """
    Strict 1–2–2–1 pattern.
    Captain A picks first, then B picks twice, A picks twice, etc.
    """
    order: list[str] = []
    # First pick → A
    order.append("A")
    turn = "B"
    while len(order) < pool_size:
        # Add 2 picks for current turn
        for _ in range(2):
            if len(order) >= pool_size:
                break
            order.append(turn)
        turn = "B" if turn == "A" else "A"
    return order


# ── Captain suggestion ───────────────────────────────────────────────────

def suggest_captains(
    state: ModelState,
    participant_ids: list[str],
    venue: str,
    cfg: TeamConfig | None = None,
) -> list[dict]:
    """
    Find pairs of players closest in R_eff. Returns top-3 captain pairs
    sorted by |R_eff difference|.
    """
    if cfg is None:
        cfg = state.config
    ratings: dict[str, float] = {}
    for pid in participant_ids:
        player = state.players.get(pid)
        if player:
            ratings[pid] = effective_rating(player, venue, cfg)
        else:
            ratings[pid] = cfg.global_start_rating

    sorted_by_rating = sorted(participant_ids, key=lambda p: ratings[p], reverse=True)
    pairs: list[dict] = []
    seen: set[frozenset] = set()

    for i, a in enumerate(sorted_by_rating):
        for b in sorted_by_rating[i + 1:]:
            key = frozenset({a, b})
            if key in seen:
                continue
            seen.add(key)
            diff = abs(ratings[a] - ratings[b])
            pairs.append({
                "captain_a": a,
                "captain_b": b,
                "rating_a": ratings[a],
                "rating_b": ratings[b],
                "diff": diff,
            })

    pairs.sort(key=lambda p: p["diff"])
    return pairs[:5]


# ── Pair suggestion for current pick ─────────────────────────────────────

def suggest_pair(
    state: ModelState,
    available_ids: list[str],
    venue: str,
    cfg: TeamConfig | None = None,
) -> Tuple[str, str] | None:
    """
    Pick 2 players from the pool that are closest in R_eff.
    Returns (player_a, player_b) or None if <2 available.
    """
    if len(available_ids) < 2:
        return None
    if cfg is None:
        cfg = state.config

    ratings: dict[str, float] = {}
    for pid in available_ids:
        player = state.players.get(pid)
        if player:
            ratings[pid] = effective_rating(player, venue, cfg)
        else:
            ratings[pid] = cfg.global_start_rating

    best_pair = None
    best_diff = float("inf")
    for i, a in enumerate(available_ids):
        for b in available_ids[i + 1:]:
            diff = abs(ratings[a] - ratings[b])
            if diff < best_diff:
                best_diff = diff
                best_pair = (a, b)

    return best_pair


# ── Available pool ───────────────────────────────────────────────────────

def get_available_pool(draft: DraftSession, db) -> list[int]:
    """Get tg_ids of players not yet picked (excluding captains, excluding undone)."""
    picks = (
        db.query(DraftPick)
        .filter_by(draft_id=draft.id, is_undone=False)
        .all()
    )
    picked_ids = set()
    for pick in picks:
        picked_ids.add(pick.picked_tg_id)
        if pick.auto_assigned_tg_id:
            picked_ids.add(pick.auto_assigned_tg_id)

    # Get all match participants minus captains minus picked
    members = (
        db.query(MatchMember)
        .filter(
            MatchMember.match_id == draft.match_id,
            MatchMember.role.in_(["player", "organizer"]),
        )
        .all()
    )
    captain_ids = {draft.captain_a_tg_id, draft.captain_b_tg_id}
    return [
        m.tg_id for m in members
        if m.tg_id not in picked_ids and m.tg_id not in captain_ids
    ]


# ── Team balance after draft ─────────────────────────────────────────────

def compute_draft_teams(draft: DraftSession, db) -> dict:
    """Build current team composition from draft picks."""
    team_a = [draft.captain_a_tg_id]
    team_b = [draft.captain_b_tg_id]

    picks = (
        db.query(DraftPick)
        .filter_by(draft_id=draft.id, is_undone=False)
        .order_by(DraftPick.pick_number.asc())
        .all()
    )
    for pick in picks:
        if pick.assigned_team == "A":
            team_a.append(pick.picked_tg_id)
        else:
            team_b.append(pick.picked_tg_id)
        if pick.auto_assigned_tg_id:
            if pick.auto_assigned_team == "A":
                team_a.append(pick.auto_assigned_tg_id)
            else:
                team_b.append(pick.auto_assigned_tg_id)

    return {"A": [str(tg) for tg in team_a], "B": [str(tg) for tg in team_b]}


def compute_team_r_eff(state: ModelState, tg_ids: list, venue: str) -> float:
    """Sum of R_eff for a list of players."""
    cfg = state.config
    total = 0.0
    for tg_id in tg_ids:
        player = state.players.get(str(tg_id))
        if player:
            total += effective_rating(player, venue, cfg)
        else:
            total += cfg.global_start_rating
    return total
