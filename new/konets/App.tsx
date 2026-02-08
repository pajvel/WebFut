
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Tabs from './components/Tabs';
import ResultTab from './components/ResultTab';
import EventsTab from './components/EventsTab';
import BestTab from './components/BestTab';
import ThemeSelector from './components/ThemeSelector';
import { MatchTab, UserRole, MatchData, PaymentStatus, AppTheme } from './types';
import { THEMES } from './constants';

const MOCK_DATA: MatchData = {
  teamAName: 'STRIKERS',
  teamBName: 'VORTEX',
  scoreA: 8,
  scoreB: 5,
  date: 'FEB 7',
  time: '22:00',
  status: 'FINISHED',
  location: 'ARENA CITY PARK',
  periods: ['1ST PERIOD', '2ND PERIOD'],
  teamA: [
    { id: '1', name: 'ZAYAC', avatar: 'https://picsum.photos/seed/zayac/100/100', elo: 1450, goals: 3, assists: 1, paymentStatus: PaymentStatus.CONFIRMED, mvpVotes: 12 },
    { id: '2', name: 'VULCAN', avatar: 'https://picsum.photos/seed/vulcan/100/100', elo: 1320, goals: 2, assists: 2, paymentStatus: PaymentStatus.CONFIRMED, mvpVotes: 4 },
    { id: '3', name: 'PHOENIX', avatar: 'https://picsum.photos/seed/phoenix/100/100', elo: 1580, goals: 1, assists: 3, paymentStatus: PaymentStatus.PENDING, mvpVotes: 8 },
    { id: '4', name: 'STORM', avatar: 'https://picsum.photos/seed/storm/100/100', elo: 1210, goals: 1, assists: 0, paymentStatus: PaymentStatus.NOT_PAID, mvpVotes: 2 },
    { id: '5', name: 'TITAN', avatar: 'https://picsum.photos/seed/titan/100/100', elo: 1400, goals: 1, assists: 1, paymentStatus: PaymentStatus.CONFIRMED, mvpVotes: 1 }
  ],
  teamB: [
    { id: '6', name: 'NINJA', avatar: 'https://picsum.photos/seed/ninja/100/100', elo: 1390, goals: 2, assists: 1, paymentStatus: PaymentStatus.CONFIRMED, mvpVotes: 15 },
    { id: '7', name: 'GHOST', avatar: 'https://picsum.photos/seed/ghost/100/100', elo: 1465, goals: 1, assists: 2, paymentStatus: PaymentStatus.NOT_PAID, mvpVotes: 3 },
    { id: '8', name: 'FROST', avatar: 'https://picsum.photos/seed/frost/100/100', elo: 1510, goals: 1, assists: 0, paymentStatus: PaymentStatus.REJECTED, mvpVotes: 5 },
    { id: '9', name: 'BLADE', avatar: 'https://picsum.photos/seed/blade/100/100', elo: 1280, goals: 1, assists: 1, paymentStatus: PaymentStatus.CONFIRMED, mvpVotes: 2 },
    { id: '10', name: 'RAVEN', avatar: 'https://picsum.photos/seed/raven/100/100', elo: 1350, goals: 0, assists: 1, paymentStatus: PaymentStatus.PENDING, mvpVotes: 1 }
  ],
  events: [
    { id: 'e1', type: 'goal', player: 'ZAYAC', assist: 'VULCAN', team: 'A', scoreAfter: '1 : 0', time: "05'", period: '1ST PERIOD' },
    { id: 'e2', type: 'goal', player: 'NINJA', team: 'B', scoreAfter: '1 : 1', time: "12'", period: '1ST PERIOD' },
    { id: 'e3', type: 'own_goal', player: 'TITAN', team: 'B', scoreAfter: '1 : 2', time: "28'", period: '1ST PERIOD' },
    { id: 'e4', type: 'goal', player: 'VULCAN', team: 'A', scoreAfter: '2 : 2', time: "34'", period: '2ND PERIOD' },
    { id: 'e5', type: 'goal', player: 'ZAYAC', assist: 'PHOENIX', team: 'A', scoreAfter: '3 : 2', time: "42'", period: '2ND PERIOD' }
  ],
  payer: {
    name: 'ALEXANDER K.',
    phone: '+7 (999) 123-45-67',
    bank: 'T-BANK'
  }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MatchTab>(MatchTab.RESULT);
  const [role, setRole] = useState<UserRole>(UserRole.ORGANIZER);
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(THEMES[0]);
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);

  // Apply theme to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-page', currentTheme.colors.bgPage);
    root.style.setProperty('--bg-surface', currentTheme.colors.bgSurface);
    root.style.setProperty('--bg-contrast', currentTheme.colors.bgContrast);
    root.style.setProperty('--text-main', currentTheme.colors.textMain);
    root.style.setProperty('--text-contrast', currentTheme.colors.textContrast);
    root.style.setProperty('--border-main', currentTheme.colors.borderMain);
  }, [currentTheme]);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-page)] max-w-md mx-auto border-x-2 border-[var(--border-main)] relative transition-colors duration-300">
      {/* FIXED HEADER AND TABS - ALWAYS AT TOP */}
      <div className="fixed top-0 left-0 right-0 max-w-md mx-auto z-50 bg-[var(--bg-surface)] border-x-2 border-[var(--border-main)]">
        <Header 
          matchDate={MOCK_DATA.date}
          matchTime={MOCK_DATA.time}
          matchStatus={MOCK_DATA.status}
          onThemeClick={() => setIsThemeSelectorOpen(true)}
        />
        <Tabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
      </div>

      {/* SCROLLABLE MAIN CONTENT */}
      <main className="flex-1 px-4 pt-36 pb-24 overflow-x-hidden transition-colors duration-300">
        {activeTab === MatchTab.RESULT && <ResultTab data={MOCK_DATA} role={role} />}
        {activeTab === MatchTab.EVENTS && <EventsTab data={MOCK_DATA} />}
        {activeTab === MatchTab.BEST && <BestTab data={MOCK_DATA} />}
      </main>

      {/* THEME SELECTOR MODAL */}
      {isThemeSelectorOpen && (
        <ThemeSelector 
          currentThemeId={currentTheme.id}
          onSelect={(theme) => {
            setCurrentTheme(theme);
            setIsThemeSelectorOpen(false);
          }}
          onClose={() => setIsThemeSelectorOpen(false)}
        />
      )}

      {/* Role Switcher for Demo - Float above everything */}
      <div className="fixed bottom-4 left-4 z-[60] flex flex-row gap-1 scale-75 origin-bottom-left opacity-30 hover:opacity-100 transition-opacity">
        <button onClick={() => setRole(UserRole.PLAYER)} className={`p-2 border-2 border-[var(--border-main)] font-black text-[10px] ${role === UserRole.PLAYER ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' : 'bg-[var(--bg-surface)] text-[var(--text-main)]'}`}>PLAYER</button>
        <button onClick={() => setRole(UserRole.PAYER)} className={`p-2 border-2 border-[var(--border-main)] font-black text-[10px] ${role === UserRole.PAYER ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' : 'bg-[var(--bg-surface)] text-[var(--text-main)]'}`}>PAYER</button>
        <button onClick={() => setRole(UserRole.ORGANIZER)} className={`p-2 border-2 border-[var(--border-main)] font-black text-[10px] ${role === UserRole.ORGANIZER ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' : 'bg-[var(--bg-surface)] text-[var(--text-main)]'}`}>ORG</button>
      </div>
    </div>
  );
};

export default App;
