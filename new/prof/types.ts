export interface PlayerStats {
  matches: number;
  wins: number;
  losses: number;
  goals: number;
  assists: number;
  mvp: number;
}

export interface Match {
  id: string;
  opponent: string; // Team Name
  myTeamAvatars: string[];
  opponentAvatars: string[];
  scoreMyTeam: number;
  scoreOpponent: number;
  result: 'WIN' | 'LOSS' | 'DRAW';
  date: string;
  isMvp?: boolean;
  mvpPlayer?: {
    name: string;
    avatarUrl: string;
  };
}

export interface PlayerProfile {
  name: string;
  avatarUrl: string;
  elo: number;
  eloChange: number; // Positive for up, negative for down
  rank: string;
  stats: PlayerStats;
  recentMatches: Match[];
}