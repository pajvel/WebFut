
import React, { useState } from 'react';
import { MatchData, UserRole, PaymentStatus, Player } from '../types';
import PlayerCard from './PlayerCard';

interface ResultTabProps {
  data: MatchData;
  role: UserRole;
}

const ResultTab: React.FC<ResultTabProps> = ({ data, role }) => {
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingPayer, setIsEditingPayer] = useState(false);
  
  // Feedback state
  const [bestPlayer, setBestPlayer] = useState<Player | null>(null);
  const [worstPlayer, setWorstPlayer] = useState<Player | null>(null);
  
  // Comparisons (Duels) - 3 pairs
  const [duels, setDuels] = useState<(string | null)[]>([null, null, null]);
  
  // Synergy - 2 players from each team
  const [synergyOwn, setSynergyOwn] = useState<Player[]>([]);
  const [synergyOpp, setSynergyOpp] = useState<Player[]>([]);
  
  // Domination - Pairs [Own, Opp]
  const [dominationOwn, setDominationOwn] = useState<[Player | null, Player | null]>([null, null]);
  const [dominationOpp, setDominationOpp] = useState<[Player | null, Player | null]>([null, null]);
  
  // Roles
  const [bestAttacker, setBestAttacker] = useState<Player | null>(null);
  const [bestDefender, setBestDefender] = useState<Player | null>(null);

  // UI state
  const [activePicker, setActivePicker] = useState<{
    type: 'SINGLE' | 'MULTI' | 'DUEL';
    target: string;
    limit?: number;
    teamFilter?: 'A' | 'B' | 'ALL';
    duelPair?: [Player, Player];
  } | null>(null);

  const [payerInfo, setPayerInfo] = useState({
    name: data.payer.name,
    phone: data.payer.phone,
    bank: data.payer.bank
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(payerInfo.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSavePayer = () => setIsEditingPayer(false);

  const allPlayers = [...data.teamA, ...data.teamB];

  // Mock Duel Pairs
  const duelPairs: [Player, Player][] = [
    [data.teamA[0], data.teamB[0]],
    [data.teamA[1], data.teamB[1]],
    [data.teamA[2], data.teamB[2]],
  ];

  const handleDuelPick = (index: number, playerId: string) => {
    const newDuels = [...duels];
    newDuels[index] = playerId;
    setDuels(newDuels);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* FINAL SCORE */}
      <section className="bg-[var(--bg-contrast)] rounded-[32px] p-6 text-[var(--text-contrast)] brutal-shadow">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-6 w-full">
          <div className="text-right flex flex-col items-end min-w-0">
             <div className="text-[9px] font-black italic opacity-40 uppercase tracking-widest leading-none mb-1">TEAM A</div>
             <div className="font-black italic text-base leading-tight uppercase line-clamp-2 w-full">{data.teamAName}</div>
          </div>
          <div className="mx-1 shrink-0">
            <div className="bg-[var(--bg-surface)] text-[var(--text-main)] rounded-[20px] px-5 py-4 flex items-center justify-center gap-2 border-b-4 border-black/20">
              <span className="text-4xl font-black italic leading-none">{data.scoreA}</span>
              <span className="text-2xl font-black opacity-20 italic">:</span>
              <span className="text-4xl font-black italic leading-none">{data.scoreB}</span>
            </div>
          </div>
          <div className="text-left flex flex-col items-start min-w-0">
             <div className="text-[9px] font-black italic opacity-40 uppercase tracking-widest leading-none mb-1">TEAM B</div>
             <div className="font-black italic text-base leading-tight uppercase line-clamp-2 w-full">{data.teamBName}</div>
          </div>
        </div>
        <div className="flex flex-col items-center">
           <div className="text-[10px] font-bold opacity-30 uppercase tracking-tight">
             {data.location}
           </div>
        </div>
      </section>

      {/* SQUAD LINEUPS */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-black italic uppercase opacity-40 whitespace-nowrap text-[var(--text-main)]">SQUAD LINEUPS</h2>
          <div className="h-[2px] bg-[var(--border-main)] opacity-10 flex-1"></div>
          <span className="text-xs font-black italic uppercase opacity-40 text-[var(--text-main)]">5 VS 5</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-2">
          <div className="space-y-2">
            {data.teamA.map(player => <PlayerCard key={player.id} player={player} variant="black" />)}
          </div>
          <div className="space-y-2">
            {data.teamB.map(player => <PlayerCard key={player.id} player={player} variant="white" />)}
          </div>
        </div>
      </section>

      {/* PAYMENTS */}
      <section className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-4 brutal-shadow space-y-4 rounded-[32px] transition-colors">
        <h2 className="text-base font-black italic uppercase leading-none text-[var(--text-main)]">PAYMENTS</h2>
        <div className="bg-black/5 p-3 border-2 border-[var(--border-main)] rounded-2xl relative">
          {isEditingPayer ? (
            <div className="space-y-2">
              <input type="text" value={payerInfo.name} onChange={(e) => setPayerInfo({...payerInfo, name: e.target.value})} className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-1.5 font-black text-xs italic uppercase rounded-lg text-[var(--text-main)]" placeholder="NAME" />
              <input type="text" value={payerInfo.phone} onChange={(e) => setPayerInfo({...payerInfo, phone: e.target.value})} className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-1.5 font-black text-xs italic uppercase rounded-lg text-[var(--text-main)]" placeholder="PHONE" />
              <input type="text" value={payerInfo.bank} onChange={(e) => setPayerInfo({...payerInfo, bank: e.target.value})} className="w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-1.5 font-black text-xs italic uppercase rounded-lg text-[var(--text-main)]" placeholder="BANK NAME" />
              <button onClick={handleSavePayer} className="w-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] py-2 font-black italic text-[9px] uppercase rounded-lg">SAVE DETAILS</button>
            </div>
          ) : (
            <>
              <div className="text-[9px] font-bold uppercase opacity-50 text-[var(--text-main)]">PAYER: {payerInfo.name}</div>
              <div className="font-black text-xs italic mt-0.5 text-[var(--text-main)]">{payerInfo.phone} ({payerInfo.bank})</div>
              {role === UserRole.PAYER ? (
                <button onClick={() => setIsEditingPayer(true)} className="absolute right-2 top-1/2 -translate-y-1/2 border-2 border-[var(--border-main)] px-3 py-1.5 font-black italic text-[8px] uppercase bg-[var(--bg-surface)] text-[var(--text-main)] active:scale-90 brutal-shadow-sm transition-all">EDIT</button>
              ) : (
                <button onClick={handleCopy} className={`absolute right-2 top-1/2 -translate-y-1/2 border-2 border-[var(--border-main)] px-3 py-1.5 font-black italic text-[8px] uppercase transition-all ${copied ? 'bg-green-500 text-white border-green-700' : 'bg-[var(--bg-surface)] text-[var(--text-main)] active:scale-90 brutal-shadow-sm'}`}>{copied ? 'COPIED' : 'COPY'}</button>
              )}
            </>
          )}
        </div>
        {(role === UserRole.PLAYER || role === UserRole.ORGANIZER) && (
          <div className="flex items-center justify-between gap-3 pt-1">
             <div className="flex-1">
                <div className="text-[9px] font-bold uppercase opacity-50 text-[var(--text-main)]">YOUR STATUS</div>
                <div className="font-black italic uppercase text-red-600 text-xs">NOT PAID</div>
             </div>
             <button className="bg-[var(--bg-contrast)] text-[var(--text-contrast)] font-black italic px-5 py-3 border-2 border-[var(--border-main)] brutal-shadow-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-[10px] uppercase rounded-xl">I SENT IT</button>
          </div>
        )}
        {(role === UserRole.PAYER || role === UserRole.ORGANIZER) && (
          <div className="space-y-2 pt-1">
            <button onClick={() => setIsListExpanded(!isListExpanded)} className="w-full flex items-center justify-between py-2 border-b-2 border-[var(--border-main)]/10 group text-[var(--text-main)]">
              <div className="text-[9px] font-black opacity-40 group-hover:opacity-100 transition-opacity uppercase">{isListExpanded ? 'HIDE PLAYER LIST' : 'SHOW PLAYER LIST'}</div>
              <svg className={`transition-transform duration-300 ${isListExpanded ? 'rotate-180' : ''}`} width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/></svg>
            </button>
            {isListExpanded && (
              <div className="max-h-64 overflow-y-auto pr-1 hide-scrollbar">
                {allPlayers.map(p => (
                  <div key={p.id} className="flex items-center justify-between border-b border-[var(--border-main)]/5 py-2">
                    <span className="font-black italic text-[11px] uppercase text-[var(--text-main)]">{p.name}</span>
                    <span className={`text-[9px] font-bold uppercase ${p.paymentStatus === PaymentStatus.CONFIRMED ? 'text-green-600' : p.paymentStatus === PaymentStatus.REJECTED ? 'text-red-600' : p.paymentStatus === PaymentStatus.PENDING ? 'text-yellow-600' : 'text-gray-400'}`}>{p.paymentStatus}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* FEEDBACK SECTION */}
      <section className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-4 brutal-shadow space-y-8 rounded-[32px] transition-colors">
        <h2 className="text-2xl font-black italic uppercase border-b-4 border-[var(--border-main)] pb-3 text-[var(--text-main)]">POST-MATCH FEEDBACK</h2>

        {/* 1. MVP / LVP */}
        <div className="grid grid-cols-2 gap-4">
          <FeedbackSlot label="MVP (BEST)" player={bestPlayer} onClick={() => setActivePicker({ type: 'SINGLE', target: 'BEST', teamFilter: 'ALL' })} />
          <FeedbackSlot label="LVP (WORST)" player={worstPlayer} onClick={() => setActivePicker({ type: 'SINGLE', target: 'WORST', teamFilter: 'ALL' })} color="bg-red-50" />
        </div>

        {/* 2. DUELS (3 Comparisons) */}
        <div className="space-y-3">
          <div className="text-[11px] font-black italic uppercase opacity-50 border-l-4 border-[var(--border-main)] pl-2 text-[var(--text-main)]">MATCH DUELS</div>
          <div className="space-y-2">
            {duelPairs.map((pair, idx) => (
              <div key={idx} className="flex items-center justify-between border-2 border-[var(--border-main)] rounded-2xl p-2 bg-black/5">
                <DuelPlayer player={pair[0]} isSelected={duels[idx] === pair[0].id} onClick={() => handleDuelPick(idx, pair[0].id)} />
                <div className="font-black italic text-xs opacity-20 px-2 italic text-[var(--text-main)]">VS</div>
                <DuelPlayer player={pair[1]} isSelected={duels[idx] === pair[1].id} onClick={() => handleDuelPick(idx, pair[1].id)} isRight />
              </div>
            ))}
          </div>
        </div>

        {/* 3. SYNERGY (Pick 2) */}
        <div className="space-y-3">
           <div className="text-[11px] font-black italic uppercase opacity-50 border-l-4 border-[var(--border-main)] pl-2 text-[var(--text-main)]">BEST SYNERGY (PICK 2)</div>
           <div className="grid grid-cols-2 gap-4">
             <SynergyBlock label="OUR TEAM" players={synergyOwn} onClick={() => setActivePicker({ type: 'MULTI', target: 'SYNERGY_OWN', limit: 2, teamFilter: 'A' })} />
             <SynergyBlock label="OPPONENTS" players={synergyOpp} onClick={() => setActivePicker({ type: 'MULTI', target: 'SYNERGY_OPP', limit: 2, teamFilter: 'B' })} />
           </div>
        </div>

        {/* 4. DOMINATION PAIRS */}
        <div className="space-y-3">
           <div className="text-[11px] font-black italic uppercase opacity-50 border-l-4 border-[var(--border-main)] pl-2 text-[var(--text-main)]">DOMINATION PAIRS</div>
           <div className="space-y-4">
              <DominationRow 
                title="HE DOMINATED" 
                p1={dominationOwn[0]} p2={dominationOwn[1]}
                onP1={() => setActivePicker({ type: 'SINGLE', target: 'DOM_OWN_1', teamFilter: 'A' })}
                onP2={() => setActivePicker({ type: 'SINGLE', target: 'DOM_OWN_2', teamFilter: 'B' })}
              />
              <DominationRow 
                title="HE WAS STRONGER" 
                p1={dominationOpp[0]} p2={dominationOpp[1]} 
                onP1={() => setActivePicker({ type: 'SINGLE', target: 'DOM_OPP_1', teamFilter: 'B' })}
                onP2={() => setActivePicker({ type: 'SINGLE', target: 'DOM_OPP_2', teamFilter: 'A' })}
                reverse
              />
           </div>
        </div>

        {/* 5. SPECIAL ROLES */}
        <div className="grid grid-cols-2 gap-4">
          <FeedbackSlot label="BEST ATTACKER" player={bestAttacker} onClick={() => setActivePicker({ type: 'SINGLE', target: 'ATTACKER', teamFilter: 'ALL' })} />
          <FeedbackSlot label="BEST DEFENDER" player={bestDefender} onClick={() => setActivePicker({ type: 'SINGLE', target: 'DEFENDER', teamFilter: 'ALL' })} />
        </div>

        <button 
          onClick={() => setFeedbackSaved(true)}
          className={`w-full py-5 font-black italic uppercase border-4 border-[var(--border-main)] brutal-shadow transition-all text-sm rounded-2xl
            ${feedbackSaved ? 'bg-green-500 text-black border-green-800' : 'bg-[var(--bg-contrast)] text-[var(--text-contrast)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'}
          `}
        >
          {feedbackSaved ? '✓ SAVED' : 'SAVE ALL FEEDBACK'}
        </button>
      </section>

      {/* REUSABLE PICKER OVERLAY */}
      {activePicker && (
        <PlayerPickerOverlay 
          config={activePicker} 
          players={allPlayers} 
          onClose={() => setActivePicker(null)} 
          onConfirm={(selected) => {
            if (activePicker.target === 'BEST') setBestPlayer(selected[0]);
            if (activePicker.target === 'WORST') setWorstPlayer(selected[0]);
            if (activePicker.target === 'SYNERGY_OWN') setSynergyOwn(selected);
            if (activePicker.target === 'SYNERGY_OPP') setSynergyOpp(selected);
            if (activePicker.target === 'DOM_OWN_1') setDominationOwn([selected[0], dominationOwn[1]]);
            if (activePicker.target === 'DOM_OWN_2') setDominationOwn([dominationOwn[0], selected[0]]);
            if (activePicker.target === 'DOM_OPP_1') setDominationOpp([selected[0], dominationOpp[1]]);
            if (activePicker.target === 'DOM_OPP_2') setDominationOpp([dominationOpp[0], selected[0]]);
            if (activePicker.target === 'ATTACKER') setBestAttacker(selected[0]);
            if (activePicker.target === 'DEFENDER') setBestDefender(selected[0]);
            setActivePicker(null);
          }}
          data={data}
        />
      )}
    </div>
  );
};

// --- SUB-COMPONENTS ---

const FeedbackSlot = ({ label, player, onClick, color = 'bg-black/5' }: any) => (
  <div className="space-y-2">
    <div className="text-[9px] font-black italic uppercase opacity-40 tracking-wider text-[var(--text-main)]">{label}</div>
    <button onClick={onClick} className={`w-full aspect-square border-2 border-[var(--border-main)] rounded-2xl flex flex-col items-center justify-center p-2 brutal-shadow-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all ${player ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' : color}`}>
      {player ? (
        <>
          <img src={player.avatar} className="w-14 h-14 border-2 border-white rounded-xl mb-1 grayscale" />
          <span className="font-black italic text-[10px] uppercase truncate w-full">{player.name}</span>
        </>
      ) : (
        <div className="flex flex-col items-center opacity-30 text-[var(--text-main)]">
          <div className="text-xl font-black">+</div>
          <div className="text-[8px] font-black italic uppercase">PICK</div>
        </div>
      )}
    </button>
  </div>
);

const DuelPlayer = ({ player, isSelected, onClick, isRight }: any) => (
  <button onClick={onClick} className={`flex-1 flex items-center gap-2 p-1.5 rounded-xl border-2 transition-all ${isSelected ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)] border-[var(--border-main)]' : 'bg-[var(--bg-surface)] border-transparent text-[var(--text-main)]'} ${isRight ? 'flex-row-reverse text-right' : ''}`}>
    <img src={player.avatar} className="w-8 h-8 rounded-lg border border-black/20 grayscale" />
    <span className="font-black italic text-[10px] uppercase truncate">{player.name}</span>
  </button>
);

const SynergyBlock = ({ label, players, onClick }: any) => (
  <div className="space-y-2">
    <div className="text-[9px] font-black italic uppercase opacity-40 tracking-wider text-[var(--text-main)]">{label}</div>
    <button onClick={onClick} className="w-full border-2 border-[var(--border-main)] rounded-2xl p-2 bg-black/5 brutal-shadow-sm flex items-center justify-center gap-1 min-h-[60px]">
      {players.length > 0 ? (
        <div className="flex -space-x-4">
          {players.map((p: any) => <img key={p.id} src={p.avatar} className="w-10 h-10 border-2 border-[var(--border-main)] rounded-xl grayscale bg-[var(--bg-surface)]" />)}
        </div>
      ) : (
        <span className="text-[9px] font-black italic opacity-30 uppercase text-[var(--text-main)]">SELECT 2</span>
      )}
    </button>
  </div>
);

const DominationRow = ({ title, p1, p2, onP1, onP2, reverse }: any) => (
  <div className="space-y-2">
    <div className="text-[9px] font-black italic uppercase opacity-40 text-center tracking-widest text-[var(--text-main)]">{title}</div>
    <div className="flex items-center gap-4">
      <DomMiniSlot player={p1} onClick={onP1} />
      <div className="text-xl font-black italic opacity-20 text-[var(--text-main)]">{reverse ? '<' : '>'}</div>
      <DomMiniSlot player={p2} onClick={onP2} />
    </div>
  </div>
);

const DomMiniSlot = ({ player, onClick }: any) => (
  <button onClick={onClick} className={`flex-1 flex items-center gap-3 p-2 border-2 border-[var(--border-main)] rounded-2xl transition-all brutal-shadow-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${player ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' : 'bg-[var(--bg-surface)] text-[var(--text-main)]'}`}>
    {player ? (
      <>
        <img src={player.avatar} className="w-8 h-8 rounded-lg border border-white grayscale" />
        <span className="font-black italic text-[10px] uppercase truncate">{player.name}</span>
      </>
    ) : (
      <span className="w-full text-center text-[9px] font-black opacity-30 italic">PICK</span>
    )}
  </button>
);

const PlayerPickerOverlay = ({ config, players, onClose, onConfirm, data }: any) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const filteredPlayers = players.filter((p: any) => {
    if (config.teamFilter === 'A') return data.teamA.find((tp: any) => tp.id === p.id);
    if (config.teamFilter === 'B') return data.teamB.find((tp: any) => tp.id === p.id);
    return true;
  });

  const handleSelect = (p: Player) => {
    if (config.type === 'SINGLE') {
      onConfirm([p]);
    } else {
      if (selectedIds.includes(p.id)) {
        setSelectedIds(selectedIds.filter(id => id !== p.id));
      } else if (selectedIds.length < (config.limit || 1)) {
        setSelectedIds([...selectedIds, p.id]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-end animate-in fade-in">
       <div className="w-full bg-[var(--bg-surface)] border-t-4 border-[var(--border-main)] rounded-t-[40px] p-6 max-h-[85vh] overflow-y-auto brutal-shadow animate-in slide-in-from-bottom-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black italic uppercase text-[var(--text-main)]">SELECT PLAYER</h3>
            <button onClick={onClose} className="w-10 h-10 border-2 border-[var(--border-main)] flex items-center justify-center font-black rounded-full text-[var(--text-main)]">X</button>
          </div>
          <div className="grid grid-cols-2 gap-3 pb-8">
            {filteredPlayers.map((p: any) => (
              <button 
                key={p.id} 
                onClick={() => handleSelect(p)} 
                className={`flex items-center p-2 border-2 border-[var(--border-main)] rounded-xl transition-all gap-3 ${selectedIds.includes(p.id) ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' : 'bg-[var(--bg-surface)] text-[var(--text-main)] active:bg-black/5'}`}
              >
                <img src={p.avatar} className={`w-10 h-10 rounded-lg grayscale border ${selectedIds.includes(p.id) ? 'border-white' : 'border-[var(--border-main)]'}`} />
                <span className="font-black italic text-[11px] uppercase truncate">{p.name}</span>
              </button>
            ))}
          </div>
          {config.type === 'MULTI' && (
            <button 
              disabled={selectedIds.length !== config.limit}
              onClick={() => onConfirm(selectedIds.map(id => players.find((p: any) => p.id === id)))}
              className="w-full py-4 bg-[var(--bg-contrast)] text-[var(--text-contrast)] font-black italic uppercase rounded-2xl disabled:opacity-20 transition-all border-2 border-[var(--border-main)] brutal-shadow-sm"
            >
              CONFIRM SELECTION ({selectedIds.length}/{config.limit})
            </button>
          )}
       </div>
    </div>
  );
};

export default ResultTab;
