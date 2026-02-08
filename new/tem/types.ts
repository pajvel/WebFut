
export interface Player {
  id: string;
  name: string;
  elo: number;
  avatar: string;
}

export interface Team {
  name: string;
  players: Player[];
}

export interface TeamVariant {
  id: number;
  teamA: Team;
  teamB: Team;
  explanation: string;
}

export type UserRole = 'ORGANIZER' | 'PLAYER';
export type MatchStatus = 'WAITING' | 'GENERATING';

export interface MatchConfig {
  status: MatchStatus;
  format: string;
  activeVariantIdx: number;
  payerId?: string;
}

export type ThemeId = 'real' | 'juve' | 'miami' | 'shinnik' | 'barca' | 'city' | 'psg' | 'bvb' | 'loko';

export interface ThemeColors {
  bgPage: string;
  bgSurface: string;
  bgContrast: string;
  textMain: string;
  textContrast: string;
  borderMain: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  colors: ThemeColors;
}
