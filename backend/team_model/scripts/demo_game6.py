from team_model import Config, Match, ModelState, Segment, update_from_match, generate_teams
from team_model.ratings import effective_rating


def main() -> None:
    cfg = Config()
    model = ModelState.empty(cfg)

    players = ["Alex", "Ben", "Chen", "Dana", "Eli", "Fran"]

    matches = [
        Match(
            venue="V1",
            team_a=["Alex", "Ben", "Chen"],
            team_b=["Dana", "Eli", "Fran"],
            segments=[Segment(3, 1, 0, False)],
        ),
        Match(
            venue="V1",
            team_a=["Alex", "Dana", "Eli"],
            team_b=["Ben", "Chen", "Fran"],
            segments=[Segment(1, 2, 0, False)],
        ),
        Match(
            venue="V2",
            team_a=["Alex", "Ben", "Dana"],
            team_b=["Chen", "Eli", "Fran"],
            segments=[Segment(0, 2, 0, False)],
        ),
        Match(
            venue="V2",
            team_a=["Alex", "Chen", "Fran"],
            team_b=["Ben", "Dana", "Eli"],
            segments=[Segment(4, 1, 0, True)],
        ),
        Match(
            venue="V2",
            team_a=["Alex", "Dana", "Fran"],
            team_b=["Ben", "Chen", "Eli"],
            segments=[Segment(1, 3, 0, False)],
        ),
    ]

    for match in matches:
        update_from_match(model, match)

    print("Venue V1 effective ratings for Game 6 participants:")
    ratings = []
    for name in players:
        player = model.players[name]
        ratings.append((name, effective_rating(player, "V1", cfg)))
    for name, rating in sorted(ratings, key=lambda item: item[1], reverse=True):
        print(f"{name:>6}: {rating:7.1f}")

    print("\nTop 3 splits for V1:")
    splits = generate_teams(model, players, "V1", top_n=3)
    for idx, split in enumerate(splits, start=1):
        team_a = ", ".join(split["team_a"])
        team_b = ", ".join(split["team_b"])
        print(f"Option {idx}: A=[{team_a}]  B=[{team_b}]  d_hat={split['d_hat']:.1f}")


if __name__ == "__main__":
    main()
