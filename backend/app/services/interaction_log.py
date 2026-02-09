from team_model.team_model import ModelState as TeamModelState

from ..models import InteractionLog


def log_interaction_diffs(
    db,
    context_id: int,
    prev_state: TeamModelState,
    next_state: TeamModelState,
    *,
    match_id: int | None = None,
    source: str = "feedback",
) -> None:
    def _diff_map(prev_map: dict, next_map: dict) -> dict:
        keys = set(prev_map.keys()) | set(next_map.keys())
        return {key: (prev_map.get(key, 0.0), next_map.get(key, 0.0)) for key in keys}

    threshold = 1e-6
    prev_syn = prev_state.interactions.synergy
    next_syn = next_state.interactions.synergy
    for venue in set(prev_syn.keys()) | set(next_syn.keys()):
        for key, (before, after) in _diff_map(prev_syn.get(venue, {}), next_syn.get(venue, {})).items():
            if abs(after - before) <= threshold:
                continue
            players = list(key)
            if len(players) != 2:
                continue
            db.add(
                InteractionLog(
                    context_id=context_id,
                    match_id=match_id,
                    venue=venue,
                    kind="synergy",
                    player_a=str(players[0]),
                    player_b=str(players[1]),
                    value_before=before,
                    value_after=after,
                    source=source,
                )
            )

    prev_dom = prev_state.interactions.domination
    next_dom = next_state.interactions.domination
    for venue in set(prev_dom.keys()) | set(next_dom.keys()):
        for key, (before, after) in _diff_map(prev_dom.get(venue, {}), next_dom.get(venue, {})).items():
            if abs(after - before) <= threshold:
                continue
            if not isinstance(key, tuple) or len(key) != 2:
                continue
            db.add(
                InteractionLog(
                    context_id=context_id,
                    match_id=match_id,
                    venue=venue,
                    kind="domination",
                    player_a=str(key[0]),
                    player_b=str(key[1]),
                    value_before=before,
                    value_after=after,
                    source=source,
                )
            )
