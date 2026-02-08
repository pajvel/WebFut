from collections import defaultdict

from .config import Config
from .feedback import anchor_delta, compute_fan_rating_deltas, compute_pairwise_deltas, compute_quick_adjustments
from .match_segments import segment_weight, weighted_goal_diff
from .ratings import avg_match_rating, effective_rating
from .types import ExpandedFeedback, FanResponse, Match, MatchEvent, ModelState, QuickFeedback
from .utils import clamp
from .interactions import add_domination, add_synergy, apply_role_feedback


def _event_base(event_type: str, cfg: Config) -> float:
    if event_type == "goal":
        return cfg.event_base_goal
    if event_type == "assist":
        return cfg.event_base_assist
    return 0.0


def _event_value(event: MatchEvent, segments: list, cfg: Config) -> float:
    base = _event_base(event.event_type, cfg)
    seg = segments[event.segment_index]
    weight = segment_weight(seg.segment_index, len(segments), cfg)
    mult = cfg.butt_game_event_multiplier if seg.is_butt_game else 1.0
    return base * weight * mult


def _team_impulse(weighted_diff: float) -> float:
    abs_d = abs(weighted_diff)
    if abs_d <= 1:
        value = 60 * abs_d
    elif abs_d <= 2:
        value = 60 + 60 * (abs_d - 1)
    elif abs_d <= 3:
        value = 120 + 60 * (abs_d - 2)
    else:
        value = 180 + 40 * (abs_d - 3)
    return min(220.0, value)


def _top_player_multiplier(delta: float, r_pre: float, avg_rating: float, cfg: Config) -> float:
    if delta <= 0:
        return 1.0
    threshold = avg_rating + cfg.top_player_thresh
    if r_pre <= threshold:
        return 1.0
    excess = r_pre - threshold
    if excess <= cfg.top_player_band1:
        return cfg.top_player_mult1
    if excess <= cfg.top_player_band2:
        return cfg.top_player_mult2
    return cfg.top_player_mult3


def _guest_multiplier(guest_matches: int, cfg: Config) -> float:
    if guest_matches < 2:
        return cfg.guest_learning_mult_first2
    if guest_matches == 2:
        return cfg.guest_learning_mult_third
    return 1.0


def _apply_interactions(model: ModelState, match: Match, quick: QuickFeedback | None, expanded: ExpandedFeedback | None) -> None:
    venue = match.venue
    _apply_match_interactions(model, match)
    if quick:
        for response in quick.fan_responses:
            _apply_fan_interaction(model, venue, response)
    if expanded:
        for response in expanded.fan_responses:
            _apply_fan_interaction(model, venue, response)
        for syn in expanded.synergies:
            add_synergy(model.interactions, venue, syn.player_a, syn.player_b, syn.value)
        for dom in expanded.dominations:
            add_domination(model.interactions, venue, dom.dominator, dom.dominated, dom.value)
        for role in expanded.role_impressions:
            player = model.players.get(role.player)
            if player:
                apply_role_feedback(player.role_tendencies, role)


def _apply_match_interactions(model: ModelState, match: Match) -> None:
    cfg = model.config
    venue = match.venue
    weighted_diff = weighted_goal_diff(match.segments, cfg)
    if weighted_diff == 0:
        return
    winners = match.team_a if weighted_diff > 0 else match.team_b
    losers = match.team_b if weighted_diff > 0 else match.team_a

    for i, player_a in enumerate(winners):
        for player_b in winners[i + 1 :]:
            add_synergy(model.interactions, venue, player_a, player_b, cfg.auto_synergy_win)
    for i, player_a in enumerate(losers):
        for player_b in losers[i + 1 :]:
            add_synergy(model.interactions, venue, player_a, player_b, -cfg.auto_synergy_win)

    for winner in winners:
        for loser in losers:
            add_domination(model.interactions, venue, winner, loser, cfg.auto_domination_win)
            add_domination(model.interactions, venue, loser, winner, -cfg.auto_domination_win)

    assist_queue: dict[tuple[str, int], list[str]] = {}
    for event in match.events:
        key = (event.team, event.segment_index)
        if event.event_type == "assist":
            assist_queue.setdefault(key, []).append(event.player)
        elif event.event_type == "goal":
            assistants = assist_queue.get(key)
            if assistants:
                assister = assistants.pop(0)
                add_synergy(model.interactions, venue, event.player, assister, cfg.auto_synergy_goal_assist)


def _apply_fan_interaction(model: ModelState, venue: str, response: FanResponse) -> None:
    if response.interaction_type == "synergy" and response.related_player:
        add_synergy(model.interactions, venue, response.player, response.related_player, 1.0 * response.polarity)
    elif response.interaction_type == "domination" and response.related_player:
        add_domination(model.interactions, venue, response.player, response.related_player, 1.0 * response.polarity)
    elif response.interaction_type == "role" and response.role:
        player = model.players.get(response.player)
        if player:
            player.role_tendencies[response.role] = player.role_tendencies.get(response.role, 0.0) + response.polarity


def update_from_match(
    model: ModelState,
    match: Match,
    quick_feedback: QuickFeedback | None = None,
    expanded_feedback: ExpandedFeedback | None = None,
) -> dict[str, float]:
    cfg: Config = model.config
    venue = match.venue

    existing_players = [model.players[p] for p in match.participants if p in model.players]
    avg_existing = avg_match_rating(existing_players, venue, cfg) if existing_players else cfg.global_start_rating

    for name in match.participants:
        is_guest = name in match.guests
        if name not in model.players:
            if is_guest:
                initial = clamp(avg_existing - cfg.guest_initial_offset, cfg.guest_initial_min, cfg.guest_initial_max)
            else:
                initial = cfg.global_start_rating
            model.ensure_player(name, venue, initial, is_guest)
        else:
            model.players[name].ensure_venue(venue, cfg.venue_start_rating)

    players = model.all_players(match.participants)
    avg_rating = avg_match_rating(players, venue, cfg)

    weighted_diff = weighted_goal_diff(match.segments, cfg)
    impulse = _team_impulse(weighted_diff)
    team_a_impulse = impulse if weighted_diff > 0 else -impulse
    team_b_impulse = -team_a_impulse

    base_delta_a = team_a_impulse / len(match.team_a)
    base_delta_b = team_b_impulse / len(match.team_b)

    losing_team = None
    if team_a_impulse < 0:
        losing_team = set(match.team_a)
    elif team_b_impulse < 0:
        losing_team = set(match.team_b)

    losing_weights: dict[str, float] = {}
    if losing_team:
        losing_players = [p for p in players if p.name in losing_team]
        total = sum(effective_rating(p, venue, cfg) for p in losing_players)
        if total > 0:
            for p in losing_players:
                losing_weights[p.name] = effective_rating(p, venue, cfg) / total

    event_bonus: dict[str, float] = defaultdict(float)
    for event in match.events:
        event_bonus[event.player] += _event_value(event, match.segments, cfg) * cfg.event_scale

    quick_adjustments = compute_quick_adjustments(quick_feedback, cfg) if quick_feedback else {}

    deltas: dict[str, float] = {}
    for player in players:
        if player.name in match.team_a:
            base_delta = base_delta_a
        else:
            base_delta = base_delta_b
        if losing_team and player.name in losing_team and losing_weights:
            base_delta = (team_a_impulse if player.name in match.team_a else team_b_impulse) * losing_weights[player.name]
        quick_adj = quick_adjustments.get(player.name, 0.0)
        quick_cap = abs(base_delta) * cfg.quick_adjustment_cap_pct
        quick_adj = clamp(quick_adj, -quick_cap, quick_cap) if quick_cap > 0 else 0.0
        raw_delta = base_delta + event_bonus.get(player.name, 0.0) + quick_adj

        r_pre = effective_rating(player, venue, cfg)
        raw_delta *= _top_player_multiplier(raw_delta, r_pre, avg_rating, cfg)

        if player.is_guest:
            raw_delta *= _guest_multiplier(player.guest_matches, cfg)

        cap = avg_rating * cfg.cap_pct
        final_delta = clamp(raw_delta, -cap, cap)
        deltas[player.name] = final_delta

    for player in players:
        delta = deltas[player.name]
        player.global_rating += delta
        player.venue_ratings[venue] = player.venue_ratings.get(venue, cfg.venue_start_rating) + delta
        if player.is_guest:
            player.guest_matches += 1

    _apply_interactions(model, match, quick_feedback, expanded_feedback)
    return deltas


def update_from_match_with_breakdown(
    model: ModelState,
    match: Match,
    quick_feedback: QuickFeedback | None = None,
    expanded_feedback: ExpandedFeedback | None = None,
) -> tuple[dict[str, float], dict[str, dict[str, float]]]:
    cfg: Config = model.config
    venue = match.venue

    existing_players = [model.players[p] for p in match.participants if p in model.players]
    avg_existing = avg_match_rating(existing_players, venue, cfg) if existing_players else cfg.global_start_rating

    for name in match.participants:
        is_guest = name in match.guests
        if name not in model.players:
            if is_guest:
                initial = clamp(avg_existing - cfg.guest_initial_offset, cfg.guest_initial_min, cfg.guest_initial_max)
            else:
                initial = cfg.global_start_rating
            model.ensure_player(name, venue, initial, is_guest)
        else:
            model.players[name].ensure_venue(venue, cfg.venue_start_rating)

    players = model.all_players(match.participants)
    avg_rating = avg_match_rating(players, venue, cfg)

    weighted_diff = weighted_goal_diff(match.segments, cfg)
    impulse = _team_impulse(weighted_diff)
    team_a_impulse = impulse if weighted_diff > 0 else -impulse
    team_b_impulse = -team_a_impulse

    base_delta_a = team_a_impulse / len(match.team_a)
    base_delta_b = team_b_impulse / len(match.team_b)

    losing_team = None
    if team_a_impulse < 0:
        losing_team = set(match.team_a)
    elif team_b_impulse < 0:
        losing_team = set(match.team_b)

    losing_weights: dict[str, float] = {}
    if losing_team:
        losing_players = [p for p in players if p.name in losing_team]
        total = sum(effective_rating(p, venue, cfg) for p in losing_players)
        if total > 0:
            for p in losing_players:
                losing_weights[p.name] = effective_rating(p, venue, cfg) / total

    event_bonus: dict[str, float] = defaultdict(float)
    goal_bonus: dict[str, float] = defaultdict(float)
    assist_bonus: dict[str, float] = defaultdict(float)
    for event in match.events:
        value = _event_value(event, match.segments, cfg) * cfg.event_scale
        event_bonus[event.player] += value
        if event.event_type == "goal":
            goal_bonus[event.player] += value
        elif event.event_type == "assist":
            assist_bonus[event.player] += value

    quick_adjustments = compute_quick_adjustments(quick_feedback, cfg) if quick_feedback else {}
    anchor_deltas: dict[str, float] = {}
    pairwise_deltas: dict[str, float] = {}
    fan_deltas: dict[str, float] = {}
    if quick_feedback:
        for player, anchor in quick_feedback.anchors.items():
            net = anchor.mvp - anchor.brought_down
            anchor_deltas[player] = anchor_deltas.get(player, 0.0) + anchor_delta(net, cfg)
        pairwise_deltas = compute_pairwise_deltas(quick_feedback.pairwise, cfg)
        fan_deltas = compute_fan_rating_deltas(quick_feedback.fan_responses, cfg)

    deltas: dict[str, float] = {}
    breakdown: dict[str, dict[str, float]] = {}
    for player in players:
        if player.name in match.team_a:
            base_delta = base_delta_a
        else:
            base_delta = base_delta_b
        if losing_team and player.name in losing_team and losing_weights:
            base_delta = (team_a_impulse if player.name in match.team_a else team_b_impulse) * losing_weights[player.name]
        quick_adj = quick_adjustments.get(player.name, 0.0)
        quick_cap = abs(base_delta) * cfg.quick_adjustment_cap_pct
        quick_adj = clamp(quick_adj, -quick_cap, quick_cap) if quick_cap > 0 else 0.0
        raw_delta = base_delta + event_bonus.get(player.name, 0.0) + quick_adj

        r_pre = effective_rating(player, venue, cfg)
        raw_delta *= _top_player_multiplier(raw_delta, r_pre, avg_rating, cfg)

        if player.is_guest:
            raw_delta *= _guest_multiplier(player.guest_matches, cfg)

        cap = avg_rating * cfg.cap_pct
        final_delta = clamp(raw_delta, -cap, cap)
        deltas[player.name] = final_delta
        breakdown[player.name] = {
            "result_delta": base_delta,
            "event_delta": event_bonus.get(player.name, 0.0),
            "goal_delta": goal_bonus.get(player.name, 0.0),
            "assist_delta": assist_bonus.get(player.name, 0.0),
            "quick_delta": quick_adj,
            "mvp_delta": anchor_deltas.get(player.name, 0.0),
            "pairwise_delta": pairwise_deltas.get(player.name, 0.0),
            "fan_delta": fan_deltas.get(player.name, 0.0),
            "raw_delta": raw_delta,
            "cap": cap,
            "final_delta": final_delta,
        }

    for player in players:
        delta = deltas[player.name]
        player.global_rating += delta
        player.venue_ratings[venue] = player.venue_ratings.get(venue, cfg.venue_start_rating) + delta
        if player.is_guest:
            player.guest_matches += 1

    _apply_interactions(model, match, quick_feedback, expanded_feedback)
    return deltas, breakdown
