
import React, { useState, useMemo } from 'react';
import { RatingLog, FeedbackLog, PositionLog } from '../types';
import { mockRatingLogs, mockFeedbackLogs, mockPlayers, mockPositionLogs } from '../data/mockData';
import { SectionHeader, ActionButton, Badge } from '../components/Shared';

const getPlayerName = (id: string) => mockPlayers.find(p => p.id === id)?.name || id;

export const PositionLogsSection: React.FC = () => {
  const [logs] = useState<PositionLog[]>(mockPositionLogs);
  const [search, setSearch] = useState('');

  const filtered = logs.filter(l => getPlayerName(l.player_id).toLowerCase().includes(search.toLowerCase()));

  const getSourceLabel = (source: PositionLog['source']) => {
    const labels: Record<PositionLog['source'], string> = {
      match: 'МАТЧ',
      feedback: 'ФИДБЕК',
      manual: 'ВРУЧНУЮ',
      rebuild: 'REBUILD'
    };
    return labels[source] || source.toUpperCase();
  };

  const getSourceColor = (source: PositionLog['source']) => {
    switch (source) {
      case 'match': return 'text-zinc-500';
      case 'feedback': return 'text-webfut-pink';
      case 'manual': return 'text-white';
      case 'rebuild': return 'text-yellow-500';
      default: return 'text-zinc-500';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <SectionHeader title="POSITION LOGS">
        <ActionButton variant="outline" className="text-[10px] py-1 border-zinc-700">EXPORT</ActionButton>
      </SectionHeader>

      <div className="mb-4">
        <input 
          placeholder="ПОИСК ПО ИГРОКУ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-webfut-border text-white px-3 py-2 text-[11px] text-900 uppercase italic outline-none focus:border-webfut-pink"
        />
      </div>

      <div className="flex-1 overflow-auto space-y-1 pb-20">
        {filtered.map(l => (
          <div key={l.id} className="bg-webfut-gray border border-webfut-border p-3 hover:bg-zinc-900 transition-all flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[10px] text-zinc-600 font-mono shrink-0">{l.date.split(',')[0]}</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 uppercase tracking-tighter ${l.type === 'ATTACK' ? 'bg-webfut-pink text-black' : 'bg-white text-black'}`}>
                  {l.type}
                </span>
                <span className="text-sm text-900 uppercase italic truncate">{getPlayerName(l.player_id)}</span>
                <span className={`text-[9px] font-black uppercase italic tracking-widest ml-1 ${getSourceColor(l.source)}`}>
                  / {getSourceLabel(l.source)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-[9px] text-zinc-500 font-black">BEFORE</span>
                  <span className="text-lg text-900 font-mono tracking-tighter">{l.oldValue.toFixed(2)}</span>
                </div>
                <span className="text-zinc-700 text-xl font-black">→</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-[9px] text-zinc-500 font-black">AFTER</span>
                  <span className="text-lg text-white text-900 font-mono tracking-tighter">{l.newValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className={`text-2xl text-900 italic ml-4 ${l.delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {l.delta > 0 ? '+' : ''}{l.delta.toFixed(2)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-20 text-center border border-dashed border-webfut-border text-zinc-700 text-[10px] uppercase font-black italic">DATABASE EMPTY</div>
        )}
      </div>
    </div>
  );
};

export const RatingLogsSection: React.FC = () => {
  const [logs] = useState<RatingLog[]>(mockRatingLogs);
  const [playerSearch, setPlayerSearch] = useState('');
  const [matchSearch, setMatchSearch] = useState('');

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const playerName = getPlayerName(l.player_id).toLowerCase();
      const matchId = l.match_id.toString().toLowerCase();
      return (
        playerName.includes(playerSearch.toLowerCase()) &&
        matchId.includes(matchSearch.toLowerCase())
      );
    });
  }, [logs, playerSearch, matchSearch]);

  return (
    <div className="h-full flex flex-col">
      <SectionHeader title="RATING LOGS">
        <ActionButton variant="danger" className="text-[10px] py-1 border-2 border-transparent hover:border-white">
          REBUILD ALL
        </ActionButton>
      </SectionHeader>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 bg-webfut-gray p-2 border border-webfut-border">
        <input 
          placeholder="ПОИСК ПО ИГРОКУ..." 
          value={playerSearch} 
          onChange={e => setPlayerSearch(e.target.value)} 
          className="w-full bg-black border border-webfut-border text-white px-3 py-2 text-[11px] text-900 uppercase italic outline-none focus:border-webfut-pink"
        />
        <input 
          placeholder="ПОИСК ПО МАТЧУ..." 
          value={matchSearch} 
          onChange={e => setMatchSearch(e.target.value)} 
          className="w-full bg-black border border-webfut-border text-white px-3 py-2 text-[11px] text-900 uppercase italic outline-none focus:border-webfut-pink"
        />
      </div>

      <div className="flex-1 overflow-auto space-y-1 pb-20">
        {filteredLogs.map(l => (
          <div key={l.id} className="bg-webfut-gray border border-webfut-border p-3 hover:border-zinc-500 transition-colors">
            <div className="flex justify-between items-baseline mb-1">
              <div className="text-xl text-900 uppercase italic tracking-tighter">Матч #{l.match_id}</div>
              <div className="text-[10px] text-zinc-500 font-mono">{l.date}</div>
            </div>
            <div className="text-[11px] text-700 text-zinc-400 uppercase italic mb-2">
              {getPlayerName(l.player_id)} | {l.type}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl text-900 italic leading-none ${l.delta >= 0 ? 'text-white' : 'text-red-500'}`}>
                Δ {l.delta.toFixed(2)}
              </span>
              <span className="text-zinc-600 text-lg font-black">|</span>
              <span className="text-lg text-700 text-zinc-300 font-mono tracking-tighter">
                {l.before.toFixed(2)} <span className="text-zinc-600">→</span> {l.after.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const FeedbackLogsSection: React.FC = () => {
  const [logs] = useState<FeedbackLog[]>(mockFeedbackLogs);
  const [search, setSearch] = useState('');

  const filteredLogs = useMemo(() => {
    return logs.filter(l => 
      l.voter_name.toLowerCase().includes(search.toLowerCase()) || 
      l.match_id.toString().includes(search)
    );
  }, [logs, search]);

  return (
    <div className="h-full flex flex-col">
      <SectionHeader title="FEEDBACK" />

      <div className="mb-4">
        <input 
          placeholder="SEARCH VOTER / MATCH ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-zinc-900 border-2 border-webfut-border text-white px-4 py-3 text-[14px] text-900 uppercase italic outline-none focus:border-webfut-pink"
        />
      </div>

      <div className="flex-1 overflow-auto space-y-4 pb-40 custom-scrollbar pr-1">
        {filteredLogs.map(l => (
          <div key={l.id} className="bg-black border-2 border-webfut-border hover:border-zinc-700 transition-all flex flex-col overflow-hidden">
            
            <div className="bg-zinc-900 p-3 flex justify-between items-center border-b-2 border-webfut-border">
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-white text-900 uppercase italic text-xl leading-none">#{l.match_id}</span>
                <span className="text-webfut-pink text-900 uppercase text-[12px] leading-none truncate tracking-tight">{l.voter_name}</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-600 uppercase italic leading-none shrink-0">{l.date}</span>
            </div>

            <div className="grid grid-cols-2 divide-x-2 divide-webfut-border border-b-2 border-webfut-border">
              <div className="p-4 bg-zinc-900/10 min-w-0">
                <div className="text-[10px] text-zinc-600 font-black mb-1 uppercase tracking-widest">🏆 MVP</div>
                <div className="text-[28px] text-white text-900 uppercase italic leading-none tracking-tighter whitespace-normal break-words">{l.mvp}</div>
              </div>
              <div className="p-4 bg-black min-w-0">
                <div className="text-[10px] text-zinc-600 font-black mb-1 uppercase tracking-widest">☠ WORST</div>
                <div className="text-[28px] text-zinc-500 text-900 uppercase italic leading-none tracking-tighter whitespace-normal break-words">{l.worstPlayer}</div>
              </div>
            </div>

            {l.role && (
              <div className="bg-zinc-900/40 p-3 border-b-2 border-webfut-border flex items-baseline gap-4">
                <span className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] shrink-0">{l.role.roleName}</span>
                <span className="text-[20px] text-webfut-pink text-900 uppercase italic leading-none truncate">{l.role.player}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
