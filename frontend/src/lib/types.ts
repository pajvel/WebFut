export type MatchSummary = {
  id: number;
  context_id: number;
  created_by: number;
  scheduled_at: string | null;
  venue: string;
  status: "created" | "live" | "finished" | "generating";
  created_at: string;
  finished_at: string | null;
  score_a: number;
  score_b: number;
  team_a_members: MatchParticipant[];
  team_b_members: MatchParticipant[];
  mvp?: {
    top_tg_id: number | null;
    player: MatchParticipant | null;
  };
};

export type MatchesPaging = {
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
};

export type MatchParticipant = {
  tg_id: number;
  name: string;
  avatar: string | null;
};

export type MatchMember = {
  tg_id: number;
  role: "organizer" | "player" | "spectator";
  can_edit: boolean;
  joined_at: string;
  name: string;
  rating?: number;
  invited_by_tg_id?: number;
  avatar: string | null;
};

export type MatchSegment = {
  id: number;
  seg_no: number;
  ended_at: string | null;
  score_a: number;
  score_b: number;
  is_butt_game: boolean;
};

export type MatchEvent = {
  id: number;
  segment_id: number;
  event_type: "goal" | "own_goal";
  team: "A" | "B";
  scorer_tg_id: number | null;
  assist_tg_id: number | null;
  created_by_tg_id: number;
  created_at: string;
  updated_at: string;
};

export type TeamVariant = {
  variant_no: number;
  is_recommended: boolean;
  teams: {
    A: string[];
    B: string[];
  };
  why_text: string | null;
  explanation?: string | null;
  power?: {
    avg_a: number;
    avg_b: number;
    d_hat: number;
  };
};

export type TeamCurrent = {
  base_variant_no: number;
  current_teams: {
    A: string[];
    B: string[];
    name_a?: string;
    name_b?: string;
  };
  is_custom: boolean;
  why_now_worse_text: string | null;
  power?: {
    avg_a: number;
    avg_b: number;
    d_hat: number;
  };
};

export type MatchDetail = {
  match: MatchSummary;
  members: MatchMember[];
  segments: MatchSegment[];
  events: MatchEvent[];
  team_variants: TeamVariant[];
  team_current: TeamCurrent | null;
  payments?: {
    payer: {
      payer_tg_id: number | null;
      payer_phone: string | null;
      payer_fio: string | null;
      payer_bank: string | null;
      payer_amount?: number | null;
      status: string;
    } | null;
    requests: { tg_id: number; status: string }[];
    statuses: { tg_id: number; status: string }[];
  };
  mvp?: {
    top_tg_id: number | null;
    votes: Record<string, number>;
    worst_votes?: Record<string, number>;
  };
  me: {
    tg_id: number;
    is_admin: boolean;
  };
};

export type Me = {
  tg_id: number;
  tg_name: string;
  tg_avatar: string | null;
  custom_name: string | null;
  custom_avatar: string | null;
  is_admin: boolean;
};

export type Settings = {
  theme: string | null;
  mode_18plus: boolean;
  avatar_grayscale: boolean;
};

export type ProfileStats = {
  matches: number;
  wins: number;
  losses: number;
  goals: number;
  assists: number;
  mvp: number;
};

export type ProfileRating = {
  global: number;
  last_delta: number | null;
  last_match_id: number | null;
  last_updated_at: string | null;
};

export type LeaderboardEntry = {
  tg_id: number | null;
  name: string;
  avatar: string | null;
  games: number;
  wins: number;
  losses: number;
  rating: number;
  last_delta: number | null;
};

export type ProfileHistoryItem = {
  id: number;
  status: "created" | "live" | "finished";
  scheduled_at: string | null;
  venue: string;
  created_at: string;
  finished_at: string | null;
  score_a: number;
  score_b: number;
  team_a_members: MatchParticipant[];
  team_b_members: MatchParticipant[];
  mvp?: {
    top_tg_id: number | null;
    votes: Record<string, number>;
  };
};

export type ProfileResponse = {
  rating?: ProfileRating;
  stats: ProfileStats;
  history: ProfileHistoryItem[];
};

export type LeaderboardResponse = {
  items: LeaderboardEntry[];
};

export type ApiResponse<T> = {
  ok: boolean;
  error?: string;
} & T;

export type AdminUser = {
  tg_id: number;
  tg_name: string;
  tg_avatar: string | null;
  custom_name: string | null;
  custom_avatar: string | null;
  theme?: "light" | "dark" | string | null;
};

export type TgUser = {
  tg_id: number;
  tg_name: string;
  tg_avatar: string | null;
  custom_name?: string;
};

export type ManualUser = {
  id: string;
  custom_name: string;
};

export type TgUsersResponse = {
  tg_users: TgUser[];
  manual_users: ManualUser[];
};

