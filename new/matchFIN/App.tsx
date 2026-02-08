
import React, { useState, useCallback, useEffect } from 'react';
import { Player, Team, MatchEvent, EventType, Theme } from './types';
import PlayerCard from './components/PlayerCard';
import TimelineItem from './components/TimelineItem';
import GoalModal from './components/GoalModal';
import ThemeModal from './components/ThemeModal';
import SpectatorsModal from './components/SpectatorsModal';

const THEMES: Theme[] = [
  {
    id: 'real',
    name: 'Real', // Black on White
    colors: {
      '--bg-page': '#ffffff',
      '--bg-surface': '#f8f8f8',
      '--bg-contrast': '#000000',
      '--text-main': '#000000',
      '--text-contrast': '#ffffff',
      '--border-main': '#000000'
    }
  },
  {
    id: 'juve',
    name: 'Juve', // White on Black
    colors: {
      '--bg-page': '#000000',
      '--bg-surface': '#121212',
      '--bg-contrast': '#ffffff',
      '--text-main': '#ffffff',
      '--text-contrast': '#000000',
      '--border-main': '#ffffff'
    }
  },
  {
    id: 'miami',
    name: 'Miami', // Pink on White
    colors: {
      '--bg-page': '#ffffff',
      '--bg-surface': '#fff0f5',
      '--bg-contrast': '#F5A9C5', 
      '--text-main': '#000000',
      '--text-contrast': '#000000', // Black text on pink button
      '--border-main': '#F5A9C5'
    }
  },
  {
    id: 'shinnik',
    name: 'Shinnik', // Blue on Black
    colors: {
      '--bg-page': '#000000',
      '--bg-surface': '#050a14',
      '--bg-contrast': '#0B2C6B',
      '--text-main': '#ffffff', // White text for readability on dark
      '--text-contrast': '#ffffff',
      '--border-main': '#0B2C6B'
    }
  },
  {
    id: 'barca',
    name: 'Barca', // The only Red
    colors: {
      '--bg-page': '#0f172a', // Dark Navy
      '--bg-surface': '#1e293b',
      '--bg-contrast': '#A50034',
      '--text-main': '#ffffff',
      '--text-contrast': '#ffffff',
      '--border-main': '#A50034'
    }
  },
  {
    id: 'city',
    name: 'City', // Sky Blue
    colors: {
      '--bg-page': '#ffffff',
      '--bg-surface': '#f0f9ff',
      '--bg-contrast': '#6CABDD',
      '--text-main': '#000000',
      '--text-contrast': '#000000',
      '--border-main': '#6CABDD'
    }
  },
  {
    id: 'psg',
    name: 'PSG', // Violet-Blue
    colors: {
      '--bg-page': '#ffffff',
      '--bg-surface': '#f5f3ff',
      '--bg-contrast': '#3B3F8C',
      '--text-main': '#000000',
      '--text-contrast': '#ffffff',
      '--border-main': '#3B3F8C'
    }
  },
  {
    id: 'bvb',
    name: 'BVB', // Yellow on Black
    colors: {
      '--bg-page': '#000000',
      '--bg-surface': '#18181b',
      '--bg-contrast': '#FDE100',
      '--text-main': '#FDE100', // Yellow text
      '--text-contrast': '#000000', // Black text on yellow button
      '--border-main': '#FDE100'
    }
  },
  {
    id: 'loko',
    name: 'Loko', // Green
    colors: {
      '--bg-page': '#ffffff',
      '--bg-surface': '#f0fdf4',
      '--bg-contrast': '#22c55e', // Vibrant Green
      '--text-main': '#14532d', // Dark Green text
      '--text-contrast': '#ffffff',
      '--border-main': '#22c55e'
    }
  }
];

const INITIAL_TEAM_1: Team = {
  id: 't1',
  name: 'STRIKERS',
  players: [
    { id: 'p1', name: 'ZAYAC', elo: 1450, avatar: 'https://picsum.photos/seed/zayac/100', teamId: 't1' },
    { id: 'p2', name: 'VULCAN', elo: 1320, avatar: 'https://picsum.photos/seed/vulcan/100', teamId: 't1' },
    { id: 'p3', name: 'PHOENIX', elo: 1580, avatar: 'https://picsum.photos/seed/phoenix/100', teamId: 't1' },
    { id: 'p4', name: 'ROCKET', elo: 1290, avatar: 'https://picsum.photos/seed/rocket/100', teamId: 't1' },
    { id: 'p5', name: 'DRAKE', elo: 1410, avatar: 'https://picsum.photos/seed/drake/100', teamId: 't1' },
  ]
};

const INITIAL_TEAM_2: Team = {
  id: 't2',
  name: 'VORTEX',
  players: [
    { id: 'p6', name: 'NINJA', elo: 1390, avatar: 'https://picsum.photos/seed/ninja/100', teamId: 't2' },
    { id: 'p7', name: 'GHOST', elo: 1465, avatar: 'https://picsum.photos/seed/ghost/100', teamId: 't2' },
    { id: 'p8', name: 'FROST', elo: 1510, avatar: 'https://picsum.photos/seed/frost/100', teamId: 't2' },
    { id: 'p9', name: 'TITAN', elo: 1345, avatar: 'https://picsum.photos/seed/titan/100', teamId: 't2' },
    { id: 'p10', name: 'VIPER', elo: 1420, avatar: 'https://picsum.photos/seed/viper/100', teamId: 't2' },
  ]
};

const App: React.FC = () => {
  const [score, setScore] = useState({ t1: 0, t2: 0 });
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [isNaZhopu, setIsNaZhopu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[0]);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isSpectatorsModalOpen, setIsSpectatorsModalOpen] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    scorer: Player | null;
  }>({ isOpen: false, scorer: null });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }).toUpperCase();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOpenGoalModal = useCallback((player: Player) => {
    setModalState({ isOpen: true, scorer: player });
  }, []);

  const handleAddEvent = (type: EventType, assistantId?: string) => {
    if (!modalState.scorer) return;

    const scorer = modalState.scorer;
    const teamId = scorer.teamId;
    const assistant = INITIAL_TEAM_1.players.concat(INITIAL_TEAM_2.players).find(p => p.id === assistantId);

    const newScore = { ...score };
    if (type === EventType.GOAL) {
      if (teamId === 't1') newScore.t1 += 1;
      else newScore.t2 += 1;
    } else {
      if (teamId === 't1') newScore.t2 += 1;
      else newScore.t1 += 1;
    }

    const newEvent: MatchEvent = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      scorerId: scorer.id,
      scorerName: scorer.name,
      assistantId,
      assistantName: assistant?.name,
      teamId,
      scoreAtEvent: `${newScore.t1}:${newScore.t2}`
    };

    setScore(newScore);
    setEvents(prev => [newEvent, ...prev]);
    setModalState({ isOpen: false, scorer: null });
  };

  const resetMatch = () => {
    if (window.confirm('Reset all match data?')) {
      setScore({ t1: 0, t2: 0 });
      setEvents([]);
    }
  };

  const finishMatch = () => {
    alert(`Match finished! Result: ${score.t1} - ${score.t2}`);
  };

  const handleBack = () => {
    alert('Going back to menu...');
  };

  return (
    <div 
      className="h-screen flex flex-col max-w-md mx-auto relative overflow-hidden transition-colors duration-300"
      style={{
        ...currentTheme.colors,
        backgroundColor: 'var(--bg-page)'
      } as React.CSSProperties}
    >
      {/* Fixed Header */}
      <div className="flex-none bg-[var(--bg-surface)] p-4 border-b-2 border-[var(--border-main)] z-20 shadow-sm transition-colors duration-300">
        {/* Navigation & Branding Bar */}
        <div className="flex items-center justify-between mb-4">
          {/* Left Buttons */}
          <div className="flex gap-2">
            <button 
              onClick={handleBack}
              className="flex items-center justify-center w-10 h-10 border-2 border-[var(--border-main)] bg-[var(--bg-surface)] active:scale-90 transition-transform brutalist-shadow"
              style={{ boxShadow: '4px 4px 0px 0px var(--border-main)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
            </button>
            <button 
              onClick={() => setIsThemeModalOpen(true)}
              className="flex items-center justify-center w-10 h-10 border-2 border-[var(--border-main)] bg-[var(--bg-surface)] active:scale-90 transition-transform brutalist-shadow"
              style={{ boxShadow: '4px 4px 0px 0px var(--border-main)' }}
            >
              <div className="grid grid-cols-2 gap-0.5">
                <div className="w-1.5 h-1.5 bg-[var(--text-main)]"></div>
                <div className="w-1.5 h-1.5 bg-[var(--text-main)] opacity-50"></div>
                <div className="w-1.5 h-1.5 bg-[var(--text-main)] opacity-50"></div>
                <div className="w-1.5 h-1.5 bg-[var(--text-main)]"></div>
              </div>
            </button>
          </div>

          {/* Centered Brand Name */}
          <div className="flex-1 text-center">
            <h1 className="text-[var(--text-main)] font-black italic text-xl tracking-tight leading-none transition-colors">
              WEBFUT
            </h1>
          </div>

          {/* Right Info Stack */}
          <div className="w-24 text-right">
            <div className="flex flex-col">
              <div className="flex items-center justify-end gap-1 mb-0.5">
                <div className="w-1 h-1 rounded-full bg-red-600 animate-pulse"></div>
                <span className="text-[8px] font-black tracking-widest text-[var(--text-main)] italic uppercase">LIVE</span>
              </div>
              <div className="text-[9px] font-black text-[var(--text-main)] leading-none uppercase tracking-tighter transition-colors">
                {formatDate(currentTime)} // {formatTime(currentTime)}
              </div>
            </div>
          </div>
        </div>

        {/* Scoreboard */}
        <div 
          className="bg-[var(--bg-contrast)] text-[var(--text-contrast)] p-5 rounded-[2rem] border-2 border-[var(--border-main)] brutalist-shadow grid grid-cols-[1fr_auto_1fr] items-center mb-4 transition-colors duration-300"
          style={{ boxShadow: '4px 4px 0px 0px var(--border-main)' }}
        >
          {/* Team A Slot */}
          <div className="text-center min-w-0 pr-1">
            <div className="text-[8px] font-black uppercase tracking-[0.2em] mb-1 leading-none opacity-60">TEAM A</div>
            <h2 className="text-lg font-black italic tracking-tighter leading-tight uppercase truncate">{INITIAL_TEAM_1.name}</h2>
          </div>

          {/* Score Slot */}
          <div className="px-2">
             <div className="bg-[var(--bg-surface)] text-[var(--text-main)] h-14 w-28 flex items-center justify-center rounded-2xl border-2 border-[var(--bg-surface)] overflow-hidden transition-colors">
                <div className="w-10 text-center text-4xl font-black tracking-tighter tabular-nums leading-none">{score.t1}</div>
                <div className="w-4 text-center text-2xl font-black opacity-20 mb-1">:</div>
                <div className="w-10 text-center text-4xl font-black tracking-tighter tabular-nums leading-none">{score.t2}</div>
             </div>
          </div>

          {/* Team B Slot */}
          <div className="text-center min-w-0 pl-1">
            <div className="text-[8px] font-black uppercase tracking-[0.2em] mb-1 leading-none opacity-60">TEAM B</div>
            <h2 className="text-lg font-black italic tracking-tighter leading-tight uppercase truncate">{INITIAL_TEAM_2.name}</h2>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex gap-2">
          <button 
            onClick={() => setIsSpectatorsModalOpen(true)}
            className="w-12 py-1.5 rounded-lg border-2 border-[var(--border-main)] bg-[var(--bg-surface)] text-[var(--text-main)] flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>

          <button 
            onClick={() => setIsNaZhopu(!isNaZhopu)}
            className={`flex-1 py-1.5 rounded-lg border-2 border-[var(--border-main)] font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2`}
            style={{ 
              backgroundColor: isNaZhopu ? 'var(--bg-contrast)' : 'var(--bg-surface)',
              color: isNaZhopu ? 'var(--text-contrast)' : 'var(--text-main)'
            }}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isNaZhopu ? 'bg-green-400' : 'bg-neutral-300'}`}></div>
            MODE: {isNaZhopu ? 'НА ЖОПУ ON' : 'НА ЖОПУ OFF'}
          </button>
        </div>
      </div>

      {/* Scrollable Main content */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 custom-scrollbar bg-[var(--bg-page)] transition-colors duration-300">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-black text-[var(--text-main)] opacity-40 uppercase tracking-widest">SQUAD LINEUPS</span>
          <div className="h-[1px] flex-1 mx-4 bg-[var(--border-main)] opacity-20"></div>
          <span className="text-[10px] font-black text-[var(--text-main)] opacity-40 uppercase tracking-widest">5 ON 5</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Team 1 Players - Dark Theme Variant */}
          <div className="space-y-2">
            {INITIAL_TEAM_1.players.map(player => (
              <PlayerCard 
                key={player.id} 
                player={player} 
                variant="dark"
                onGoal={() => handleOpenGoalModal(player)}
              />
            ))}
          </div>

          {/* Team 2 Players - Light Theme Variant */}
          <div className="space-y-2">
            {INITIAL_TEAM_2.players.map(player => (
              <PlayerCard 
                key={player.id} 
                player={player} 
                variant="light"
                onGoal={() => handleOpenGoalModal(player)}
              />
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-black italic tracking-tighter uppercase text-[var(--text-main)]">TIMELINE</h3>
            <div className="h-[2px] bg-[var(--border-main)] flex-1"></div>
            <div className="text-[10px] font-black text-[var(--text-main)] opacity-40 uppercase tracking-widest">GAME LOG</div>
          </div>
          
          <div className="space-y-3 pb-8">
            {events.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-main)] rounded-[2rem] opacity-40">
                <div className="text-4xl grayscale mb-3 opacity-50">🏁</div>
                <span className="font-black text-[10px] uppercase tracking-widest text-[var(--text-main)]">Awaiting game events</span>
              </div>
            ) : (
              events.map(event => (
                <TimelineItem key={event.id} event={event} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Fixed Footer Controls */}
      <div className="flex-none p-4 bg-[var(--bg-surface)] border-t-2 border-[var(--border-main)] z-20 transition-colors duration-300">
        <div className="flex gap-3">
          <button 
            onClick={finishMatch}
            className="flex-[3] bg-[var(--bg-contrast)] text-[var(--text-contrast)] h-16 rounded-2xl text-xl font-black italic tracking-tighter uppercase active:scale-95 transition-transform flex items-center justify-center border-2 border-[var(--border-main)]"
          >
            FINISH GAME
          </button>
          <button 
            onClick={resetMatch}
            className="flex-1 bg-[var(--bg-surface)] text-[var(--text-main)] h-16 rounded-2xl text-[10px] font-black uppercase border-2 border-[var(--border-main)] active:scale-95 transition-transform flex items-center justify-center tracking-widest leading-none text-center"
          >
            RESET<br/>STATS
          </button>
        </div>
      </div>

      {/* Modals */}
      {modalState.isOpen && modalState.scorer && (
        <GoalModal 
          scorer={modalState.scorer}
          teamPlayers={modalState.scorer.teamId === 't1' ? INITIAL_TEAM_1.players : INITIAL_TEAM_2.players}
          onSelectAssist={(id) => handleAddEvent(EventType.GOAL, id)}
          onSelectOG={() => handleAddEvent(EventType.OWN_GOAL)}
          onCancel={() => setModalState({ isOpen: false, scorer: null })}
        />
      )}

      {isThemeModalOpen && (
        <ThemeModal 
          themes={THEMES}
          currentThemeId={currentTheme.id}
          onSelect={(theme) => {
            setCurrentTheme(theme);
            setIsThemeModalOpen(false);
          }}
          onClose={() => setIsThemeModalOpen(false)}
        />
      )}

      {isSpectatorsModalOpen && (
        <SpectatorsModal 
          onClose={() => setIsSpectatorsModalOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
