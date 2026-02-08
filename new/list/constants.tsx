
import { Match, MatchStatus, Theme } from './types';

export const THEMES: Theme[] = [
  {
    id: 'real',
    name: 'REAL',
    circleColor: '#000000',
    previewBg: '#ffffff',
    colors: {
      '--bg-page': '#ffffff',
      '--bg-surface': '#f8f8f8',
      '--bg-contrast': '#000000',
      '--text-main': '#000000',
      '--text-contrast': '#ffffff',
      '--border-main': '#000000',
    }
  },
  {
    id: 'juve',
    name: 'JUVE',
    circleColor: '#ffffff',
    previewBg: '#000000',
    colors: {
      '--bg-page': '#000000',
      '--bg-surface': '#121212',
      '--bg-contrast': '#ffffff',
      '--text-main': '#ffffff',
      '--text-contrast': '#000000',
      '--border-main': '#ffffff',
    }
  },
  {
    id: 'miami',
    name: 'MIAMI',
    circleColor: '#F5A9C5',
    previewBg: '#ffffff',
    colors: {
      '--bg-page': '#ffffff',
      '--bg-surface': '#fff0f5',
      '--bg-contrast': '#F5A9C5',
      '--text-main': '#000000',
      '--text-contrast': '#000000',
      '--border-main': '#F5A9C5',
    }
  },
  {
    id: 'shinnik',
    name: 'SHINNIK',
    circleColor: '#0B2C6B',
    previewBg: '#000000',
    colors: {
      '--bg-page': '#000000',
      '--bg-surface': '#050a14',
      '--bg-contrast': '#0B2C6B',
      '--text-main': '#ffffff',
      '--text-contrast': '#ffffff',
      '--border-main': '#0B2C6B',
    }
  },
  {
    id: 'barca',
    name: 'BARCA',
    circleColor: '#A50034',
    previewBg: '#0f172a',
    colors: {
      '--bg-page': '#0f172a',
      '--bg-surface': '#1e293b',
      '--bg-contrast': '#A50034',
      '--text-main': '#ffffff',
      '--text-contrast': '#ffffff',
      '--border-main': '#A50034',
    }
  },
  {
    id: 'city',
    name: 'CITY',
    circleColor: '#6CABDD',
    previewBg: '#ffffff',
    colors: {
      '--bg-page': '#ffffff',
      '--bg-surface': '#f0f9ff',
      '--bg-contrast': '#6CABDD',
      '--text-main': '#000000',
      '--text-contrast': '#000000',
      '--border-main': '#6CABDD',
    }
  },
  {
    id: 'psg',
    name: 'PSG',
    circleColor: '#3B3F8C',
    previewBg: '#ffffff',
    colors: {
      '--bg-page': '#ffffff',
      '--bg-surface': '#f5f3ff',
      '--bg-contrast': '#3B3F8C',
      '--text-main': '#000000',
      '--text-contrast': '#ffffff',
      '--border-main': '#3B3F8C',
    }
  },
  {
    id: 'bvb',
    name: 'BVB',
    circleColor: '#FDE100',
    previewBg: '#000000',
    colors: {
      '--bg-page': '#000000',
      '--bg-surface': '#18181b',
      '--bg-contrast': '#FDE100',
      '--text-main': '#FDE100',
      '--text-contrast': '#000000',
      '--border-main': '#FDE100',
    }
  },
  {
    id: 'loko',
    name: 'LOKO',
    circleColor: '#22c55e',
    previewBg: '#ffffff',
    colors: {
      '--bg-page': '#ffffff',
      '--bg-surface': '#f0fdf4',
      '--bg-contrast': '#22c55e',
      '--text-main': '#14532d',
      '--text-contrast': '#ffffff',
      '--border-main': '#22c55e',
    }
  }
];

export const MOCK_USER = {
  name: 'ZAYAC',
  avatar: 'https://i.pravatar.cc/150?u=zayac',
  rating: 1450
};

const TEAM_A_AVATARS = [
  'https://i.pravatar.cc/150?u=1',
  'https://i.pravatar.cc/150?u=2',
  'https://i.pravatar.cc/150?u=3',
  'https://i.pravatar.cc/150?u=4',
  'https://i.pravatar.cc/150?u=5',
];

const TEAM_B_AVATARS = [
  'https://i.pravatar.cc/150?u=6',
  'https://i.pravatar.cc/150?u=7',
  'https://i.pravatar.cc/150?u=8',
  'https://i.pravatar.cc/150?u=9',
  'https://i.pravatar.cc/150?u=10',
];

export const MOCK_MATCHES: Match[] = [
  {
    id: '1',
    teamA: 'MY TEAM',
    teamB: 'VORTEX TEAM',
    status: MatchStatus.FINISHED,
    time: '16:00',
    date: 'FEB 7',
    format: '5x5',
    venue: 'LUZHNIKI ARENA',
    scoreA: 10,
    scoreB: 8,
    teamAAvatars: TEAM_A_AVATARS,
    teamBAvatars: TEAM_B_AVATARS,
    mvp: {
      name: 'ZAYAC',
      avatar: 'https://i.pravatar.cc/150?u=zayac'
    }
  },
  {
    id: '2',
    teamA: 'STRIKERS',
    teamB: 'PHOENIX',
    status: MatchStatus.LIVE,
    time: '24:15',
    format: '5x5',
    venue: 'CITY PITCH',
    scoreA: 2,
    scoreB: 1,
    teamAAvatars: TEAM_A_AVATARS.slice(0, 3),
    teamBAvatars: TEAM_B_AVATARS.slice(0, 3)
  },
  {
    id: '3',
    teamA: 'TITANS',
    teamB: 'VIPER',
    status: MatchStatus.JOINABLE,
    time: '19:30',
    format: '6x6',
    venue: 'RED SQUARE',
    teamAAvatars: TEAM_A_AVATARS.slice(0, 4),
    teamBAvatars: TEAM_B_AVATARS.slice(0, 2)
  }
];