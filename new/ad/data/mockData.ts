
import { Player, Match, TgProfile, RatingLog, Interaction, InteractionLog, FeedbackLog, PositionLog } from '../types';

export const mockPlayers: Player[] = [
  { id: '1', name: 'ВИТАЛИК', tg_id: '1234567', avatar: 'https://picsum.photos/100/100?random=1', expertRating: 840, marakanaRating: 720, globalRating: 823, attackRating: 1.25, defenseRating: 0.00 },
  { id: '2', name: 'иван', tg_id: '2345678', avatar: 'https://picsum.photos/100/100?random=2', expertRating: 810, marakanaRating: 710, globalRating: 805, attackRating: 0.00, defenseRating: 2.10 },
  { id: '3', name: 'ДАНЕК', tg_id: '3456789', avatar: 'https://picsum.photos/100/100?random=3', expertRating: 890, marakanaRating: 750, globalRating: 880, attackRating: 3.50, defenseRating: 0.00 },
  { id: '4', name: 'РОМА', tg_id: '4567890', avatar: 'https://picsum.photos/100/100?random=4', expertRating: 750, marakanaRating: 680, globalRating: 720, attackRating: 0.00, defenseRating: 0.00 },
  { id: '5', name: 'КУРК', tg_id: '5678901', avatar: 'https://picsum.photos/100/100?random=5', expertRating: 820, marakanaRating: 700, globalRating: 790, attackRating: 1.10, defenseRating: 0.50 },
  { id: '6', name: 'ЧЕЛ', tg_id: '6789012', avatar: 'https://picsum.photos/100/100?random=6', expertRating: 830, marakanaRating: 715, globalRating: 810, attackRating: 0.00, defenseRating: 1.80 },
  { id: '7', name: 'ТЁМА', tg_id: '7890123', avatar: 'https://picsum.photos/100/100?random=7', expertRating: 800, marakanaRating: 695, globalRating: 785, attackRating: 0.00, defenseRating: 0.00 },
];

export const mockPositionLogs: PositionLog[] = [
  { id: 'pl1', date: '06.02.2026, 10:15:00', player_id: '1', type: 'ATTACK', oldValue: 1.10, newValue: 1.25, delta: 0.15, source: 'match' },
  { id: 'pl2', date: '06.02.2026, 10:15:00', player_id: '2', type: 'DEFENSE', oldValue: 2.00, newValue: 2.10, delta: 0.10, source: 'match' },
  { id: 'pl3', date: '05.02.2026, 18:30:00', player_id: '4', type: 'ATTACK', oldValue: 0.00, newValue: 0.00, delta: 0.00, source: 'rebuild' },
  { id: 'pl4', date: '05.02.2026, 12:45:00', player_id: '5', type: 'ATTACK', oldValue: 0.95, newValue: 1.10, delta: 0.15, source: 'feedback' },
  { id: 'pl5', date: '04.02.2026, 15:20:00', player_id: '3', type: 'ATTACK', oldValue: 3.40, newValue: 3.50, delta: 0.10, source: 'manual' },
];

export const mockInteractions: Interaction[] = [
  { id: 'i1', playerA_id: '1', playerB_id: '2', value: -0.50, ratingType: 'Global', category: 'SYNERGY', lastUpdate: '2026-02-05' },
  { id: 'i2', playerA_id: '1', playerB_id: '3', value: 1.25, ratingType: 'Global', category: 'SYNERGY', lastUpdate: '2026-02-05' },
];

export const mockInteractionLogs: InteractionLog[] = [
  { id: 'il1', date: '05.02.2026, 12:34:38', playerA_id: '2', playerB_id: '1', oldValue: 1.00, newValue: 2.10, ratingType: 'Global', category: 'SYNERGY', source: 'feedback', match_id: '14' },
];

export const mockMatches: Match[] = [
  {
    match_id: '14',
    date: '2026-02-05 12:00',
    status: 'finished',
    venue: 'MARAKANA',
    teamA_ids: ['1', '2', '3'],
    teamB_ids: ['4', '5', '6'],
    scoreA: 2,
    scoreB: 1,
    segments: [{ id: 's1', name: 'МАТЧ', scoreA: 2, scoreB: 1 }],
    events: []
  }
];

export const mockFeedbackLogs: FeedbackLog[] = [
  {
    id: 'f1',
    date: '05.02.2026',
    match_id: '14',
    voter_name: 'gala',
    bestPlayer: 'иван',
    mvp: 'иван',
    worstPlayer: 'Виталик',
    role: { roleName: 'defender', player: 'иван' }
  }
];

export const mockPlayersFull: Player[] = [...mockPlayers];
export const mockTgProfiles: TgProfile[] = [];
export const mockRatingLogs: RatingLog[] = [];
