
export interface Player {
  id: string;
  name: string;
  elo: number;
  avatar: string;
  teamId: string;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
}

export enum EventType {
  GOAL = 'GOAL',
  OWN_GOAL = 'OWN_GOAL'
}

export interface MatchEvent {
  id: string;
  type: EventType;
  scorerId: string;
  scorerName: string;
  assistantId?: string;
  assistantName?: string;
  teamId: string;
  scoreAtEvent: string;
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
}
