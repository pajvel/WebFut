from .config import Config
from .types import PlayerState
from .utils import mean


def effective_rating(player: PlayerState, venue: str, cfg: Config) -> float:
    venue_rating = player.get_venue_rating(venue, cfg.venue_start_rating)
    return cfg.rating_eff_venue_weight * venue_rating + cfg.rating_eff_global_weight * player.global_rating


def avg_match_rating(players: list[PlayerState], venue: str, cfg: Config) -> float:
    return mean(effective_rating(p, venue, cfg) for p in players)
