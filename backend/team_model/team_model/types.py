from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Set


@dataclass(frozen=True)
class Segment:
    goals_a: int
    goals_b: int
    segment_index: int
    is_butt_game: bool = False


@dataclass(frozen=True)
class MatchEvent:
    player: str
    team: str  # "A" or "B"
    event_type: str
    segment_index: int


@dataclass(frozen=True)
class Match:
    venue: str
    team_a: List[str]
    team_b: List[str]
    segments: List[Segment]
    events: List[MatchEvent] = field(default_factory=list)
    guests: Set[str] = field(default_factory=set)

    @property
    def participants(self) -> List[str]:
        return self.team_a + self.team_b


@dataclass(frozen=True)
class AnchorVote:
    mvp: int = 0
    brought_down: int = 0


@dataclass(frozen=True)
class PairwiseComparison:
    stronger: str
    weaker: str


@dataclass(frozen=True)
class FanResponse:
    player: str
    polarity: int  # +1 or -1
    interaction_type: Optional[str] = None  # "synergy", "domination", "role"
    related_player: Optional[str] = None
    role: Optional[str] = None


@dataclass(frozen=True)
class SynergyFeedback:
    player_a: str
    player_b: str
    value: float = 1.0


@dataclass(frozen=True)
class DominationFeedback:
    dominator: str
    dominated: str
    value: float = 1.0


@dataclass(frozen=True)
class RoleFeedback:
    player: str
    role: str
    weight: float = 1.0


@dataclass(frozen=True)
class QuickFeedback:
    anchors: Dict[str, AnchorVote] = field(default_factory=dict)
    pairwise: List[PairwiseComparison] = field(default_factory=list)
    fan_responses: List[FanResponse] = field(default_factory=list)


@dataclass(frozen=True)
class ExpandedFeedback:
    fan_responses: List[FanResponse] = field(default_factory=list)
    synergies: List[SynergyFeedback] = field(default_factory=list)
    dominations: List[DominationFeedback] = field(default_factory=list)
    role_impressions: List[RoleFeedback] = field(default_factory=list)


@dataclass
class PlayerState:
    name: str
    global_rating: float
    venue_ratings: Dict[str, float] = field(default_factory=dict)
    is_guest: bool = False
    guest_matches: int = 0
    role_tendencies: Dict[str, float] = field(default_factory=dict)
    tier_bonus: float = 0.0

    def get_venue_rating(self, venue: str, default: float) -> float:
        return self.venue_ratings.get(venue, default + self.tier_bonus)

    def ensure_venue(self, venue: str, default: float) -> None:
        if venue not in self.venue_ratings:
            self.venue_ratings[venue] = default + self.tier_bonus


@dataclass
class InteractionState:
    synergy: Dict[str, Dict[frozenset, float]] = field(default_factory=dict)
    domination: Dict[str, Dict[tuple, float]] = field(default_factory=dict)

    def get_syn(self, venue: str, player_a: str, player_b: str) -> float:
        return self.synergy.get(venue, {}).get(frozenset({player_a, player_b}), 0.0)

    def add_syn(self, venue: str, player_a: str, player_b: str, value: float) -> None:
        if player_a == player_b:
            return
        self.synergy.setdefault(venue, {})
        key = frozenset({player_a, player_b})
        self.synergy[venue][key] = self.synergy[venue].get(key, 0.0) + value

    def get_dom(self, venue: str, dominator: str, dominated: str) -> float:
        return self.domination.get(venue, {}).get((dominator, dominated), 0.0)

    def add_dom(self, venue: str, dominator: str, dominated: str, value: float) -> None:
        if dominator == dominated:
            return
        self.domination.setdefault(venue, {})
        key = (dominator, dominated)
        self.domination[venue][key] = self.domination[venue].get(key, 0.0) + value


@dataclass
class ModelState:
    players: Dict[str, PlayerState]
    interactions: InteractionState
    config: object
    tier_bonus: Dict[str, float] = field(default_factory=dict)

    @classmethod
    def empty(cls, config: object) -> "ModelState":
        return cls(players={}, interactions=InteractionState(), config=config, tier_bonus={})

    def ensure_player(self, name: str, venue: str, initial_rating: float, is_guest: bool) -> PlayerState:
        bonus = self.tier_bonus.get(name, 0.0)
        if name not in self.players:
            self.players[name] = PlayerState(
                name=name,
                global_rating=initial_rating + bonus,
                venue_ratings={venue: initial_rating + bonus},
                is_guest=is_guest,
                tier_bonus=bonus,
            )
        player = self.players[name]
        player.ensure_venue(venue, initial_rating)
        return player

    def all_players(self, names: Iterable[str]) -> List[PlayerState]:
        return [self.players[name] for name in names]
