from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    global_start_rating: float = 1000.0
    venue_start_rating: float = 1000.0

    rating_eff_venue_weight: float = 0.60
    rating_eff_global_weight: float = 0.40

    segment_weight_first: float = 0.3
    segment_weight_middle: float = 0.6
    segment_weight_last: float = 1.0

    butt_game_segment_multiplier: float = 1.375
    butt_game_event_multiplier: float = 1.75

    event_base_goal: float = 10.0
    event_base_assist: float = 6.0
    event_base_key_defense: float = 0.0
    event_base_own_goal: float = 0.0
    event_base_big_mistake: float = 0.0
    event_scale: float = 0.6

    anchor_step1: float = 15.0
    anchor_step2_to_4: float = 2.0
    anchor_step5_plus: float = 1.0

    pairwise_delta: float = 4.0
    pairwise_clamp: float = 12.0

    fan_delta: float = 2.0
    fan_clamp: float = 6.0

    quick_adjustment_cap_pct: float = 0.9

    top_player_thresh: float = 500.0
    top_player_band1: float = 100.0
    top_player_band2: float = 200.0
    top_player_mult1: float = 0.9
    top_player_mult2: float = 0.75
    top_player_mult3: float = 0.6

    guest_initial_offset: float = 40.0
    guest_initial_min: float = 850.0
    guest_initial_max: float = 1150.0
    guest_learning_mult_first2: float = 1.35
    guest_learning_mult_third: float = 1.15

    cap_pct: float = 0.08

    teamgen_synergy_weight: float = 0.002
    teamgen_domination_weight: float = 0.002
    teamgen_role_weight: float = 0.01
    teamgen_overlap_min_diff: int = 2
    teamgen_top_k: int = 4
    teamgen_top_max_per_team: int = 2
    teamgen_top_penalty: float = 50.0

    auto_synergy_win: float = 0.5
    auto_domination_win: float = 0.3
    auto_synergy_goal_assist: float = 0.4
