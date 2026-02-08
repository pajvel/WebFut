
import React, { useState, useEffect } from 'react';
import { UserRole, Player, MatchConfig, ThemeId, Theme } from './types';
import PreparationPage from './pages/PreparationPage';

const MOCK_PLAYERS: Player[] = [
  { id: '1', name: 'ZAYAC', elo: 1450, avatar: 'https://picsum.photos/seed/zayac/100' },
  { id: '2', name: 'NINJA', elo: 1390, avatar: 'https://picsum.photos/seed/ninja/100' },
  { id: '3', name: 'VULCAN', elo: 1320, avatar: 'https://picsum.photos/seed/vulcan/100' },
  { id: '4', name: 'GHOST', elo: 1465, avatar: 'https://picsum.photos/seed/ghost/100' },
  { id: '5', name: 'PHOENIX', elo: 1580, avatar: 'https://picsum.photos/seed/phoenix/100' },
  { id: '6', name: 'FROST', elo: 1510, avatar: 'https://picsum.photos/seed/frost/100' },
  { id: '7', name: 'STORM', elo: 1210, avatar: 'https://picsum.photos/seed/storm/100' },
  { id: '8', name: 'BLADE', elo: 1280, avatar: 'https://picsum.photos/seed/blade/100' },
  { id: '9', name: 'TITAN', elo: 1400, avatar: 'https://picsum.photos/seed/titan/100' },
  { id: '10', name: 'RAVEN', elo: 1350, avatar: 'https://picsum.photos/seed/raven/100' },
];

export const THEMES: Theme[] = [
  { id: 'real', name: 'Real', colors: { bgPage: '#ffffff', bgSurface: '#f8f8f8', bgContrast: '#000000', textMain: '#000000', textContrast: '#ffffff', borderMain: '#000000' } },
  { id: 'juve', name: 'Juve', colors: { bgPage: '#000000', bgSurface: '#121212', bgContrast: '#ffffff', textMain: '#ffffff', textContrast: '#000000', borderMain: '#ffffff' } },
  { id: 'miami', name: 'Miami', colors: { bgPage: '#ffffff', bgSurface: '#fff0f5', bgContrast: '#F5A9C5', textMain: '#000000', textContrast: '#000000', borderMain: '#F5A9C5' } },
  { id: 'shinnik', name: 'Shinnik', colors: { bgPage: '#000000', bgSurface: '#050a14', bgContrast: '#0B2C6B', textMain: '#ffffff', textContrast: '#ffffff', borderMain: '#0B2C6B' } },
  { id: 'barca', name: 'Barca', colors: { bgPage: '#0f172a', bgSurface: '#1e293b', bgContrast: '#A50034', textMain: '#ffffff', textContrast: '#ffffff', borderMain: '#A50034' } },
  { id: 'city', name: 'City', colors: { bgPage: '#ffffff', bgSurface: '#f0f9ff', bgContrast: '#6CABDD', textMain: '#000000', textContrast: '#000000', borderMain: '#6CABDD' } },
  { id: 'psg', name: 'PSG', colors: { bgPage: '#ffffff', bgSurface: '#f5f3ff', bgContrast: '#3B3F8C', textMain: '#000000', textContrast: '#ffffff', borderMain: '#3B3F8C' } },
  { id: 'bvb', name: 'BVB', colors: { bgPage: '#000000', bgSurface: '#18181b', bgContrast: '#FDE100', textMain: '#FDE100', textContrast: '#000000', borderMain: '#FDE100' } },
  { id: 'loko', name: 'Loko', colors: { bgPage: '#ffffff', bgSurface: '#f0fdf4', bgContrast: '#22c55e', textMain: '#14532d', textContrast: '#ffffff', borderMain: '#22c55e' } },
];

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>('ORGANIZER');
  const [activeThemeId, setActiveThemeId] = useState<ThemeId>('juve');
  const [matchConfig, setMatchConfig] = useState<MatchConfig>({
    status: 'WAITING',
    format: '5 vs 5',
    activeVariantIdx: 0,
    payerId: undefined
  });
  const [showConfirmBack, setShowConfirmBack] = useState(false);

  useEffect(() => {
    const theme = THEMES.find(t => t.id === activeThemeId) || THEMES[1];
    const root = document.documentElement;
    root.style.setProperty('--bg-page', theme.colors.bgPage);
    root.style.setProperty('--bg-surface', theme.colors.bgSurface);
    root.style.setProperty('--bg-contrast', theme.colors.bgContrast);
    root.style.setProperty('--text-main', theme.colors.textMain);
    root.style.setProperty('--text-contrast', theme.colors.textContrast);
    root.style.setProperty('--border-main', theme.colors.borderMain);
  }, [activeThemeId]);

  const handleCreateTeams = () => {
    setMatchConfig(prev => ({ ...prev, status: 'GENERATING' }));
  };

  const handleBack = () => {
    if (matchConfig.status === 'GENERATING' && role === 'ORGANIZER') {
      setShowConfirmBack(true);
    }
  };

  const confirmStop = () => {
    setMatchConfig({ status: 'WAITING', format: '5 vs 5', activeVariantIdx: 0, payerId: undefined });
    setShowConfirmBack(false);
  };

  const setVariant = (idx: number) => {
    setMatchConfig(prev => ({ ...prev, activeVariantIdx: idx }));
  };

  const setPayer = (playerId: string) => {
    setMatchConfig(prev => ({ ...prev, payerId: playerId }));
  };

  const toggleFormat = () => {
    setMatchConfig(prev => ({ 
      ...prev, 
      format: prev.format === '5 vs 5' ? '4 vs 6' : '5 vs 5' 
    }));
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-[var(--bg-page)] text-[var(--text-main)] relative">
      {/* Dev Bar */}
      <div className="bg-red-600 text-[10px] text-white font-black px-2 flex justify-between items-center py-0.5 z-[60]">
        <div className="flex gap-2">
          <span>DEV: {role}</span>
          <button onClick={toggleFormat} className="underline decoration-dotted">TEST FORMAT</button>
        </div>
        <button onClick={() => setRole(role === 'ORGANIZER' ? 'PLAYER' : 'ORGANIZER')} className="underline">SWITCH ROLE</button>
      </div>

      <PreparationPage 
        role={role} 
        players={MOCK_PLAYERS} 
        config={matchConfig}
        activeThemeId={activeThemeId}
        onSetTheme={setActiveThemeId}
        onSetVariant={setVariant}
        onSetPayer={setPayer}
        onCreateTeams={handleCreateTeams} 
        onBack={handleBack} 
      />

      {showConfirmBack && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-sm">
          <div className="w-full bg-[var(--bg-surface)] border-4 border-[var(--border-main)] p-6 rounded-[2rem] shadow-[8px_8px_0px_0px_var(--border-main)]">
            <h2 className="font-black italic uppercase text-2xl mb-4 leading-none text-[var(--text-main)]">Discard Squads?</h2>
            <p className="font-bold text-xs opacity-60 uppercase mb-6 text-[var(--text-main)]">Match status will return to "Waiting".</p>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={confirmStop} className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] p-4 font-black uppercase text-xs shadow-brutal active:scale-95">
                Stop Creating
              </button>
              <button onClick={() => setShowConfirmBack(false)} className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-3 font-black uppercase text-xs active:scale-95 text-[var(--text-main)]">
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
