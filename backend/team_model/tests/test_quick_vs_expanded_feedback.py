from team_model import Config, ExpandedFeedback, Match, ModelState, Segment, update_from_match
from team_model.types import FanResponse, SynergyFeedback


def test_expanded_feedback_no_rating_change():
    cfg = Config()
    match = Match(
        venue="V1",
        team_a=["A", "B"],
        team_b=["C", "D"],
        segments=[Segment(1, 0, 0, False)],
    )

    model_plain = ModelState.empty(cfg)
    deltas_plain = update_from_match(model_plain, match)

    model_expanded = ModelState.empty(cfg)
    expanded = ExpandedFeedback(
        fan_responses=[FanResponse(player="A", polarity=1, interaction_type="synergy", related_player="B")],
        synergies=[SynergyFeedback(player_a="A", player_b="B", value=2.0)],
    )
    deltas_expanded = update_from_match(model_expanded, match, expanded_feedback=expanded)

    assert deltas_plain == deltas_expanded
