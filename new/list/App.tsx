
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import MatchCard from './components/MatchCard';
import CreateMatchView from './components/CreateMatchView';
import ThemeSelector from './components/ThemeSelector';
import { MOCK_MATCHES, THEMES } from './constants';
import { Match, MatchStatus, Theme } from './types';

const App: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [isSelectingTheme, setIsSelectingTheme] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[0]);
  const [matches, setMatches] = useState<Match[]>(MOCK_MATCHES);

  useEffect(() => {
    // Apply theme colors to :root
    const root = document.documentElement;
    Object.entries(currentTheme.colors).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }, [currentTheme]);

  const activeMatches = matches.filter(m => m.status !== MatchStatus.FINISHED);
  const finishedMatches = matches.filter(m => m.status === MatchStatus.FINISHED);

  const handleMatchClick = (match: Match) => {
    console.log(`Open match details: ${match.id}`);
  };

  const handleThemeSelect = (theme: Theme) => {
    setCurrentTheme(theme);
    setIsSelectingTheme(false);
  };

  const handleCreateMatch = () => {
    setIsCreating(true);
  };

  const handleConfirmCreate = (data: { date: string; venue: string }) => {
    const newMatch: Match = {
      id: Math.random().toString(36).substr(2, 9),
      teamA: 'MY TEAM',
      teamB: 'TBD',
      status: MatchStatus.JOINABLE,
      time: '12:00',
      date: data.date.split('-').slice(1).join('/'),
      format: '5x5',
      venue: data.venue,
      teamAAvatars: ['https://i.pravatar.cc/150?u=zayac'],
      teamBAvatars: []
    };
    setMatches([newMatch, ...matches]);
    setIsCreating(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page)] select-none transition-colors duration-300">
      <Header onThemeClick={() => setIsSelectingTheme(true)} />

      <main className="flex-1 p-5 pb-10 overflow-y-auto">
        {/* Block 1: Active/Upcoming */}
        <section className="mb-10">
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3 flex-1">
              <h3 className="font-black italic text-sm uppercase tracking-tight text-[var(--text-main)] whitespace-nowrap">
                Active Matches
              </h3>
              <div className="flex-1 h-[2px] bg-[var(--border-main)]/10"></div>
            </div>
            
            <button
              onClick={handleCreateMatch}
              className="w-10 h-10 bg-[var(--bg-contrast)] text-[var(--text-contrast)] border-2 border-[var(--border-main)] rounded-full flex items-center justify-center transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none brutalist-shadow-sm shrink-0"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>

          {activeMatches.map(match => (
            <MatchCard 
              key={match.id} 
              match={match} 
              onClick={handleMatchClick} 
            />
          ))}
          {activeMatches.length === 0 && (
            <div className="p-8 border-2 border-dashed border-[var(--border-main)]/10 rounded-[2rem] text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest bg-[var(--bg-surface)]">
              No active matches available
            </div>
          )}
        </section>

        {/* Block 2: Finished */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <h3 className="font-black italic text-sm uppercase tracking-tight text-gray-400">
              Match History
            </h3>
            <div className="flex-1 h-[2px] bg-[var(--border-main)]/5"></div>
          </div>
          {finishedMatches.map(match => (
            <MatchCard 
              key={match.id} 
              match={match} 
              onClick={handleMatchClick} 
            />
          ))}
        </section>
      </main>

      {/* Match Creation Overlay */}
      {isCreating && (
        <CreateMatchView 
          onClose={() => setIsCreating(false)} 
          onCreate={handleConfirmCreate} 
        />
      )}

      {/* Theme Selection Overlay */}
      {isSelectingTheme && (
        <ThemeSelector
          currentThemeId={currentTheme.id}
          onSelect={handleThemeSelect}
          onClose={() => setIsSelectingTheme(false)}
        />
      )}
    </div>
  );
};

export default App;