from .config import Config
from .types import InteractionState, RoleFeedback

GLOBAL_KEY = "__global__"


def add_synergy(interactions: InteractionState, venue: str, player_a: str, player_b: str, value: float) -> None:
    interactions.add_syn(venue, player_a, player_b, value)
    interactions.add_syn(GLOBAL_KEY, player_a, player_b, value)


def add_domination(interactions: InteractionState, venue: str, dominator: str, dominated: str, value: float) -> None:
    interactions.add_dom(venue, dominator, dominated, value)
    interactions.add_dom(GLOBAL_KEY, dominator, dominated, value)


def apply_role_feedback(player_roles: dict, feedback: RoleFeedback) -> None:
    player_roles[feedback.role] = player_roles.get(feedback.role, 0.0) + feedback.weight


def _combined_syn(interactions: InteractionState, venue: str, player_a: str, player_b: str, cfg: Config) -> float:
    venue_val = interactions.get_syn(venue, player_a, player_b)
    global_val = interactions.get_syn(GLOBAL_KEY, player_a, player_b)
    return cfg.rating_eff_venue_weight * venue_val + cfg.rating_eff_global_weight * global_val


def _combined_dom(interactions: InteractionState, venue: str, dominator: str, dominated: str, cfg: Config) -> float:
    venue_val = interactions.get_dom(venue, dominator, dominated)
    global_val = interactions.get_dom(GLOBAL_KEY, dominator, dominated)
    return cfg.rating_eff_venue_weight * venue_val + cfg.rating_eff_global_weight * global_val


def synergy_penalty(interactions: InteractionState, venue: str, team: list[str], cfg: Config) -> float:
    penalty = 0.0
    for i, player_a in enumerate(team):
        for player_b in team[i + 1 :]:
            penalty += _combined_syn(interactions, venue, player_a, player_b, cfg)
    return penalty * cfg.teamgen_synergy_weight


def domination_penalty(interactions: InteractionState, venue: str, team_a: list[str], team_b: list[str], cfg: Config) -> float:
    penalty = 0.0
    for a in team_a:
        for b in team_b:
            penalty += _combined_dom(interactions, venue, a, b, cfg)
            penalty += _combined_dom(interactions, venue, b, a, cfg)
    return penalty * cfg.teamgen_domination_weight


def role_balance_penalty(roles: dict[str, dict[str, float]], team_a: list[str], team_b: list[str], cfg: Config) -> float:
    def sum_role(players: list[str], role: str) -> float:
        return sum(roles.get(p, {}).get(role, 0.0) for p in players)

    attack_a = sum_role(team_a, "attack")
    attack_b = sum_role(team_b, "attack")
    defense_a = sum_role(team_a, "defense")
    defense_b = sum_role(team_b, "defense")
    return (abs(attack_a - attack_b) + abs(defense_a - defense_b)) * cfg.teamgen_role_weight
