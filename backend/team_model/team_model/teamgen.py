from itertools import combinations
from typing import List, Tuple

from .config import Config
from .interactions import domination_penalty, role_balance_penalty, synergy_penalty
from .ratings import effective_rating
from .types import ModelState
from .utils import mean


def _normalized_team(team_a: tuple[str, ...], team_b: tuple[str, ...]) -> tuple[tuple[str, ...], tuple[str, ...]]:
    if team_a[0] <= team_b[0]:
        return team_a, team_b
    return team_b, team_a


def _normalize_split(team_a: List[str], team_b: List[str]) -> Tuple[Tuple[str, ...], Tuple[str, ...]]:
    a = tuple(sorted(team_a))
    b = tuple(sorted(team_b))
    return _normalized_team(a, b)


def _team_rating_map(model: ModelState, participants: List[str], venue: str, cfg: Config) -> dict[str, float]:
    players = [model.players[name] for name in participants]
    avg_rating = mean(effective_rating(p, venue, cfg) for p in players)
    rating_map: dict[str, float] = {}
    for name in participants:
        player = model.players[name]
        rating = effective_rating(player, venue, cfg)
        rating_map[name] = min(rating, avg_rating) if player.is_guest else rating
    return rating_map


def _top_penalty(team_a: List[str], team_b: List[str], rating_map: dict[str, float], cfg: Config) -> float:
    top_k = max(0, cfg.teamgen_top_k)
    if top_k <= 0:
        return 0.0
    top_players = {name for name, _ in sorted(rating_map.items(), key=lambda item: item[1], reverse=True)[:top_k]}
    top_overflow = max(0, len(top_players.intersection(team_a)) - cfg.teamgen_top_max_per_team)
    top_overflow += max(0, len(top_players.intersection(team_b)) - cfg.teamgen_top_max_per_team)
    return top_overflow * cfg.teamgen_top_penalty


def evaluate_split(model: ModelState, team_a: List[str], team_b: List[str], venue: str) -> dict:
    cfg: Config = model.config
    participants = team_a + team_b
    rating_map = _team_rating_map(model, participants, venue, cfg)
    rating_a = sum(rating_map[p] for p in team_a)
    rating_b = sum(rating_map[p] for p in team_b)
    d_hat = rating_a - rating_b
    syn_a = synergy_penalty(model.interactions, venue, team_a, cfg)
    syn_b = synergy_penalty(model.interactions, venue, team_b, cfg)
    dom = domination_penalty(model.interactions, venue, team_a, team_b, cfg)
    role = role_balance_penalty(
        {p.name: p.role_tendencies for p in model.all_players(participants)},
        team_a,
        team_b,
        cfg,
    )
    top = _top_penalty(team_a, team_b, rating_map, cfg)
    interaction_penalty = syn_a + syn_b + dom + role + top
    score = abs(d_hat) + interaction_penalty
    return {
        "team_a": list(team_a),
        "team_b": list(team_b),
        "d_hat": d_hat,
        "score": score,
        "components": {
            "syn": syn_a + syn_b,
            "dom": dom,
            "role": role,
            "top": top,
        },
    }


def generate_teams(model: ModelState, participants: List[str], venue: str, top_n: int = 3) -> List[dict]:
    cfg: Config = model.config
    rating_map = _team_rating_map(model, participants, venue, cfg)

    def team_rating(name: str) -> float:
        return rating_map[name]

    participants_sorted = sorted(participants)
    team_size = len(participants_sorted) // 2
    base_anchor = participants_sorted[0]

    candidates = []
    for team_a in combinations(participants_sorted, team_size):
        if base_anchor not in team_a:
            continue
        team_b = tuple(p for p in participants_sorted if p not in team_a)
        team_a, team_b = _normalized_team(team_a, team_b)
        rating_a = sum(team_rating(p) for p in team_a)
        rating_b = sum(team_rating(p) for p in team_b)
        diff = rating_a - rating_b
        interaction_penalty = (
            synergy_penalty(model.interactions, venue, list(team_a), cfg)
            + synergy_penalty(model.interactions, venue, list(team_b), cfg)
            + domination_penalty(model.interactions, venue, list(team_a), list(team_b), cfg)
            + role_balance_penalty(
                {p.name: p.role_tendencies for p in model.all_players(participants)},
                list(team_a),
                list(team_b),
                cfg,
            )
            + _top_penalty(list(team_a), list(team_b), rating_map, cfg)
        )
        score = abs(diff) + interaction_penalty
        candidates.append(
            {
                "team_a": list(team_a),
                "team_b": list(team_b),
                "d_hat": diff,
                "score": score,
            }
        )

    candidates.sort(key=lambda item: (item["score"], abs(item["d_hat"]), item["team_a"]))
    selected = []
    for candidate in candidates:
        if not selected:
            selected.append(candidate)
            if len(selected) == top_n:
                break
            continue
        ok = True
        for chosen in selected:
            overlap = len(set(candidate["team_a"]) & set(chosen["team_a"]))
            min_diff = max(1, cfg.teamgen_overlap_min_diff)
            if overlap > team_size - min_diff:
                ok = False
                break
        if ok:
            selected.append(candidate)
            if len(selected) == top_n:
                break
    if len(selected) < top_n:
        seen = {_normalize_split(c["team_a"], c["team_b"]) for c in selected}
        for candidate in candidates:
            norm = _normalize_split(candidate["team_a"], candidate["team_b"])
            if norm in seen:
                continue
            selected.append(candidate)
            seen.add(norm)
            if len(selected) == top_n:
                break
    return selected


def suggest_quick_swaps(
    model: ModelState,
    base_split: dict,
    other_splits: List[dict],
    venue: str,
    top_n: int = 3,
) -> List[dict]:
    base_eval = evaluate_split(model, base_split["team_a"], base_split["team_b"], venue)
    forbidden = {_normalize_split(s["team_a"], s["team_b"]) for s in other_splits}
    forbidden.add(_normalize_split(base_split["team_a"], base_split["team_b"]))

    swaps = []
    for a in base_split["team_a"]:
        for b in base_split["team_b"]:
            team_a = [p for p in base_split["team_a"] if p != a] + [b]
            team_b = [p for p in base_split["team_b"] if p != b] + [a]
            if _normalize_split(team_a, team_b) in forbidden:
                continue
            eval_split = evaluate_split(model, team_a, team_b, venue)
            score_delta = eval_split["score"] - base_eval["score"]
            abs_diff_delta = abs(eval_split["d_hat"]) - abs(base_eval["d_hat"])
            comp_delta = {
                "syn": eval_split["components"]["syn"] - base_eval["components"]["syn"],
                "dom": eval_split["components"]["dom"] - base_eval["components"]["dom"],
                "role": eval_split["components"]["role"] - base_eval["components"]["role"],
                "top": eval_split["components"]["top"] - base_eval["components"]["top"],
            }
            swaps.append(
                {
                    "swap": (a, b),
                    "team_a": eval_split["team_a"],
                    "team_b": eval_split["team_b"],
                    "d_hat": eval_split["d_hat"],
                    "score": eval_split["score"],
                    "score_delta": score_delta,
                    "abs_diff_delta": abs_diff_delta,
                    "comp_delta": comp_delta,
                }
            )

    swaps.sort(key=lambda s: (s["score_delta"], abs(s["abs_diff_delta"])))
    return swaps[:top_n]
