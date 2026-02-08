
export type RatingType = 'Expert' | 'Marakana' | 'Global';
export type InteractionCategory = 'SYNERGY' | 'DOMINATION';
export type PositionType = 'ATTACK' | 'DEFENSE';

export interface Player {
  id: string;
  avatar: string;
  name: string;
  tg_id: string;
  expertRating: number;
  marakanaRating: number;
  globalRating: number;
  attackRating: number;
  defenseRating: number;
  invitedBy?: string;
  initialExpertRating?: number;
  initialMarakanaRating?: number;
  initialGlobalRating?: number;
}

export interface PositionLog {
  id: string;
  date: string;
  player_id: string;
  type: PositionType;
  oldValue: number;
  newValue: number;
  delta: number;
  source: 'match' | 'feedback' | 'manual' | 'rebuild';
}

export interface MatchEvent {
  id: string;
  type: 'goal' | 'autogoal';
  player_id: string;
  assist_player_id?: string;
  team: 'A' | 'B';
  segment_id: string;
  time?: string;
}

export interface Segment {
  id: string;
  name: string;
  scoreA: number;
  scoreB: number;
}

export interface Match {
  match_id: string;
  date: string;
  status: 'pending' | 'active' | 'finished';
  venue: string;
  teamA_ids: string[];
  teamB_ids: string[];
  scoreA: number;
  scoreB: number;
  segments: Segment[];
  events: MatchEvent[];
}

export interface TgProfile {
  tg_id: string;
  avatar: string;
  name: string;
  linkedPlayerId: string | null;
}

export interface RatingLog {
  id: string;
  date: string;
  match_id: string;
  player_id: string;
  before: number;
  after: number;
  delta: number;
  type: RatingType;
  goalsCount: number;
  assistsCount: number;
  victoryLossDelta: number;
  goalDelta: number;
  assistDelta: number;
  feedbackDelta: number;
  mvpDelta: number;
  comparisonDelta: number;
  fanDelta: number;
}

export interface Interaction {
  id: string;
  playerA_id: string;
  playerB_id: string;
  value: number;
  ratingType: RatingType;
  category: InteractionCategory;
  lastUpdate: string;
}

export interface InteractionLog {
  id: string;
  date: string;
  match_id?: string;
  playerA_id: string;
  playerB_id: string;
  oldValue: number;
  newValue: number;
  ratingType: RatingType;
  category: InteractionCategory;
  source: 'match' | 'feedback' | 'rebuild' | 'manual';
  comment?: string;
}

export interface Comparison {
  p1: string;
  p2: string;
  winner: string;
}

export interface Pair {
  p1: string;
  p2: string;
}

export interface FeedbackLog {
  id: string;
  date: string;
  match_id: string;
  voter_name: string;
  bestPlayer: string;
  mvp: string;
  worstPlayer: string;
  comparisonOwn?: Comparison;
  comparisonOther?: Comparison;
  comparisonMixed?: Comparison;
  synergyOwn?: Pair;
  synergyOther?: Pair;
  dominated?: Pair;
  dominatedOpponent?: Pair;
  role?: {
    roleName: string;
    player: string;
  };
}
