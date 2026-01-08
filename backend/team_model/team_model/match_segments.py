from .config import Config
from .types import Segment


def segment_weight(index: int, total: int, cfg: Config) -> float:
    if total <= 1:
        return cfg.segment_weight_last
    if index == 0:
        return cfg.segment_weight_first
    if index == total - 1:
        return cfg.segment_weight_last
    return cfg.segment_weight_middle


def weighted_goal_diff(segments: list[Segment], cfg: Config) -> float:
    total = len(segments)
    result = 0.0
    for seg in segments:
        diff = seg.goals_a - seg.goals_b
        weight = segment_weight(seg.segment_index, total, cfg)
        mult = cfg.butt_game_segment_multiplier if seg.is_butt_game else 1.0
        result += diff * weight * mult
    return result
