#!/usr/bin/env python3
"""Test quick swap suggestions on Game 6 setup."""
from __future__ import annotations

from collections import Counter
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from team_model import Config, Match, ModelState, Segment
from team_model.learning import update_from_match
from team_model.teamgen import generate_teams, suggest_quick_swaps


def make_match(match_id: str, venue: str, team_a: list[str], team_b: list[str], d_fact: int) -> Match:
    goals_a = d_fact if d_fact > 0 else 0
    goals_b = abs(d_fact) if d_fact < 0 else 0
    return Match(
        venue=venue,
        team_a=team_a,
        team_b=team_b,
        segments=[Segment(goals_a=goals_a, goals_b=goals_b, segment_index=0, is_butt_game=False)],
        events=[],
    )


def main() -> None:
    cfg = Config()
    model = ModelState.empty(cfg)

    tier_bonus = {
        "ЕгорГ": 115.0,
        "Майор": 85.0,
        "Ванек": 95.0,
        "Максон": 60.0,
        "Юра": 55.0,
        "ЕгорИ": 45.0,
        "Паша": 45.0,
        "Игорь": 45.0,
        "Виталик": 30.0,
        "Данек": -110.0,
    }
    model.tier_bonus = tier_bonus

    historical_matches = [
        {
            "match_id": "game1",
            "venue": "зал1",
            "team_a": ["Паша", "Виталик", "Юра", "Игорь", "ВаняБ"],
            "team_b": ["ЕгорГ", "ЕгорИ", "Майор", "Максон", "Данек"],
            "d_fact": -5,
        },
        {
            "match_id": "game2",
            "venue": "зал1",
            "team_a": ["Паша", "Майор", "ЕгорИ", "Рома"],
            "team_b": ["Максон", "Ванек", "Мотя", "ВаняБ"],
            "d_fact": -1,
        },
        {
            "match_id": "game3",
            "venue": "зал2",
            "team_a": ["Юра", "Игорь", "Виталик", "Курк", "Чел"],
            "team_b": ["Паша", "Майор", "Максон", "ЕгорГ", "Мотя"],
            "d_fact": -6,
        },
        {
            "match_id": "game4",
            "venue": "зал2",
            "team_a": ["Юра", "Паша", "Майор", "ЕгорИ", "Мотя", "Ванек"],
            "team_b": ["Игорь", "Виталик", "ЕгорГ", "Максон", "Данек", "Тёма"],
            "d_fact": 4,
        },
        {
            "match_id": "game5",
            "venue": "зал2",
            "team_a": ["Паша", "Максон", "ЕгорГ", "Тёма", "Ванек"],
            "team_b": ["Юра", "Игорь", "Виталик", "Майор", "Мотя"],
            "d_fact": 5,
        },
    ]

    games_played = Counter()
    for data in historical_matches:
        match = make_match(
            match_id=data["match_id"],
            venue=data["venue"],
            team_a=data["team_a"],
            team_b=data["team_b"],
            d_fact=data["d_fact"],
        )
        update_from_match(model, match)
        games_played.update(match.team_a)
        games_played.update(match.team_b)

    participants = ["Паша", "Майор", "ЕгорГ", "Максон", "ЕгорИ", "Виталик", "Юра", "Игорь", "Ванек", "Данек"]
    venue_for_game6 = "зал1"

    splits = generate_teams(model, participants, venue_for_game6, top_n=3)
    for idx, split in enumerate(splits, start=1):
        label = "Вариант 1" if idx == 1 else f"Вариант {idx}"
        print(label)
        print(f"  A: {split['team_a']}")
        print(f"  B: {split['team_b']}")
        print(f"  d_hat={split['d_hat']:.2f} score={split['score']:.3f}")

        swaps = suggest_quick_swaps(model, split, [s for s in splits if s is not split], venue_for_game6, top_n=3)
        print("  Быстрые замены:")
        for swap in swaps:
            a, b = swap["swap"]
            print(
                f"    {a} <-> {b}: d_hat={swap['d_hat']:.2f} score={swap['score']:.3f} (+{swap['score_delta']:.3f})"
            )
            reasons = []
            if swap["abs_diff_delta"] > 0.1:
                reasons.append(f"общая сила +{swap['abs_diff_delta']:.2f}")
            if swap["comp_delta"]["syn"] > 0.01:
                reasons.append(f"сыгранность +{swap['comp_delta']['syn']:.3f}")
            if swap["comp_delta"]["dom"] > 0.01:
                reasons.append(f"доминирование +{swap['comp_delta']['dom']:.3f}")
            if swap["comp_delta"]["role"] > 0.01:
                reasons.append(f"роли +{swap['comp_delta']['role']:.3f}")
            if swap["comp_delta"]["top"] > 0.01:
                reasons.append(f"топ-стек +{swap['comp_delta']['top']:.3f}")
            print(f"      причина: {'; '.join(reasons) if reasons else 'почти без ухудшения'}")
        print()


if __name__ == "__main__":
    main()
