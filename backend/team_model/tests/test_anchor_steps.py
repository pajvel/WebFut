from team_model.config import Config
from team_model.feedback import anchor_delta


def test_anchor_steps():
    cfg = Config()
    assert anchor_delta(1, cfg) == 15.0
    assert anchor_delta(2, cfg) == 17.0
    assert anchor_delta(-2, cfg) == -17.0
    assert anchor_delta(5, cfg) == 22.0
