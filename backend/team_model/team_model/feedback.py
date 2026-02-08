from .config import Config
from .types import FanResponse, PairwiseComparison, QuickFeedback
from .utils import clamp


def anchor_delta(net_votes: int, cfg: Config) -> float:
    if net_votes == 0:
        return 0.0
    steps = []
    for idx in range(1, abs(net_votes) + 1):
        if idx == 1:
            steps.append(cfg.anchor_step1)
        elif idx <= 4:
            steps.append(cfg.anchor_step2_to_4)
        else:
            steps.append(cfg.anchor_step5_plus)
    total = sum(steps)
    return total if net_votes > 0 else -total


def compute_pairwise_deltas(pairwise: list[PairwiseComparison], cfg: Config) -> dict[str, float]:
    deltas: dict[str, float] = {}
    for comp in pairwise:
        deltas[comp.stronger] = deltas.get(comp.stronger, 0.0) + cfg.pairwise_delta
        deltas[comp.weaker] = deltas.get(comp.weaker, 0.0) - cfg.pairwise_delta
    for player, value in list(deltas.items()):
        deltas[player] = clamp(value, -cfg.pairwise_clamp, cfg.pairwise_clamp)
    return deltas


def compute_fan_rating_deltas(responses: list[FanResponse], cfg: Config) -> dict[str, float]:
    deltas: dict[str, float] = {}
    for response in responses:
        if response.interaction_type == "guest_peer":
            continue
        value = cfg.fan_delta if response.polarity > 0 else -cfg.fan_delta
        deltas[response.player] = deltas.get(response.player, 0.0) + value
    for player, value in list(deltas.items()):
        deltas[player] = clamp(value, -cfg.fan_clamp, cfg.fan_clamp)
    return deltas


def compute_quick_adjustments(quick: QuickFeedback, cfg: Config) -> dict[str, float]:
    deltas: dict[str, float] = {}
    for player, anchor in quick.anchors.items():
        net = anchor.mvp - anchor.brought_down
        deltas[player] = deltas.get(player, 0.0) + anchor_delta(net, cfg)
    pairwise = compute_pairwise_deltas(quick.pairwise, cfg)
    for player, value in pairwise.items():
        deltas[player] = deltas.get(player, 0.0) + value
    fan = compute_fan_rating_deltas(quick.fan_responses, cfg)
    for player, value in fan.items():
        deltas[player] = deltas.get(player, 0.0) + value
    return deltas
