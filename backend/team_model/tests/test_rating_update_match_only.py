from team_model import Config, Match, ModelState, Segment, update_from_match


def test_rating_update_match_only():
    cfg = Config()
    model = ModelState.empty(cfg)
    match = Match(
        venue="V1",
        team_a=["A", "B"],
        team_b=["C", "D"],
        segments=[Segment(2, 0, 0, False)],
    )

    deltas = update_from_match(model, match)
    assert deltas["A"] == 60.0
    assert deltas["C"] == -60.0
    assert model.players["A"].global_rating == 1060.0
    assert model.players["A"].venue_ratings["V1"] == 1060.0
