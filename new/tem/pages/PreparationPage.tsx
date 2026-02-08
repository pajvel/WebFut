
import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import PlayerCard from '../components/PlayerCard';
import { Player, UserRole, MatchConfig, TeamVariant, ThemeId } from '../types';
import { THEMES } from '../App';

interface PreparationPageProps {
  role: UserRole;
  players: Player[];
  config: MatchConfig;
  activeThemeId: ThemeId;
  onSetTheme: (id: ThemeId) => void;
  onSetVariant: (idx: number) => void;
  onSetPayer: (id: string) => void;
  onCreateTeams: () => void;
  onBack: () => void;
}

const TEAM_NAMES = [
  'Vortex', 'Titans', 'Dragons', 'Storm', 'Shadows', 
  'Phoenix', 'Cobras', 'Wolves', 'Cyber', 'Striker',
  'Zenith', 'Apex', 'Raptors', 'Phantoms', 'Gladiators'
];

const PreparationPage: React.FC<PreparationPageProps> = ({ 
  role, players, config, activeThemeId, onSetTheme, onSetVariant, onSetPayer, onCreateTeams, onBack 
}) => {
  const isOrganizer = role === 'ORGANIZER';
  const isGenerating = config.status === 'GENERATING';

  const [selectedPlayer, setSelectedPlayer] = useState<{ team: 'A' | 'B', index: number } | null>(null);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [teamAName, setTeamAName] = useState('TEAM ALPHA');
  const [teamBName, setTeamBName] = useState('TEAM BETA');

  const variants: TeamVariant[] = [
    {
      id: 0,
      teamA: { name: 'Alpha', players: players.slice(0, 5) },
      teamB: { name: 'Beta', players: players.slice(5, 10) },
      explanation: 'Optimal balance based on individual skills. Recommended for a fair and intense match.'
    },
    {
      id: 1,
      teamA: { name: 'Gamma', players: [players[0], players[2], players[4], players[6], players[8]] },
      teamB: { name: 'Delta', players: [players[1], players[3], players[5], players[7], players[9]] },
      explanation: 'Experimental parity. Team B has a stronger defense, while Team A dominates in midfield elo.'
    }
  ];

  const currentVariant = variants[config.activeVariantIdx] || variants[0];
  const formatParts = config.format.split(' vs ').map(s => parseInt(s.trim()));
  const sizeA = formatParts[0] || 5;
  const sizeB = formatParts[1] || 5;

  const [teamA, setTeamA] = useState<Player[]>(currentVariant.teamA.players.slice(0, sizeA));
  const [teamB, setTeamB] = useState<Player[]>(currentVariant.teamB.players.slice(0, sizeB));

  useEffect(() => {
    setTeamA(currentVariant.teamA.players.slice(0, sizeA));
    setTeamB(currentVariant.teamB.players.slice(0, sizeB));
  }, [config.activeVariantIdx, config.format]);

  const handlePlayerClick = (team: 'A' | 'B', index: number) => {
    if (!isOrganizer || !isGenerating) return;
    if (!selectedPlayer) {
      setSelectedPlayer({ team, index });
    } else {
      const newTeamA = [...teamA];
      const newTeamB = [...teamB];
      if (selectedPlayer.team === 'A' && team === 'B') {
        const pA = newTeamA[selectedPlayer.index];
        const pB = newTeamB[index];
        newTeamA[selectedPlayer.index] = pB;
        newTeamB[index] = pA;
      } else if (selectedPlayer.team === 'B' && team === 'A') {
        const pB = newTeamB[selectedPlayer.index];
        const pA = newTeamA[index];
        newTeamB[selectedPlayer.index] = pA;
        newTeamA[index] = pB;
      } else if (selectedPlayer.team === team) {
        setSelectedPlayer({ team, index });
        return;
      }
      setTeamA(newTeamA);
      setTeamB(newTeamB);
      setSelectedPlayer(null);
    }
  };

  const executeSwap = (idxA: number, idxB: number) => {
    const newTeamA = [...teamA];
    const newTeamB = [...teamB];
    const pA = newTeamA[idxA];
    const pB = newTeamB[idxB];
    newTeamA[idxA] = pB;
    newTeamB[idxB] = pA;
    setTeamA(newTeamA);
    setTeamB(newTeamB);
  };

  const randomizeName = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    const randomName = TEAM_NAMES[Math.floor(Math.random() * TEAM_NAMES.length)];
    setter(randomName.toUpperCase());
  };

  const currentDisplayA = isGenerating ? teamA : Array(3).fill(null);
  const currentDisplayB = isGenerating ? teamB : Array(3).fill(null);
  const payer = players.find(p => p.id === config.payerId);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--bg-page)] relative">
      <Header onBack={onBack} onThemeClick={() => setShowThemeModal(true)} />
      
      <div className="flex-1 overflow-y-auto p-3 space-y-4 pb-48">
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col">
            <h2 className="font-black italic text-[var(--text-main)] uppercase text-xl leading-none tracking-tighter">{config.format}</h2>
            <span className="font-bold text-[8px] opacity-50 uppercase tracking-widest text-[var(--text-main)]">Match Sync Active</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-main)] px-2 py-1 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="font-black italic text-[9px] text-[var(--text-main)] opacity-60 uppercase tracking-widest">
              {isGenerating ? 'GENERATING' : 'WAITING'}
            </span>
          </div>
        </div>

        {isGenerating && isOrganizer && (
          <div className="space-y-2">
            <p className="font-black text-[9px] opacity-40 uppercase px-1 tracking-widest text-[var(--text-main)]">Balance Engine Presets</p>
            <div className="flex gap-1.5 p-1 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-main)]">
              {variants.map((v, i) => (
                <button 
                  key={v.id} 
                  onClick={() => onSetVariant(i)}
                  className={`flex-1 py-2 font-black italic uppercase text-[10px] rounded-lg transition-all ${config.activeVariantIdx === i ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)] shadow-brutal-sm scale-[1.02]' : 'text-[var(--text-main)] opacity-40 hover:opacity-100'}`}
                >
                  Preset {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="p-2 bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-xl text-center">
               <span className="font-black italic text-[10px] text-[var(--text-main)] uppercase tracking-tighter">{teamAName}</span>
            </div>
            <div className="space-y-1.5">
              {currentDisplayA.map((p, i) => (
                <div 
                  key={p ? p.id : `empty-a-${i}`} 
                  onClick={() => handlePlayerClick('A', i)}
                  className={`transition-all duration-200 ${selectedPlayer?.team === 'A' && selectedPlayer.index === i ? 'scale-105 border-green-500 border-2 rounded-xl z-10' : ''}`}
                >
                  {p ? <PlayerCard player={p} size="lg" /> : 
                  <div className="h-14 border-2 border-dashed border-[var(--border-main)] rounded-xl bg-[var(--bg-surface)] flex items-center justify-center">
                     <span className="font-black italic text-[8px] text-[var(--text-main)] opacity-40 uppercase tracking-widest">EMPTY</span>
                  </div>}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="p-2 bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-xl text-center">
               <span className="font-black italic text-[10px] text-[var(--text-main)] uppercase tracking-tighter">{teamBName}</span>
            </div>
            <div className="space-y-1.5">
              {currentDisplayB.map((p, i) => (
                <div 
                  key={p ? p.id : `empty-b-${i}`} 
                  onClick={() => handlePlayerClick('B', i)}
                  className={`transition-all duration-200 ${selectedPlayer?.team === 'B' && selectedPlayer.index === i ? 'scale-105 border-green-500 border-2 rounded-xl z-10' : ''}`}
                >
                  {p ? <PlayerCard player={p} size="lg" /> : 
                  <div className="h-14 border-2 border-dashed border-[var(--border-main)] rounded-xl bg-[var(--bg-surface)] flex items-center justify-center">
                     <span className="font-black italic text-[8px] text-[var(--text-main)] opacity-40 uppercase tracking-widest">EMPTY</span>
                  </div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {isGenerating && (
          <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-4 rounded-[2rem] border-l-[var(--border-main)] border-l-4">
            <h4 className="font-black italic uppercase text-[10px] opacity-40 mb-1 text-[var(--text-main)]">Strategy Analysis</h4>
            <p className="font-bold text-xs text-[var(--text-main)] italic leading-snug">
              {currentVariant.explanation}
            </p>
          </div>
        )}

        {isGenerating && isOrganizer && (
          <div className="space-y-3">
            <p className="font-black text-[9px] opacity-40 uppercase px-1 tracking-widest text-[var(--text-main)]">Recommended 1v1 Swaps</p>
            <div className="grid grid-cols-1 gap-2">
              {[0, 1, 2].map(i => (
                <button 
                  key={i} 
                  onClick={() => executeSwap(i, i)}
                  className="flex items-center justify-between p-3 bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-2xl active:scale-95 shadow-brutal-sm group"
                >
                  <span className="font-black text-[10px] italic uppercase text-[var(--text-main)] truncate w-24 text-left">{teamA[i]?.name}</span>
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg-contrast)] transition-colors">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-contrast)" strokeWidth="3">
                       <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />
                     </svg>
                  </div>
                  <span className="font-black text-[10px] italic uppercase text-[var(--text-main)] truncate w-24 text-right">{teamB[i]?.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[var(--bg-surface)] p-5 border-2 border-[var(--border-main)] rounded-[2.5rem] shadow-brutal">
          <div className="flex items-center justify-between mb-4">
             <div className="flex flex-col">
               <h3 className="font-black italic uppercase text-lg leading-none text-[var(--text-main)]">Payer</h3>
               <span className="font-bold text-[8px] opacity-50 uppercase tracking-wider text-[var(--text-main)]">
                 {payer ? `Active: ${payer.name}` : 'Awaiting Selection'}
               </span>
             </div>
             <span className={`px-2 py-1 rounded-lg border-2 border-[var(--border-main)] font-black text-[9px] uppercase tracking-tighter ${payer ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' : 'bg-[var(--bg-page)] text-[var(--text-main)] opacity-50'}`}>
               {payer ? 'SELECTED' : 'PENDING'}
             </span>
          </div>
          <button 
            onClick={() => setShowPayerModal(true)}
            className={`w-full py-4 font-black italic uppercase text-sm shadow-brutal active:shadow-none transition-all ${isOrganizer ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' : 'bg-[var(--bg-surface)] border-2 border-[var(--border-main)] text-[var(--text-main)]'}`}
          >
            {isOrganizer ? 'Assign Payer' : 'Become Payer'}
          </button>
        </div>

        {!isGenerating && (
          <div className="space-y-3">
            <h3 className="font-black italic opacity-40 uppercase text-[10px] tracking-widest px-1 text-[var(--text-main)]">Registered Pool</h3>
            <div className="grid grid-cols-2 gap-2">
              {players.map(p => (
                <PlayerCard key={p.id} player={p} size="sm" />
              ))}
            </div>
          </div>
        )}
      </div>

      {isOrganizer && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-[var(--bg-page)] border-t-2 border-[var(--border-main)] z-40">
          <button 
            onClick={isGenerating ? () => setShowFinalModal(true) : onCreateTeams}
            className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] py-4 font-black italic uppercase text-lg shadow-[6px_6px_0px_0px_var(--border-main)] border-2 border-[var(--border-main)] active:shadow-none transition-all"
          >
            {isGenerating ? 'Confirm Squads' : 'Create Teams'}
          </button>
        </div>
      )}

      {/* Theme Selection Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-[var(--bg-page)]">
          <div className="flex-none p-4 bg-[var(--bg-surface)] border-b-4 border-[var(--border-main)]">
            <div className="flex items-center justify-between">
              <h2 className="font-black italic uppercase text-xl text-[var(--text-main)]">Select Theme</h2>
              <button onClick={() => setShowThemeModal(false)} className="w-10 h-10 border-2 border-[var(--border-main)] shadow-brutal-sm active:shadow-none flex items-center justify-center bg-[var(--bg-surface)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             <div className="grid grid-cols-2 gap-3">
               {THEMES.map(theme => (
                 <button 
                  key={theme.id}
                  onClick={() => { onSetTheme(theme.id); setShowThemeModal(false); }}
                  className={`relative p-4 border-2 border-[var(--border-main)] rounded-2xl text-left overflow-hidden transition-all active:scale-95 ${activeThemeId === theme.id ? 'shadow-brutal bg-[var(--bg-surface)] ring-2 ring-[var(--border-main)]' : 'bg-[var(--bg-surface)]'}`}
                  style={{ borderLeftColor: theme.colors.bgContrast, borderLeftWidth: '8px' }}
                 >
                   <div className="font-black italic uppercase text-sm mb-1 text-[var(--text-main)]">{theme.name}</div>
                   <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: theme.colors.bgContrast }}></div>
                      <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: theme.colors.bgPage }}></div>
                      <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: theme.colors.borderMain }}></div>
                   </div>
                   {activeThemeId === theme.id && (
                     <div className="absolute top-2 right-2 w-4 h-4 bg-[var(--border-main)] rounded-full flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--bg-surface)" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg>
                     </div>
                   )}
                 </button>
               ))}
             </div>
          </div>
          <div className="p-4 bg-[var(--bg-page)] border-t-2 border-[var(--border-main)]">
             <button onClick={() => setShowThemeModal(false)} className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] p-4 font-black uppercase text-xs border-2 border-[var(--border-main)] shadow-brutal">Close</button>
          </div>
        </div>
      )}

      {showFinalModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-sm">
          <div className="w-full bg-[var(--bg-surface)] border-4 border-[var(--border-main)] p-6 rounded-[2.5rem] shadow-[12px_12px_0px_0px_var(--border-main)]">
            <h2 className="font-black italic uppercase text-2xl mb-6 leading-none text-[var(--text-main)]">Final Step</h2>
            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <label className="font-black italic text-[10px] opacity-40 uppercase tracking-widest ml-1 text-[var(--text-main)]">Team A Name</label>
                <div className="flex gap-2">
                  <input value={teamAName} onChange={(e) => setTeamAName(e.target.value.toUpperCase())} className="flex-1 bg-[var(--bg-page)] border-2 border-[var(--border-main)] p-3 font-black italic uppercase text-xs focus:outline-none text-[var(--text-main)]" placeholder="ENTER NAME..."/>
                  <button onClick={() => randomizeName(setTeamAName)} className="bg-[var(--bg-contrast)] text-[var(--text-contrast)] p-3 border-2 border-[var(--border-main)] shadow-brutal-sm active:scale-95 transition-transform">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 4h7v7H4V4zM13 13h7v7h-7v-7zM4 13h7v7H4v-7zM13 4h7v7h-7V4z" /></svg>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-black italic text-[10px] opacity-40 uppercase tracking-widest ml-1 text-[var(--text-main)]">Team B Name</label>
                <div className="flex gap-2">
                  <input value={teamBName} onChange={(e) => setTeamBName(e.target.value.toUpperCase())} className="flex-1 bg-[var(--bg-page)] border-2 border-[var(--border-main)] p-3 font-black italic uppercase text-xs focus:outline-none text-[var(--text-main)]" placeholder="ENTER NAME..."/>
                  <button onClick={() => randomizeName(setTeamBName)} className="bg-[var(--bg-contrast)] text-[var(--text-contrast)] p-3 border-2 border-[var(--border-main)] shadow-brutal-sm active:scale-95 transition-transform">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 4h7v7H4V4zM13 13h7v7h-7v-7zM4 13h7v7H4v-7zM13 4h7v7h-7V4z" /></svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => { alert(`Match Started: ${teamAName} vs ${teamBName}`); setShowFinalModal(false); }} className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] p-4 font-black italic uppercase text-sm shadow-[6px_6px_0px_0px_var(--border-main)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all">Launch Match</button>
              <button onClick={() => setShowFinalModal(false)} className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-3 font-black uppercase text-[10px] active:scale-95 text-[var(--text-main)]">Back to Editor</button>
            </div>
          </div>
        </div>
      )}

      {showPayerModal && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg-page)]">
          <div className="flex-none p-4 bg-[var(--bg-surface)] border-b-4 border-[var(--border-main)]">
            <div className="flex items-center justify-between">
              <h2 className="font-black italic uppercase text-xl text-[var(--text-main)]">Select Payer</h2>
              <button onClick={() => setShowPayerModal(false)} className="w-10 h-10 border-2 border-[var(--border-main)] shadow-brutal-sm active:shadow-none flex items-center justify-center bg-[var(--bg-surface)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {players.map(p => (
              <button 
                key={p.id} 
                onClick={() => { onSetPayer(p.id); setShowPayerModal(false); }}
                className={`w-full flex items-center p-3 border-2 border-[var(--border-main)] rounded-2xl transition-all active:scale-95 ${config.payerId === p.id ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)] shadow-brutal scale-[1.02]' : 'bg-[var(--bg-surface)] text-[var(--text-main)]'}`}
              >
                <img src={p.avatar} className="w-10 h-10 rounded-full border-2 border-[var(--border-main)] mr-3" alt=""/>
                <div className="flex-1 text-left">
                  <div className="font-black italic uppercase text-sm leading-none mb-1">{p.name}</div>
                  <div className="font-bold text-[8px] uppercase tracking-widest opacity-50">PLAYER ELO: {p.elo}</div>
                </div>
                {config.payerId === p.id && (
                  <div className="w-6 h-6 bg-[var(--text-contrast)] text-[var(--text-main)] rounded-full flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="p-4 bg-[var(--bg-page)] border-t-2 border-[var(--border-main)]">
             <button onClick={() => setShowPayerModal(false)} className="w-full bg-[var(--bg-surface)] p-4 font-black uppercase text-xs border-2 border-[var(--border-main)] text-[var(--text-main)]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreparationPage;
