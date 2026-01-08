from team_model import Config, Match, ModelState, Segment, update_from_match


def test_guest_learning_multiplier():
    cfg = Config()
    model = ModelState.empty(cfg)
    model.ensure_player("Regular1", "V1", cfg.global_start_rating, False)
    model.ensure_player("Regular2", "V1", cfg.global_start_rating, False)
    model.ensure_player("Regular3", "V1", cfg.global_start_rating, False)

    match = Match(
        venue="V1",
        team_a=["Guest", "Regular1"],
        team_b=["Regular2", "Regular3"],
        segments=[Segment(1, 0, 0, False)],
        guests={"Guest"},
    )

    deltas = update_from_match(model, match)
    assert model.players["Guest"].global_rating == 960.0 + deltas["Guest"]
    assert deltas["Guest"] > deltas["Regular1"]
