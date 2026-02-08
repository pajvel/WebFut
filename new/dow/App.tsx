
import React, { useState, useEffect } from 'react';
import UsersSection from './sections/UsersSection';
import MatchesSection from './sections/MatchesSection';
import TgLinkingSection from './sections/TgLinkingSection';
import { RatingLogsSection, FeedbackLogsSection, PositionLogsSection } from './sections/LogsSections';
import InteractionsSection from './sections/InteractionsSection';

type Tab = 'USERS' | 'MATCHES' | 'TG_LINK' | 'RATING_LOGS' | 'INTERACTIONS' | 'FEEDBACK' | 'POSITION_LOGS';

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Scanning Line Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="w-full h-[2px] bg-webfut-pink shadow-[0_0_15px_#FFB1CF] animate-[scan_2s_linear_infinite]"></div>
      </div>
      
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #FFF 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      <div className="relative text-center flex flex-col items-center animate-in fade-in zoom-in duration-700">
        <h1 className="text-7xl lg:text-9xl text-900 italic tracking-tighter leading-none text-white mb-4">
          WEBFUT
        </h1>
        
        {/* Subtitle with Pink Background */}
        <div className="bg-webfut-pink text-black px-8 py-2 text-[10px] lg:text-sm text-900 uppercase tracking-[0.2em] inline-block italic transform mb-16">
          YOUR FOOTBALL TEAM AI-HELPER
        </div>

        {/* Loading Progress Bar Container - Exactly like the image */}
        <div className="w-72 lg:w-96 mx-auto">
          <div className="flex justify-between items-end mb-2 px-0.5">
            <span className="text-[10px] text-zinc-500 font-black tracking-[0.1em] uppercase italic">Initializing Modules</span>
            <span className="text-[10px] text-webfut-pink font-mono italic animate-pulse">LOADING...</span>
          </div>
          
          <div className="h-[3px] w-full bg-zinc-900 overflow-hidden relative border border-zinc-800/50">
            <div className="h-full bg-webfut-pink animate-[progress_2.5s_ease-in-out_forwards] shadow-[0_0_10px_rgba(255,177,207,0.5)]"></div>
          </div>
          
          <div className="mt-2.5 flex justify-between text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
            <span>Core v3.1</span>
            <span>Est. Time 2.5s</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 left-0 w-full text-center px-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-px bg-zinc-800/50"></div>
          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[1.2em] italic opacity-80">
            PRODUCT BY PAJVEL
          </p>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          from { transform: translateY(-100%); }
          to { transform: translateY(1000%); }
        }
        @keyframes progress {
          0% { width: 0%; }
          20% { width: 15%; }
          45% { width: 45%; }
          75% { width: 85%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('USERS');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Simulate initial system load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const navItems = [
    { id: 'USERS', label: 'ПОЛЬЗОВАТЕЛИ' },
    { id: 'MATCHES', label: 'МАТЧИ' },
    { id: 'TG_LINK', label: 'TG ↔ ПРОФИЛИ' },
    { id: 'RATING_LOGS', label: 'RATING LOGS' },
    { id: 'POSITION_LOGS', label: 'POSITION LOGS' },
    { id: 'INTERACTIONS', label: 'INTERACTIONS' },
    { id: 'FEEDBACK', label: 'FEEDBACK LOGS' },
  ];

  const handleTabChange = (id: Tab) => {
    setActiveTab(id);
    setIsMenuOpen(false);
  };

  const handleBack = () => {
    if (activeTab !== 'USERS') {
      setActiveTab('USERS');
    }
  };

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden relative">
      {/* Mobile Backdrop */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] lg:hidden" 
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 bg-black flex flex-col relative overflow-hidden min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden h-14 shrink-0 flex items-center justify-between px-4 border-b border-webfut-border bg-black/90 backdrop-blur-md z-40">
          <button onClick={handleBack} className="text-white p-1 hover:text-webfut-pink active:scale-95 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span className="text-900 italic tracking-tighter uppercase text-base absolute left-1/2 -translate-x-1/2">
            {activeTab.replace('_', ' ')}
          </span>

          <button onClick={() => setIsMenuOpen(true)} className="text-white p-1 hover:text-webfut-pink active:scale-95 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #FFF 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        
        <div className="relative z-10 flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-full">
            {activeTab === 'USERS' && <UsersSection />}
            {activeTab === 'MATCHES' && <MatchesSection />}
            {activeTab === 'TG_LINK' && <TgLinkingSection />}
            {activeTab === 'RATING_LOGS' && <RatingLogsSection />}
            {activeTab === 'POSITION_LOGS' && <PositionLogsSection />}
            {activeTab === 'INTERACTIONS' && <InteractionsSection />}
            {activeTab === 'FEEDBACK' && <FeedbackLogsSection />}
          </div>
        </div>
      </main>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 right-0 z-[70] w-64 border-l border-webfut-border bg-black flex flex-col shrink-0 transition-transform duration-300
        lg:relative lg:translate-x-0 lg:border-l lg:border-r-0
        ${isMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-webfut-border bg-black flex justify-between items-center shrink-0">
          <h1 className="text-2xl lg:text-3xl text-900 tracking-tighter italic leading-none">
            WEBFUT<br/><span className="text-webfut-pink text-[10px] lg:text-sm uppercase not-italic tracking-widest">ADMIN PANEL</span>
          </h1>
          <button onClick={() => setIsMenuOpen(false)} className="lg:hidden text-zinc-500 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-6 mb-2 text-[10px] text-zinc-500 text-900 uppercase tracking-widest">ОСНОВНОЕ</div>
          <ul className="space-y-px">
            {navItems.slice(0, 2).map(item => (
              <li key={item.id}>
                <button 
                  onClick={() => handleTabChange(item.id as Tab)}
                  className={`w-full text-left px-6 py-3 text-900 uppercase italic tracking-tighter transition-all ${activeTab === item.id ? 'bg-webfut-pink text-black -translate-x-1 lg:translate-x-1' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="px-6 mt-8 mb-2 text-[10px] text-zinc-500 text-900 uppercase tracking-widest">АНАЛИТИКА И ЛОГИ</div>
          <ul className="space-y-px">
            {navItems.slice(2).map(item => (
              <li key={item.id}>
                <button 
                  onClick={() => handleTabChange(item.id as Tab)}
                  className={`w-full text-left px-6 py-2 text-700 uppercase tracking-tight transition-all text-xs ${activeTab === item.id ? 'bg-white text-black -translate-x-1 lg:translate-x-1' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
};

export default App;
