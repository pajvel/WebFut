
export enum MatchTab {
  RESULT = 'ИТОГ',
  EVENTS = 'СОБЫТИЯ',
  BEST = 'ЛУЧШИЕ'
}

export enum PaymentStatus {
  NOT_PAID = 'не скинул',
  PENDING = 'ожидает подтверждения',
  CONFIRMED = 'подтверждено',
  REJECTED = 'отклонено'
}

export enum UserRole {
  PLAYER = 'PLAYER',
  PAYER = 'PAYER',
  ORGANIZER = 'ORGANIZER'
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  elo: number;
  goals: number;
  assists: number;
  paymentStatus: PaymentStatus;
  mvpVotes: number;
}

export interface MatchEvent {
  id: string;
  type: 'goal' | 'own_goal';
  player: string;
  assist?: string;
  team: 'A' | 'B';
  scoreAfter: string;
  time: string;
  period: string;
}

export interface MatchData {
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  date: string;
  time: string;
  status: string;
  location: string;
  periods: string[];
  teamA: Player[];
  teamB: Player[];
  events: MatchEvent[];
  payer: {
    name: string;
    phone: string;
    bank: string;
  };
}

export interface AppTheme {
  id: string;
  name: string;
  colors: {
    bgPage: string;
    bgSurface: string;
    bgContrast: string;
    textMain: string;
    textContrast: string;
    borderMain: string;
  };
}
