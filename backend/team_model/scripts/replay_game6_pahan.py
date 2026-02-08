#!/usr/bin/env python3
"""Replay 5 matches and show venue-specific ratings + top splits for game 6."""
from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from team_model import Config, Match, ModelState, Segment, generate_teams, update_from_match
from team_model.ratings import effective_rating


def make_match(match_id: str, venue: str, team_a: list[str], team_b: list[str], d_fact: int) -> Match:
    goals_a = max(d_fact, 0)
    goals_b = max(-d_fact, 0)
    return Match(
        venue=venue,
        team_a=team_a,
        team_b=team_b,
        segments=[Segment(goals_a, goals_b, 0, False)],
    )


def main() -> None:
    cfg = Config()
    model = ModelState.empty(cfg)

    matches = [
        make_match("game1", "V1", ["P1", "P2", "P3"], ["P4", "P5", "P6"], d_fact=-2),
        make_match("game2", "V1", ["P1", "P4", "P5"], ["P2", "P3", "P6"], d_fact=1),
        make_match("game3", "V2", ["P1", "P2", "P4"], ["P3", "P5", "P6"], d_fact=-3),
        make_match("game4", "V2", ["P1", "P3", "P6"], ["P2", "P4", "P5"], d_fact=2),
        make_match("game5", "V2", ["P1", "P4", "P6"], ["P2", "P3", "P5"], d_fact=-1),
    ]

    for match in matches:
        update_from_match(model, match)

    participants = ["P1", "P2", "P3", "P4", "P5", "P6"]
    venue = "V1"

    print("=" * 70)
    print("Game 6: venue V1 effective ratings (60/40)")
    print("=" * 70)
    rows = []
    for name in participants:
        player = model.players[name]
        rows.append((name, effective_rating(player, venue, cfg)))
    rows.sort(key=lambda item: item[1], reverse=True)
    for name, rating in rows:
        print(f"{name:>4}: {rating:7.1f}")
    print()

    splits = generate_teams(model, participants, venue, top_n=3)
    print("=" * 70)
    print("Top 3 splits")
    print("=" * 70)
    for idx, split in enumerate(splits, start=1):
        team_a = ", ".join(split["team_a"])
        team_b = ", ".join(split["team_b"])
        print(f"#{idx}: A=[{team_a}]  B=[{team_b}]  d_hat={split['d_hat']:.1f}")
    print()


if __name__ == "__main__":
    main()
