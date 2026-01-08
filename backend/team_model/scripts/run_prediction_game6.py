#!/usr/bin/env python3
"""Replay historical matches and predict Game 6 teams."""
from __future__ import annotations

from collections import Counter
import copy
from itertools import combinations
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from team_model import Config, Match, ModelState, Segment
from team_model.feedback import compute_quick_adjustments
from team_model.interactions import GLOBAL_KEY, domination_penalty, role_balance_penalty, synergy_penalty
from team_model.learning import update_from_match
from team_model.match_segments import segment_weight
from team_model.ratings import effective_rating
from team_model.teamgen import generate_teams, suggest_quick_swaps
from team_model.types import (
    AnchorVote,
    DominationFeedback,
    ExpandedFeedback,
    FanResponse,
    MatchEvent,
    PairwiseComparison,
    QuickFeedback,
    RoleFeedback,
    SynergyFeedback,
)


def make_match(match_id: str, venue: str, team_a: list[str], team_b: list[str], d_fact: int) -> Match:
    goals_a = d_fact if d_fact > 0 else 0
    goals_b = abs(d_fact) if d_fact < 0 else 0
    return Match(
        venue=venue,
        team_a=team_a,
        team_b=team_b,
        segments=[Segment(goals_a=goals_a, goals_b=goals_b, segment_index=0, is_butt_game=False)],
        events=[],
    )


def main() -> None:
    cfg = Config()
    model = ModelState.empty(cfg)

    tier_bonus = {
        "ЕгорГ": 115.0,
        "Майор": 85.0,
        "Ванек": 95.0,
        "Максон": 60.0,
        "Юра": 55.0,
        "ЕгорИ": 45.0,
        "Паша": 45.0,
        "Игорь": 45.0,
        "Виталик": 30.0,
        "Данек": -110.0,
    }
    model.tier_bonus = tier_bonus

    historical_matches = [
        {
            "match_id": "game1",
            "venue": "зал1",
            "team_a": ["Паша", "Виталик", "Юра", "Игорь", "ВаняБ"],
            "team_b": ["ЕгорГ", "ЕгорИ", "Майор", "Максон", "Данек"],
            "d_fact": -5,
        },
        {
            "match_id": "game2",
            "venue": "зал1",
            "team_a": ["Паша", "Майор", "ЕгорИ", "Рома"],
            "team_b": ["Максон", "Ванек", "Мотя", "ВаняБ"],
            "d_fact": -1,
        },
        {
            "match_id": "game3",
            "venue": "зал2",
            "team_a": ["Юра", "Игорь", "Виталик", "Курк", "Чел"],
            "team_b": ["Паша", "Майор", "Максон", "ЕгорГ", "Мотя"],
            "d_fact": -6,
        },
        {
            "match_id": "game4",
            "venue": "зал2",
            "team_a": ["Юра", "Паша", "Майор", "ЕгорИ", "Мотя", "Ванек"],
            "team_b": ["Игорь", "Виталик", "ЕгорГ", "Максон", "Данек", "Тёма"],
            "d_fact": 4,
        },
        {
            "match_id": "game5",
            "venue": "зал2",
            "team_a": ["Паша", "Максон", "ЕгорГ", "Тёма", "Ванек"],
            "team_b": ["Юра", "Игорь", "Виталик", "Майор", "Мотя"],
            "d_fact": 5,
        },
    ]

    games_played = Counter()
    for data in historical_matches:
        match = make_match(
            match_id=data["match_id"],
            venue=data["venue"],
            team_a=data["team_a"],
            team_b=data["team_b"],
            d_fact=data["d_fact"],
        )
        update_from_match(model, match)
        games_played.update(match.team_a)
        games_played.update(match.team_b)

    participants = ["Паша", "Майор", "ЕгорГ", "Максон", "ЕгорИ", "Виталик", "Юра", "Игорь", "Ванек", "Данек"]
    venue_for_game6 = "зал1"

    print("=" * 90)
    print("Game 6: рейтинги для зала зал1 (с учетом тир-листа)")
    print("=" * 90)
    header = f"{'player':<10} {'global':>9} {'venue':>9} {'R_eff':>9} {'bonus':>6} {'games':>6}"
    print(header)
    rows = []
    for name in participants:
        player = model.players[name]
        venue_rating = player.venue_ratings.get(venue_for_game6, cfg.venue_start_rating)
        bonus = tier_bonus.get(name, 0.0)
        eff = effective_rating(player, venue_for_game6, cfg)
        rows.append((name, player.global_rating, venue_rating, eff, bonus, games_played.get(name, 0)))
    rows.sort(key=lambda item: item[3], reverse=True)
    for name, rg, rv, eff, bonus, games in rows:
        print(f"{name:<10} {rg:9.1f} {rv:9.1f} {eff:9.1f} {bonus:6.1f} {games:6d}")
    print()

    venue_syn = model.interactions.synergy.get(venue_for_game6, {})
    global_syn = model.interactions.synergy.get(GLOBAL_KEY, {})
    venue_dom = model.interactions.domination.get(venue_for_game6, {})
    global_dom = model.interactions.domination.get(GLOBAL_KEY, {})
    participants_set = set(participants)
    all_syn_pairs = set(venue_syn.keys()) | set(global_syn.keys())
    syn_filtered = {}
    for pair in all_syn_pairs:
        if not pair.issubset(participants_set):
            continue
        value = cfg.rating_eff_venue_weight * venue_syn.get(pair, 0.0) + cfg.rating_eff_global_weight * global_syn.get(pair, 0.0)
        if value != 0.0:
            syn_filtered[pair] = value

    all_dom_pairs = set(venue_dom.keys()) | set(global_dom.keys())
    dom_filtered = {}
    for pair in all_dom_pairs:
        a, b = pair
        if a not in participants_set or b not in participants_set:
            continue
        value = cfg.rating_eff_venue_weight * venue_dom.get(pair, 0.0) + cfg.rating_eff_global_weight * global_dom.get(pair, 0.0)
        if value != 0.0:
            dom_filtered[pair] = value
    syn_sorted = sorted(syn_filtered.items(), key=lambda item: item[1], reverse=True)
    dom_sorted = sorted(dom_filtered.items(), key=lambda item: item[1], reverse=True)

    print("=" * 90)
    print("Топ-2 синергии/доминации и низ-2 перед генерацией")
    print("=" * 90)
    print("Синергия (топ-2):")
    if syn_sorted:
        for pair, value in syn_sorted[:2]:
            players = ", ".join(sorted(pair))
            print(f"  {players}: {value:.2f}")
    else:
        print("  нет данных")
    print("Синергия (низ-2):")
    if len(syn_sorted) >= 2:
        for pair, value in syn_sorted[-2:]:
            players = ", ".join(sorted(pair))
            print(f"  {players}: {value:.2f}")
    elif syn_sorted:
        pair, value = syn_sorted[0]
        players = ", ".join(sorted(pair))
        print(f"  {players}: {value:.2f}")
    else:
        print("  нет данных")
    print("Доминирование (топ-2):")
    if dom_sorted:
        for (a, b), value in dom_sorted[:2]:
            print(f"  {a} > {b}: {value:.2f}")
    else:
        print("  нет данных")
    print("Доминирование (низ-2):")
    if len(dom_sorted) >= 2:
        for (a, b), value in dom_sorted[-2:]:
            print(f"  {a} > {b}: {value:.2f}")
    elif dom_sorted:
        (a, b), value = dom_sorted[0]
        print(f"  {a} > {b}: {value:.2f}")
    else:
        print("  нет данных")
    print()

    participants_sorted = sorted(participants)
    team_size = len(participants_sorted) // 2
    anchor = participants_sorted[0]
    all_splits = []
    for team_a in combinations(participants_sorted, team_size):
        if anchor not in team_a:
            continue
        team_b = tuple(p for p in participants_sorted if p not in team_a)
        rating_a = sum(effective_rating(model.players[p], venue_for_game6, cfg) for p in team_a)
        rating_b = sum(effective_rating(model.players[p], venue_for_game6, cfg) for p in team_b)
        d_hat = rating_a - rating_b
        all_splits.append((team_a, team_b, d_hat))
    all_splits.sort(key=lambda item: (abs(item[2]), item[2], item[0]))

    if all_splits:
        best_abs = abs(all_splits[0][2])
        print(f"Минимальный возможный |d_hat| (с тир-бонусом): {best_abs:.2f}")
        print("Топ-10 сплитов по |d_hat| (с тир-бонусом):")
        for team_a, team_b, d_hat in all_splits[:10]:
            print(f"A={list(team_a)}  B={list(team_b)}  d_hat={d_hat:.2f}")
        print()

    splits = generate_teams(model, participants, venue_for_game6, top_n=3)
    for idx, split in enumerate(splits, start=1):
        label = "Вариант 1 (рекомендованный)" if idx == 1 else f"Вариант {idx}"
        team_a = ", ".join(split["team_a"])
        team_b = ", ".join(split["team_b"])
        d_hat = split["d_hat"]
        score = split["score"]
        print(label + ":")
        print(f"  Команда A: {team_a}")
        print(f"  Команда B: {team_b}")
        print(f"  Прогноз разницы (d_hat): {d_hat:.2f}")
        print(f"  Модуль дисбаланса |d_hat|: {abs(d_hat):.2f}")
        print(f"  Оценка (score_total): {score:.3f}")
        print()

        swaps = suggest_quick_swaps(model, split, [s for s in splits if s is not split], venue_for_game6, top_n=3)
        if swaps:
            print("  Быстрые замены:")
            for swap in swaps:
                a, b = swap["swap"]
                reasons = []
                if swap["abs_diff_delta"] > 0.1:
                    reasons.append(f"общая сила +{swap['abs_diff_delta']:.2f}")
                if swap["comp_delta"]["syn"] > 0.01:
                    reasons.append(f"сыгранность +{swap['comp_delta']['syn']:.3f}")
                if swap["comp_delta"]["dom"] > 0.01:
                    reasons.append(f"доминирование +{swap['comp_delta']['dom']:.3f}")
                if swap["comp_delta"]["role"] > 0.01:
                    reasons.append(f"роли +{swap['comp_delta']['role']:.3f}")
                if swap["comp_delta"]["top"] > 0.01:
                    reasons.append(f"топ-стек +{swap['comp_delta']['top']:.3f}")
                reason_text = "; ".join(reasons) if reasons else "почти без ухудшения"
                print(
                    f"    swap {a} <-> {b}: d_hat={swap['d_hat']:.2f}, score={swap['score']:.3f} "
                    f"(+{swap['score_delta']:.3f})"
                )
                print(f"      причина: {reason_text}")
            print()

    custom_team_a = ["Ванек", "Майор", "Юра", "Игорь", "Данек"]
    custom_team_b = [p for p in participants if p not in custom_team_a]
    players = [model.players[name] for name in participants]
    avg_rating = sum(effective_rating(p, venue_for_game6, cfg) for p in players) / len(players)

    def team_rating(name: str) -> float:
        player = model.players[name]
        rating = effective_rating(player, venue_for_game6, cfg)
        if player.is_guest:
            return min(rating, avg_rating)
        return rating

    rating_a = sum(team_rating(p) for p in custom_team_a)
    rating_b = sum(team_rating(p) for p in custom_team_b)
    d_hat = rating_a - rating_b
    interaction_penalty = (
        synergy_penalty(model.interactions, venue_for_game6, custom_team_a, cfg)
        + synergy_penalty(model.interactions, venue_for_game6, custom_team_b, cfg)
        + domination_penalty(model.interactions, venue_for_game6, custom_team_a, custom_team_b, cfg)
        + role_balance_penalty(
            {p.name: p.role_tendencies for p in players},
            custom_team_a,
            custom_team_b,
            cfg,
        )
    )
    score_total = abs(d_hat) + interaction_penalty
    print("Вариант 4 (ваш):")
    print(f"  Команда A: {', '.join(custom_team_a)}")
    print(f"  Команда B: {', '.join(custom_team_b)}")
    print(f"  Прогноз разницы (d_hat): {d_hat:.2f}")
    print(f"  Модуль дисбаланса |d_hat|: {abs(d_hat):.2f}")
    print(f"  Оценка (score_total): {score_total:.3f}")
    print()

    chosen = splits[0]

    print("=" * 90)
    print("Сценарий матча: выбран вариант 1, сыграли 2 сегмента (последний - жопа)")
    print("=" * 90)

    match_segments = [
        Segment(goals_a=6, goals_b=3, segment_index=0, is_butt_game=False),
        Segment(goals_a=9, goals_b=6, segment_index=1, is_butt_game=True),
    ]
    match_events = [
        MatchEvent(player=chosen["team_a"][0], team="A", event_type="goal", segment_index=0),
        MatchEvent(player=chosen["team_a"][1], team="A", event_type="goal", segment_index=0),
        MatchEvent(player=chosen["team_a"][2], team="A", event_type="goal", segment_index=0),
        MatchEvent(player=chosen["team_a"][3], team="A", event_type="goal", segment_index=0),
        MatchEvent(player=chosen["team_a"][4], team="A", event_type="goal", segment_index=0),
        MatchEvent(player=chosen["team_a"][0], team="A", event_type="goal", segment_index=0),
        MatchEvent(player=chosen["team_b"][0], team="B", event_type="goal", segment_index=0),
        MatchEvent(player=chosen["team_b"][1], team="B", event_type="goal", segment_index=0),
        MatchEvent(player=chosen["team_b"][2], team="B", event_type="goal", segment_index=0),
        MatchEvent(player=chosen["team_a"][0], team="A", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_a"][1], team="A", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_a"][2], team="A", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_a"][3], team="A", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_a"][4], team="A", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_a"][0], team="A", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_a"][1], team="A", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_a"][2], team="A", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_a"][3], team="A", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_b"][0], team="B", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_b"][1], team="B", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_b"][2], team="B", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_b"][3], team="B", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_b"][4], team="B", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_b"][0], team="B", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_b"][1], team="B", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_b"][2], team="B", event_type="goal", segment_index=1),
        MatchEvent(player=chosen["team_b"][0], team="B", event_type="goal", segment_index=1),
    ]
    match = Match(
        venue=venue_for_game6,
        team_a=chosen["team_a"],
        team_b=chosen["team_b"],
        segments=match_segments,
        events=match_events,
    )

    pre_ratings = {
        name: (
            model.players[name].global_rating,
            model.players[name].venue_ratings.get(venue_for_game6, cfg.venue_start_rating),
        )
        for name in participants
    }

    model_match_only = copy.deepcopy(model)
    model_with_feedback = copy.deepcopy(model)

    deltas_match = update_from_match(model_match_only, match)

    rng = random.Random(42)
    respondents = rng.sample(participants, k=9)
    anchors: dict[str, AnchorVote] = {}
    pairwise: list[PairwiseComparison] = []
    fan_responses: list[FanResponse] = []

    for _responder in respondents:
        mvp = rng.choice(participants)
        brought_down = rng.choice([p for p in participants if p != mvp])
        anchors[mvp] = AnchorVote(
            mvp=anchors.get(mvp, AnchorVote()).mvp + 1,
            brought_down=anchors.get(mvp, AnchorVote()).brought_down,
        )
        anchors[brought_down] = AnchorVote(
            mvp=anchors.get(brought_down, AnchorVote()).mvp,
            brought_down=anchors.get(brought_down, AnchorVote()).brought_down + 1,
        )

        for _ in range(3):
            a, b = rng.sample(participants, k=2)
            pairwise.append(PairwiseComparison(stronger=a, weaker=b))

        for _ in range(5):
            player = rng.choice(participants)
            polarity = rng.choice([1, -1])
            fan_responses.append(FanResponse(player=player, polarity=polarity))

    quick_feedback = QuickFeedback(anchors=anchors, pairwise=pairwise, fan_responses=fan_responses)
    expanded_feedback = ExpandedFeedback(
        fan_responses=[
            FanResponse(
                player=chosen["team_a"][1],
                polarity=1,
                interaction_type="synergy",
                related_player=chosen["team_a"][0],
            ),
            FanResponse(
                player=chosen["team_b"][2],
                polarity=1,
                interaction_type="domination",
                related_player=chosen["team_a"][2],
            ),
            FanResponse(player=chosen["team_b"][4], polarity=1, interaction_type="role", role="attack"),
        ],
        synergies=[SynergyFeedback(player_a=chosen["team_a"][0], player_b=chosen["team_a"][1], value=1.0)],
        dominations=[DominationFeedback(dominator=chosen["team_b"][2], dominated=chosen["team_a"][2], value=1.0)],
        role_impressions=[RoleFeedback(player=chosen["team_b"][4], role="attack", weight=1.0)],
    )
    deltas_with_feedback = update_from_match(
        model_with_feedback, match, quick_feedback=quick_feedback, expanded_feedback=expanded_feedback
    )

    print("Результат матча и дельты рейтинга:")
    print(f"  Команда A: {', '.join(chosen['team_a'])}")
    print(f"  Команда B: {', '.join(chosen['team_b'])}")
    print("  Сегменты: 2-1, затем 1-3 (жопа)")
    print()

    print("=" * 90)
    print("Почему у кого-то + / - (что произошло в матче)")
    print("=" * 90)
    for idx, seg in enumerate(match.segments, start=1):
        butt = " (жопа)" if seg.is_butt_game else ""
        print(f"Сегмент {idx}{butt}: A {seg.goals_a} - {seg.goals_b} B")
    print("События:")
    for event in match.events:
        seg = match.segments[event.segment_index]
        weight = segment_weight(seg.segment_index, len(match.segments), cfg)
        mult = cfg.butt_game_event_multiplier if seg.is_butt_game else 1.0
        print(
            f"  {event.player}: {event.event_type} (сегмент {event.segment_index + 1}) "
            f"w {weight:.2f} * m {mult:.2f}"
        )
    print("Дельты ниже рассчитаны моделью на основе результата и событий.")
    print()

    print("=" * 90)
    print("Базовые дельты (до ивентов)")
    print("=" * 90)
    weighted_diff = sum(
        (seg.goals_a - seg.goals_b)
        * segment_weight(seg.segment_index, len(match.segments), cfg)
        * (cfg.butt_game_segment_multiplier if seg.is_butt_game else 1.0)
        for seg in match.segments
    )
    abs_d = abs(weighted_diff)
    if abs_d <= 1:
        impulse_abs = 60 * abs_d
    elif abs_d <= 2:
        impulse_abs = 60 + 60 * (abs_d - 1)
    elif abs_d <= 3:
        impulse_abs = 120 + 60 * (abs_d - 2)
    else:
        impulse_abs = min(220.0, 180 + 40 * (abs_d - 3))
    team_a_impulse = impulse_abs if weighted_diff > 0 else -impulse_abs
    team_b_impulse = -team_a_impulse
    avg_rating = sum(effective_rating(model.players[p], venue_for_game6, cfg) for p in participants) / len(participants)
    cap_value = avg_rating * cfg.cap_pct
    print(f"Взвешенная разница D_weighted: {weighted_diff:.2f}")
    print(f"Импульс |D| -> {impulse_abs:.2f}, A={team_a_impulse:.2f}, B={team_b_impulse:.2f}")
    print(f"Кэп матча (avg R_eff * {cfg.cap_pct:.2f}): {cap_value:.2f}")
    print()

    losing_team = set(match.team_a) if team_a_impulse < 0 else set(match.team_b)
    losing_players = [p for p in participants if p in losing_team]
    total_losing = sum(effective_rating(model.players[p], venue_for_game6, cfg) for p in losing_players)
    weights = {
        p: effective_rating(model.players[p], venue_for_game6, cfg) / total_losing
        for p in losing_players
    }

    header = f"{'player':<10} {'base_delta':>12}"
    print(header)
    for name in participants:
        if name in match.team_a:
            base = team_a_impulse / len(match.team_a)
        else:
            base = team_b_impulse / len(match.team_b)
        if name in losing_team and weights:
            base = (team_a_impulse if name in match.team_a else team_b_impulse) * weights[name]
        print(f"{name:<10} {base:12.1f}")
    print()

    event_bonus = {name: 0.0 for name in participants}
    for event in match.events:
        seg = match.segments[event.segment_index]
        weight = segment_weight(seg.segment_index, len(match.segments), cfg)
        mult = cfg.butt_game_event_multiplier if seg.is_butt_game else 1.0
        base_value = cfg.event_base_goal if event.event_type == "goal" else cfg.event_base_assist
        event_bonus[event.player] += base_value * weight * mult * cfg.event_scale

    print("=" * 90)
    print("База + ивенты -> дельта матча (модель)")
    print("=" * 90)
    header = f"{'player':<10} {'base':>9} {'events':>9} {'raw':>9} {'final':>9}"
    print(header)
    for name in participants:
        if name in match.team_a:
            base = team_a_impulse / len(match.team_a)
        else:
            base = team_b_impulse / len(match.team_b)
        if name in losing_team and weights:
            base = (team_a_impulse if name in match.team_a else team_b_impulse) * weights[name]
        events = event_bonus.get(name, 0.0)
        raw = base + events
        final = deltas_match.get(name, 0.0)
        print(f"{name:<10} {base:9.1f} {events:9.1f} {raw:9.1f} {final:9.1f}")
    print()

    print("=" * 90)
    print("Дельты по матчу (модель, без фидбека)")
    print("=" * 90)
    header = f"{'player':<10} {'delta':>9}"
    print(header)
    for name in participants:
        print(f"{name:<10} {deltas_match.get(name, 0.0):9.1f}")
    print()

    print("=" * 90)
    print("Quick feedback (вопросы и ответы)")
    print("=" * 90)
    print("Anchors:")
    for player, anchor in quick_feedback.anchors.items():
        net = anchor.mvp - anchor.brought_down
        print(f"  {player}: MVP={anchor.mvp}, brought_down={anchor.brought_down}, net={net}")
    print("Pairwise:")
    for comp in quick_feedback.pairwise:
        print(f"  {comp.stronger} сильнее {comp.weaker}")
    print("Fan questions (rating nudge):")
    for response in quick_feedback.fan_responses:
        polarity = "+" if response.polarity > 0 else "-"
        print(f"  {response.player}: {polarity}2")
    print()

    print("=" * 90)
    print("Quick feedback (как применилось моделью)")
    print("=" * 90)
    quick_raw = compute_quick_adjustments(quick_feedback, cfg)
    header = f"{'player':<10} {'quick_raw':>9} {'cap':>9} {'quick_clamp':>12}"
    print(header)
    for name in participants:
        raw = quick_raw.get(name, 0.0)
        if name in match.team_a:
            base = team_a_impulse / len(match.team_a)
        else:
            base = team_b_impulse / len(match.team_b)
        if name in losing_team and weights:
            base = (team_a_impulse if name in match.team_a else team_b_impulse) * weights[name]
        cap_value = abs(base) * cfg.quick_adjustment_cap_pct
        clamped = max(-cap_value, min(cap_value, raw)) if cap_value > 0 else 0.0
        print(f"{name:<10} {raw:9.1f} {cap_value:9.1f} {clamped:12.1f}")
    print()

    print("=" * 90)
    print("Expanded feedback (только взаимодействия)")
    print("=" * 90)
    for response in expanded_feedback.fan_responses:
        if response.interaction_type == "synergy":
            print(f"  Synergy: {response.player} + {response.related_player}")
        elif response.interaction_type == "domination":
            print(f"  Domination: {response.player} > {response.related_player}")
        elif response.interaction_type == "role":
            print(f"  Role: {response.player} -> {response.role}")
    for syn in expanded_feedback.synergies:
        print(f"  Synergy bonus: {syn.player_a} + {syn.player_b}")
    for dom in expanded_feedback.dominations:
        print(f"  Domination bonus: {dom.dominator} > {dom.dominated}")
    for role in expanded_feedback.role_impressions:
        print(f"  Role impression: {role.player} -> {role.role}")
    print()

    print("=" * 90)
    print("Итоговая таблица (до/после + вклад матча и фидбека)")
    print("=" * 90)
    header = f"{'player':<10} {'start':>9} {'end':>9} {'change':>9} {'match':>9} {'feedback':>9}"
    print(header)
    rows = []
    for name in participants:
        start_g, start_v = pre_ratings[name]
        start_eff = cfg.rating_eff_venue_weight * start_v + cfg.rating_eff_global_weight * start_g
        end_player = model_with_feedback.players[name]
        end_eff = effective_rating(end_player, venue_for_game6, cfg)
        match_delta = deltas_match.get(name, 0.0)
        feedback_delta = deltas_with_feedback.get(name, 0.0) - match_delta
        change = end_eff - start_eff
        rows.append((name, start_eff, end_eff, change, match_delta, feedback_delta))
    rows.sort(key=lambda item: item[3], reverse=True)
    for name, start_eff, end_eff, change, match_delta, feedback_delta in rows:
        print(f"{name:<10} {start_eff:9.1f} {end_eff:9.1f} {change:9.1f} {match_delta:9.1f} {feedback_delta:9.1f}")
    print()

    print("Составы и события (кратко):")
    print(f"  Команда A: {', '.join(chosen['team_a'])}")
    print(f"  Команда B: {', '.join(chosen['team_b'])}")
    for event in match.events:
        label = f"сегмент {event.segment_index + 1}"
        print(f"  {label}: {event.player} {event.event_type}")

    print()
    print("=" * 90)
    print("Рейтинг после матча и фидбека (сортировка по новому)")
    print("=" * 90)
    header = f"{'player':<10} {'new_R_eff':>11}"
    print(header)
    updated_rows = []
    for name in participants:
        end_player = model_with_feedback.players[name]
        end_eff = effective_rating(end_player, venue_for_game6, cfg)
        updated_rows.append((name, end_eff))
    updated_rows.sort(key=lambda item: item[1], reverse=True)
    for name, end_eff in updated_rows:
        print(f"{name:<10} {end_eff:11.1f}")
    print()

    print("=" * 90)
    print("Новая генерация команд по обновленным рейтингам")
    print("=" * 90)
    new_splits = generate_teams(model_with_feedback, participants, venue_for_game6, top_n=3)
    for idx, split in enumerate(new_splits, start=1):
        label = "Вариант 1 (рекомендованный)" if idx == 1 else f"Вариант {idx}"
        team_a = ", ".join(split["team_a"])
        team_b = ", ".join(split["team_b"])
        d_hat = split["d_hat"]
        score = split["score"]
        print(label + ":")
        print(f"  Команда A: {team_a}")
        print(f"  Команда B: {team_b}")
        print(f"  Прогноз разницы (d_hat): {d_hat:.2f}")
        print(f"  Модуль дисбаланса |d_hat|: {abs(d_hat):.2f}")
        print(f"  Оценка (score_total): {score:.3f}")
        print()


if __name__ == "__main__":
    main()
