
export enum MatchStatus {
  WAITING = 'WAITING',
  LIVE = 'LIVE',
  JOINABLE = 'JOINABLE',
  FINISHED = 'FINISHED'
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
}

export interface Match {
  id: string;
  teamA: string;
  teamB: string;
  status: MatchStatus;
  time: string;
  date?: string;
  format: string;
  venue: string;
  scoreA?: number;
  scoreB?: number;
  teamAAvatars?: string[];
  teamBAvatars?: string[];
  mvp?: {
    name: string;
    avatar: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  colors: {
    '--bg-page': string;
    '--bg-surface': string;
    '--bg-contrast': string;
    '--text-main': string;
    '--text-contrast': string;
    '--border-main': string;
  };
  circleColor: string;
  previewBg: string;
}