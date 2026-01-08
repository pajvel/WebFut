from team_model import Config, Match, ModelState, Segment, update_from_match


def test_cap_applied():
    cfg = Config()
    model = ModelState.empty(cfg)
    match = Match(
        venue="V1",
        team_a=["A", "B"],
        team_b=["C", "D"],
        segments=[Segment(3, 0, 0, False)],
    )

    deltas = update_from_match(model, match)
    assert deltas["A"] == 80.0
    assert deltas["C"] == -80.0
