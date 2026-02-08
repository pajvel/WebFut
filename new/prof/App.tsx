import React, { useState, useEffect } from 'react';
import { PlayerProfile, Match } from './types';
import { ProfileCard } from './components/ProfileCard';
import { StatsGrid } from './components/StatsGrid';
import { MatchesList } from './components/MatchesList';
import { SettingsSection } from './components/Settings.tsx';
import { LeaderboardView } from './components/Leaderboard';
import { BackIcon, EditIcon, LeaderboardIcon, PaletteIcon } from './components/Icons';

// --- THEME CONFIGURATION ---
interface ThemeDef {
  id: string;
  name: string;
  colors: {
    bgPage: string;
    bgSurface: string;
    bgSurfaceHighlight: string;
    borderColor: string;
    colorPrimary: string; 
    colorInverse: string; 
    colorAccent: string;  
    zinc900: string;
    zinc800: string;
    zinc700: string;
    zinc600: string;
    zinc500: string;
    zinc400: string;
    zinc100: string;
  }
}

const DARK_ZINC = {
  zinc900: '#18181b',
  zinc800: '#27272a',
  zinc700: '#3f3f46',
  zinc600: '#52525b',
  zinc500: '#71717a',
  zinc400: '#a1a1aa',
  zinc100: '#f4f4f5',
};

const LIGHT_ZINC = {
  zinc900: '#f4f4f5',
  zinc800: '#e4e4e7',
  zinc700: '#d4d4d8',
  zinc600: '#a1a1aa',
  zinc500: '#71717a', 
  zinc400: '#52525b',
  zinc100: '#18181b',
};

const THEMES: ThemeDef[] = [
  { id: 'real', name: 'REAL', colors: { bgPage: '#ffffff', bgSurface: '#ffffff', bgSurfaceHighlight: '#f4f4f5', borderColor: '#e4e4e7', colorPrimary: '#000000', colorInverse: '#ffffff', colorAccent: '#000000', ...LIGHT_ZINC } },
  { id: 'juve', name: 'JUVE', colors: { bgPage: '#000000', bgSurface: '#121212', bgSurfaceHighlight: '#1E1E1E', borderColor: '#333333', colorPrimary: '#FFFFFF', colorInverse: '#000000', colorAccent: '#FFFFFF', ...DARK_ZINC } },
  { id: 'miami', name: 'MIAMI', colors: { bgPage: '#ffffff', bgSurface: '#fff0f5', bgSurfaceHighlight: '#fce7f3', borderColor: '#fbcfe8', colorPrimary: '#000000', colorInverse: '#000000', colorAccent: '#F5A9C5', ...LIGHT_ZINC, zinc900: '#fdf2f8', zinc800: '#fce7f3' } },
  { id: 'shinnik', name: 'SHINNIK', colors: { bgPage: '#000000', bgSurface: '#050a14', bgSurfaceHighlight: '#0a1429', borderColor: '#1e3a8a', colorPrimary: '#FFFFFF', colorInverse: '#ffffff', colorAccent: '#0B2C6B', ...DARK_ZINC, zinc900: '#0B2C6B', zinc800: '#1e3a8a' } },
  { id: 'barca', name: 'BARCA', colors: { bgPage: '#0f172a', bgSurface: '#1e293b', bgSurfaceHighlight: '#334155', borderColor: '#1e293b', colorPrimary: '#FFFFFF', colorInverse: '#ffffff', colorAccent: '#A50034', ...DARK_ZINC, zinc900: '#1e293b', zinc800: '#334155' } },
  { id: 'city', name: 'CITY', colors: { bgPage: '#ffffff', bgSurface: '#f0f9ff', bgSurfaceHighlight: '#e0f2fe', borderColor: '#bae6fd', colorPrimary: '#000000', colorInverse: '#000000', colorAccent: '#6CABDD', ...LIGHT_ZINC, zinc900: '#f0f9ff', zinc800: '#e0f2fe' } },
  { id: 'psg', name: 'PSG', colors: { bgPage: '#ffffff', bgSurface: '#eff6ff', bgSurfaceHighlight: '#dbeafe', borderColor: '#bfdbfe', colorPrimary: '#000000', colorInverse: '#ffffff', colorAccent: '#3B3F8C', ...LIGHT_ZINC, zinc900: '#eff6ff', zinc800: '#dbeafe' } },
  { id: 'bvb', name: 'BVB', colors: { bgPage: '#000000', bgSurface: '#121212', bgSurfaceHighlight: '#27272a', borderColor: '#FDE100', colorPrimary: '#FFFFFF', colorInverse: '#000000', colorAccent: '#FDE100', ...DARK_ZINC } },
  { id: 'loko', name: 'LOKO', colors: { bgPage: '#ffffff', bgSurface: '#f0fdf4', bgSurfaceHighlight: '#dcfce7', borderColor: '#bbf7d0', colorPrimary: '#000000', colorInverse: '#000000', colorAccent: '#22c55e', ...LIGHT_ZINC, zinc900: '#f0fdf4', zinc800: '#dcfce7' } }
];

// --- MOCK DATA ---
const AVATAR_POOL = [
  'https://i.pravatar.cc/150?u=1', 'https://i.pravatar.cc/150?u=2', 'https://i.pravatar.cc/150?u=3',
  'https://i.pravatar.cc/150?u=4', 'https://i.pravatar.cc/150?u=5', 'https://i.pravatar.cc/150?u=6',
  'https://i.pravatar.cc/150?u=7', 'https://i.pravatar.cc/150?u=8', 'https://i.pravatar.cc/150?u=9',
  'https://i.pravatar.cc/150?u=10',
];

const MOCK_PROFILE: PlayerProfile = {
  name: "SHELBYWALK",
  avatarUrl: "https://picsum.photos/400/400",
  elo: 1450,
  eloChange: 24,
  rank: "DIAMOND",
  stats: { matches: 142, wins: 89, losses: 41, goals: 324, assists: 112, mvp: 15 },
  recentMatches: [
    { id: '1', opponent: 'VORTEX TEAM', myTeamAvatars: AVATAR_POOL.slice(0, 5), opponentAvatars: AVATAR_POOL.slice(5, 10), scoreMyTeam: 10, scoreOpponent: 8, result: 'WIN', date: 'TODAY', isMvp: true, mvpPlayer: { name: 'ZAYAC', avatarUrl: 'https://picsum.photos/400/400' } },
    { id: '2', opponent: 'STRIKERS', myTeamAvatars: AVATAR_POOL.slice(0, 5), opponentAvatars: AVATAR_POOL.slice(5, 10), scoreMyTeam: 2, scoreOpponent: 5, result: 'LOSS', date: 'YESTERDAY' },
  ]
};

const HeaderButton = ({ icon, onClick }: { icon: React.ReactNode, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className="flex items-center justify-center w-10 h-10 border-2 border-white bg-surface text-white active:scale-90 transition-transform"
    style={{ boxShadow: '4px 4px 0px 0px var(--color-primary)' }}
  >
    {icon}
  </button>
);

const ThemeSelectorModal = ({ activeThemeId, onSelect, onClose }: { activeThemeId: string, onSelect: (id: string) => void, onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
    <h2 className="font-black text-3xl italic uppercase tracking-tighter mb-8 text-white">Select Theme</h2>
    <div className="grid grid-cols-3 gap-4 mb-8">
      {THEMES.map((theme) => {
         const isActive = theme.id === activeThemeId;
         return (
           <div key={theme.id} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => onSelect(theme.id)}>
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-transform active:scale-90 ${isActive ? 'ring-4 ring-offset-2 ring-offset-black ring-brand' : 'border-2 border-border'}`} style={{ backgroundColor: theme.colors.bgPage }}>
                 <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.colors.colorAccent }} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-zinc-500'}`}>{theme.name}</span>
           </div>
         );
      })}
    </div>
    <button onClick={onClose} className="w-full max-w-xs py-4 bg-brand text-black font-black uppercase tracking-widest rounded-xl">Close</button>
  </div>
);

export default function App() {
  const [currentThemeId, setCurrentThemeId] = useState('juve');
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [activeView, setActiveView] = useState<'PROFILE' | 'LEADERBOARD'>('PROFILE');

  useEffect(() => {
    const theme = THEMES.find(t => t.id === currentThemeId) || THEMES[1];
    const root = document.documentElement;
    root.style.setProperty('--bg-page', theme.colors.bgPage);
    root.style.setProperty('--bg-surface', theme.colors.bgSurface);
    root.style.setProperty('--bg-surface-highlight', theme.colors.bgSurfaceHighlight);
    root.style.setProperty('--border-color', theme.colors.borderColor);
    root.style.setProperty('--color-primary', theme.colors.colorPrimary);
    root.style.setProperty('--color-inverse', theme.colors.colorInverse);
    root.style.setProperty('--color-accent', theme.colors.colorAccent);
    root.style.setProperty('--zinc-900', theme.colors.zinc900);
    root.style.setProperty('--zinc-800', theme.colors.zinc800);
    root.style.setProperty('--zinc-700', theme.colors.zinc700);
    root.style.setProperty('--zinc-600', theme.colors.zinc600);
    root.style.setProperty('--zinc-500', theme.colors.zinc500);
    root.style.setProperty('--zinc-400', theme.colors.zinc400);
    root.style.setProperty('--zinc-100', theme.colors.zinc100);
  }, [currentThemeId]);

  const toggleView = () => setActiveView(v => v === 'PROFILE' ? 'LEADERBOARD' : 'PROFILE');

  return (
    <div className="min-h-screen bg-background text-white font-inter selection:bg-brand selection:text-black pb-10 transition-colors duration-300">
      {showThemeModal && <ThemeSelectorModal activeThemeId={currentThemeId} onSelect={setCurrentThemeId} onClose={() => setShowThemeModal(false)} />}

      <nav className="fixed top-0 left-0 right-0 bg-background z-50 px-4 py-4 flex items-center justify-between h-20 border-b-2 border-zinc-800 transition-colors duration-300">
        <div className="flex items-center gap-4">
            <HeaderButton icon={<BackIcon />} onClick={activeView === 'LEADERBOARD' ? toggleView : undefined} />
            <HeaderButton icon={<PaletteIcon />} onClick={() => setShowThemeModal(true)} />
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
             <h1 className="text-white font-black italic text-2xl tracking-tighter leading-none select-none uppercase">WEBFUT</h1>
        </div>
        <div className="flex flex-col items-end justify-center leading-none h-full">
             <span className="font-black italic text-xl uppercase tracking-tighter text-white">
                {activeView === 'PROFILE' ? 'PROFILE' : 'RANK'}
             </span>
        </div>
      </nav>

      <main className="pt-24 px-4 max-w-md mx-auto w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeView === 'PROFILE' ? (
          <>
            <ProfileCard profile={MOCK_PROFILE} />
            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 bg-brand text-black h-14 rounded-2xl font-black uppercase tracking-tight shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <EditIcon /> <span>Edit</span>
              </button>
              <button onClick={toggleView} className="flex items-center justify-center gap-2 bg-surface text-white border border-border h-14 rounded-2xl font-black uppercase tracking-tight">
                <LeaderboardIcon /> <span>Rank</span>
              </button>
            </div>
            <StatsGrid stats={MOCK_PROFILE.stats} />
            <MatchesList matches={MOCK_PROFILE.recentMatches} />
            <SettingsSection />
          </>
        ) : (
          <LeaderboardView onBack={toggleView} />
        )}
      </main>
    </div>
  );
}