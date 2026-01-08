from team_model import Config, ModelState
from team_model.teamgen import generate_teams
from team_model.types import PlayerState


def test_teamgen_basic_balance():
    cfg = Config()
    model = ModelState.empty(cfg)
    model.players["A"] = PlayerState("A", 1100.0, {"V1": 1100.0})
    model.players["B"] = PlayerState("B", 1000.0, {"V1": 1000.0})
    model.players["C"] = PlayerState("C", 1000.0, {"V1": 1000.0})
    model.players["D"] = PlayerState("D", 900.0, {"V1": 900.0})

    splits = generate_teams(model, ["A", "B", "C", "D"], "V1", top_n=3)
    best = splits[0]
    assert abs(best["d_hat"]) <= abs(splits[-1]["d_hat"])
