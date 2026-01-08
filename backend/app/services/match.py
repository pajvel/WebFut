from datetime import datetime

from team_model.team_model import ExpandedFeedback, Match as TeamMatch, QuickFeedback
from team_model.team_model import MatchEvent as TeamMatchEvent
from team_model.team_model import Segment as TeamSegment
from team_model.team_model.types import (
    AnchorVote,
    DominationFeedback,
    FanResponse,
    PairwiseComparison,
    RoleFeedback,
    SynergyFeedback,
)

from ..models import Event, Feedback, Match, Segment, TeamCurrent, TeamVariant

_FAN_META = {
    "syn_1": {"type": "synergy", "polarity": 1, "mode": "self"},
    "syn_2": {"type": "synergy", "polarity": 1, "mode": "self"},
    "syn_3": {"type": "synergy", "polarity": 1, "mode": "self"},
    "syn_4": {"type": "synergy", "polarity": -1, "mode": "self"},
    "syn_5": {"type": "synergy", "polarity": -1, "mode": "self"},
    "syn_6": {"type": "synergy", "polarity": 1, "mode": "self"},
    "syn_7": {"type": "synergy", "polarity": -1, "mode": "self"},
    "syn_8": {"type": "synergy", "polarity": 1, "mode": "pair"},
    "syn_9": {"type": "synergy", "polarity": -1, "mode": "pair"},
    "syn_10": {"type": "synergy", "polarity": 1, "mode": "self"},
    "dom_1": {"type": "domination", "polarity": 1, "mode": "pair"},
    "dom_2": {"type": "domination", "polarity": 1, "mode": "pair"},
    "dom_3": {"type": "domination", "polarity": 1, "mode": "dominator_over_self"},
    "dom_4": {"type": "domination", "polarity": 1, "mode": "self_over_target"},
    "dom_5": {"type": "domination", "polarity": 1, "mode": "pair"},
    "dom_6": {"type": "domination", "polarity": -1, "mode": "pair"},
    "dom_7": {"type": "domination", "polarity": 1, "mode": "self"},
    "dom_8": {"type": "domination", "polarity": -1, "mode": "pair"},
    "role_1": {"type": "role", "polarity": 1, "role": "attacker"},
    "role_2": {"type": "role", "polarity": 1, "role": "defender"},
    "role_3": {"type": "role", "polarity": 1, "role": "offball"},
    "role_4": {"type": "role", "polarity": 1, "role": "ball_retention"},
    "role_5": {"type": "role", "polarity": -1, "role": "discipline"},
    "role_6": {"type": "role", "polarity": 1, "role": "decision"},
    "role_7": {"type": "role", "polarity": -1, "role": "involvement"},
}


def get_match(db, match_id: int) -> Match:
    match = db.query(Match).filter_by(id=match_id).one()
    return match


def get_active_segment(db, match_id: int) -> Segment:
    return (
        db.query(Segment)
        .filter_by(match_id=match_id, ended_at=None)
        .order_by(Segment.seg_no.desc())
        .first()
    )


def ensure_active_segment(db, match_id: int) -> Segment:
    segment = get_active_segment(db, match_id)
    if segment:
        return segment
    last_seg = (
        db.query(Segment).filter_by(match_id=match_id).order_by(Segment.seg_no.desc()).first()
    )
    seg_no = 1 if last_seg is None else last_seg.seg_no + 1
    segment = Segment(match_id=match_id, seg_no=seg_no, score_a=0, score_b=0, is_butt_game=False)
    db.add(segment)
    db.commit()
    return segment


def build_team_model_match(db, match_id: int) -> TeamMatch:
    match = get_match(db, match_id)
    current = db.query(TeamCurrent).filter_by(match_id=match_id).one_or_none()
    if current:
        teams = current.current_teams_json
    else:
        recommended = (
            db.query(TeamVariant)
            .filter_by(match_id=match_id, is_recommended=True)
            .order_by(TeamVariant.variant_no.asc())
            .first()
        )
        teams = recommended.teams_json if recommended else {"A": [], "B": []}

    team_a = teams.get("A", [])
    team_b = teams.get("B", [])

    segments = []
    seg_index_by_id: dict[int, int] = {}
    ordered_segments = (
        db.query(Segment).filter_by(match_id=match_id).order_by(Segment.seg_no.asc()).all()
    )
    for seg_index, seg in enumerate(ordered_segments):
        seg_index_by_id[seg.id] = seg_index
        segments.append(
            TeamSegment(
                goals_a=seg.score_a,
                goals_b=seg.score_b,
                segment_index=seg_index,
                is_butt_game=bool(seg.is_butt_game),
            )
        )

    events = []
    db_events = (
        db.query(Event)
        .filter_by(match_id=match_id, is_deleted=False)
        .order_by(Event.created_at.asc())
        .all()
    )
    for ev in db_events:
        if ev.event_type not in ("goal", "assist"):
            continue
        if not ev.scorer_tg_id and ev.event_type == "goal":
            continue
        events.append(
            TeamMatchEvent(
                player=str(ev.scorer_tg_id if ev.event_type == "goal" else ev.assist_tg_id),
                team=ev.team,
                event_type=ev.event_type,
                segment_index=seg_index_by_id.get(ev.segment_id, 0),
            )
        )

    return TeamMatch(
        venue=match.venue,
        team_a=[str(p) for p in team_a],
        team_b=[str(p) for p in team_b],
        segments=segments,
        events=events,
    )


def build_feedback(db, match_id: int) -> tuple[QuickFeedback | None, ExpandedFeedback | None]:
    records = db.query(Feedback).filter_by(match_id=match_id).all()
    if not records:
        return None, None

    quick_anchors = {}
    pairwise: list[PairwiseComparison] = []
    quick_fan: list[FanResponse] = []
    expanded_fan: list[FanResponse] = []
    synergies: list[SynergyFeedback] = []
    dominations: list[DominationFeedback] = []
    roles: list[RoleFeedback] = []

    for rec in records:
        answers = rec.answers_json or {}
        respondent_id = str(rec.tg_id)
        best = rec.mvp_vote_tg_id or answers.get("best")
        worst = answers.get("worst")
        if best:
            anchor = quick_anchors.get(str(best), {"mvp": 0, "brought_down": 0})
            anchor["mvp"] += 1
            quick_anchors[str(best)] = anchor
        if worst:
            anchor = quick_anchors.get(str(worst), {"mvp": 0, "brought_down": 0})
            anchor["brought_down"] += 1
            quick_anchors[str(worst)] = anchor

        comparisons = answers.get("comparisons") or {}
        pairs = answers.get("comparison_pairs") or {}
        for key in ("cmp_own", "cmp_opp", "cmp_cross"):
            stronger = comparisons.get(key)
            pair = pairs.get(key) or []
            if stronger and len(pair) == 2:
                weaker = pair[0] if str(pair[1]) == str(stronger) else pair[1]
                pairwise.append(PairwiseComparison(stronger=str(stronger), weaker=str(weaker)))

        expanded_pairs = answers.get("expanded_pairs") or {}
        syn_a = expanded_pairs.get("syn_team_a")
        syn_b = expanded_pairs.get("syn_team_b")
        if syn_a and syn_b and str(syn_a) != str(syn_b):
            synergies.append(SynergyFeedback(player_a=str(syn_a), player_b=str(syn_b), value=1.0))
        syn_oa = expanded_pairs.get("syn_opp_a")
        syn_ob = expanded_pairs.get("syn_opp_b")
        if syn_oa and syn_ob and str(syn_oa) != str(syn_ob):
            synergies.append(SynergyFeedback(player_a=str(syn_oa), player_b=str(syn_ob), value=1.0))
        dom_my = expanded_pairs.get("dom_my")
        dom_opp_target = expanded_pairs.get("dom_opp_target")
        if dom_my and dom_opp_target and str(dom_my) != str(dom_opp_target):
            dominations.append(DominationFeedback(dominator=str(dom_my), dominated=str(dom_opp_target), value=1.0))
        dom_opp = expanded_pairs.get("dom_opp")
        dom_my_target = expanded_pairs.get("dom_my_target")
        if dom_opp and dom_my_target and str(dom_opp) != str(dom_my_target):
            dominations.append(DominationFeedback(dominator=str(dom_opp), dominated=str(dom_my_target), value=1.0))
        role_vote = answers.get("role_vote") or {}
        role_player = role_vote.get("player_id")
        role_type = role_vote.get("role")
        if role_player and role_type in ("attacker", "defender"):
            roles.append(RoleFeedback(player=str(role_player), role=str(role_type), weight=1.0))

    quick = None
    if quick_anchors or pairwise or quick_fan:
        quick = QuickFeedback(
            anchors={
                player: AnchorVote(mvp=int(vote.get("mvp", 0)), brought_down=int(vote.get("brought_down", 0)))
                for player, vote in quick_anchors.items()
            },
            pairwise=pairwise,
            fan_responses=quick_fan,
        )
    expanded = None
    if expanded_fan or synergies or dominations or roles:
        expanded = ExpandedFeedback(
            fan_responses=expanded_fan,
            synergies=synergies,
            dominations=dominations,
            role_impressions=roles,
        )
    return quick, expanded


def finish_segment(db, match_id: int, is_butt_game: bool | None = None) -> None:
    segment = get_active_segment(db, match_id)
    if segment:
        segment.ended_at = datetime.utcnow()
        if is_butt_game is not None:
            segment.is_butt_game = bool(is_butt_game)
        db.commit()
