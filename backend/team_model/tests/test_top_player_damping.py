from team_model import Config, Match, ModelState, Segment, update_from_match
from team_model.types import PlayerState


def test_top_player_damping():
    cfg = Config()
    model = ModelState.empty(cfg)
    model.players["Star"] = PlayerState("Star", 1700.0, {"V1": 1700.0})
    model.players["A"] = PlayerState("A", 1000.0, {"V1": 1000.0})
    model.players["B"] = PlayerState("B", 1000.0, {"V1": 1000.0})
    model.players["C"] = PlayerState("C", 1000.0, {"V1": 1000.0})

    match = Match(
        venue="V1",
        team_a=["Star", "A"],
        team_b=["B", "C"],
        segments=[Segment(1, 0, 0, False)],
    )

    deltas = update_from_match(model, match)
    assert deltas["Star"] < deltas["A"]
