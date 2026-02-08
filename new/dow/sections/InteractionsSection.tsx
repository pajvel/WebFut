
import React, { useState, useMemo } from 'react';
import { Interaction, InteractionLog, RatingType, Player, InteractionCategory } from '../types';
import { mockInteractions, mockInteractionLogs, mockPlayers } from '../data/mockData';
import { Badge } from '../components/Shared';

type SortConfig = {
  playerId: string | null;
  axis: 'row' | 'col' | 'none';
  dir: 'asc' | 'desc' | 'none';
};

const InteractionsSection: React.FC = () => {
  const [activeRating, setActiveRating] = useState<RatingType>('Global');
  const [activeCategory, setActiveCategory] = useState<InteractionCategory>('SYNERGY');
  const [playerSearch, setPlayerSearch] = useState('');
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ playerId: null, axis: 'none', dir: 'none' });

  const players = mockPlayers;

  const ratingLabels: Record<RatingType, string> = {
    Global: 'Глобальная',
    Expert: 'Эксперт',
    Marakana: 'Маракана'
  };

  const categoryLabels: Record<InteractionCategory, string> = {
    SYNERGY: 'СЫГРАННОСТЬ',
    DOMINATION: 'ДОМИНАЦИЯ'
  };

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || id;

  const interactionMap = useMemo(() => {
    const map = new Map<string, number>();
    mockInteractions
      .filter(i => i.ratingType === activeRating && i.category === activeCategory)
      .forEach(i => {
        map.set(`${i.playerA_id}_${i.playerB_id}`, i.value);
        if (activeCategory === 'SYNERGY') {
          map.set(`${i.playerB_id}_${i.playerA_id}`, i.value);
        }
      });
    return map;
  }, [activeRating, activeCategory]);

  const handleHeaderClick = (playerId: string, axis: 'row' | 'col') => {
    setSortConfig(prev => {
      if (prev.playerId === playerId && prev.axis === axis) {
        if (prev.dir === 'desc') return { playerId, axis, dir: 'asc' };
        if (prev.dir === 'asc') return { playerId: null, axis: 'none', dir: 'none' };
      }
      return { playerId, axis, dir: 'desc' };
    });
  };

  // Logic: 
  // If we sort by Column (axis='col'), we reorder the Rows based on their value with that column.
  // If we sort by Row (axis='row'), we reorder the Columns based on their value with that row.
  const displayRows = useMemo(() => {
    let list = [...players];
    if (sortConfig.axis === 'col' && sortConfig.playerId) {
      list.sort((a, b) => {
        const valA = interactionMap.get(`${a.id}_${sortConfig.playerId}`) ?? 0;
        const valB = interactionMap.get(`${b.id}_${sortConfig.playerId}`) ?? 0;
        return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
      });
    }
    return list;
  }, [players, sortConfig, interactionMap]);

  const displayCols = useMemo(() => {
    let list = [...players];
    if (sortConfig.axis === 'row' && sortConfig.playerId) {
      list.sort((a, b) => {
        const valA = interactionMap.get(`${sortConfig.playerId}_${a.id}`) ?? 0;
        const valB = interactionMap.get(`${sortConfig.playerId}_${b.id}`) ?? 0;
        return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
      });
    }
    return list;
  }, [players, sortConfig, interactionMap]);

  const filteredLogs = useMemo(() => {
    return mockInteractionLogs.filter(l => 
      l.category === activeCategory &&
      (l.playerA_id.includes(playerSearch) || getPlayerName(l.playerA_id).toLowerCase().includes(playerSearch.toLowerCase()))
    );
  }, [activeCategory, playerSearch]);

  const getSortIcon = (playerId: string, axis: 'row' | 'col') => {
    if (sortConfig.playerId !== playerId || sortConfig.axis !== axis) return null;
    return <span className="text-webfut-pink ml-1 text-[8px]">{sortConfig.dir === 'desc' ? '▼' : '▲'}</span>;
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
          <h1 className="text-4xl text-900 uppercase tracking-tighter italic leading-none">
            ANALYTICS: <span className="text-webfut-pink">{activeCategory}</span>
          </h1>
          
          <div className="flex border-2 border-webfut-border bg-black shrink-0">
            {(['SYNERGY', 'DOMINATION'] as InteractionCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setSortConfig({ playerId: null, axis: 'none', dir: 'none' });
                }}
                className={`px-6 py-2 text-[12px] text-900 uppercase italic transition-all ${
                  activeCategory === cat 
                    ? 'bg-white text-black' 
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {(['Global', 'Expert', 'Marakana'] as RatingType[]).map(r => (
            <button
              key={r}
              onClick={() => setActiveRating(r)}
              className={`px-6 py-2 border-2 text-[11px] text-900 uppercase italic transition-all ${
                activeRating === r 
                  ? 'bg-webfut-pink border-webfut-pink text-black' 
                  : 'bg-black border-webfut-border text-zinc-500 hover:border-zinc-500'
              }`}
            >
              {ratingLabels[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-black border border-webfut-border relative flex flex-col shadow-2xl flex-1 min-h-0">
        <div className="bg-webfut-gray p-2 text-[8px] text-zinc-500 uppercase font-black tracking-widest flex justify-between shrink-0">
          <div className="flex gap-4">
            <span>ИНЖЕНЕРНАЯ СЕТКА ({activeCategory} MATRIX)</span>
            <span className="text-zinc-600 italic">КЛИКНИ НА ИМЯ ДЛЯ СОРТИРОВКИ</span>
          </div>
          <span>A = СТРОКА, B = СТОЛБЕЦ | SCROLL HORIZONTALLY →</span>
        </div>

        <div className="overflow-auto custom-scrollbar flex-1">
          <table className="border-collapse table-auto min-w-max">
            <thead>
              <tr className="bg-webfut-gray">
                <th className="sticky top-0 left-0 z-40 bg-webfut-gray border-b border-r border-webfut-border p-3 w-32 min-w-[128px]">
                  <div className="text-[10px] text-zinc-600 font-black uppercase text-left italic">A \ B</div>
                </th>
                {displayCols.map(p => (
                  <th 
                    key={p.id} 
                    onClick={() => handleHeaderClick(p.id, 'col')}
                    className={`sticky top-0 z-20 border-b border-webfut-border p-3 text-[10px] text-900 uppercase italic text-center min-w-[100px] cursor-pointer transition-colors ${
                      sortConfig.playerId === p.id && sortConfig.axis === 'col' 
                        ? 'bg-zinc-800 text-webfut-pink' 
                        : 'bg-webfut-gray text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      {p.name}
                      {getSortIcon(p.id, 'col')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map(pRow => (
                <tr key={pRow.id} className="hover:bg-zinc-900/40 group">
                  <td 
                    onClick={() => handleHeaderClick(pRow.id, 'row')}
                    className={`sticky left-0 z-30 border-b border-r border-webfut-border p-3 text-[11px] text-900 uppercase italic cursor-pointer transition-colors ${
                      sortConfig.playerId === pRow.id && sortConfig.axis === 'row'
                        ? 'bg-zinc-800 text-webfut-pink'
                        : 'bg-webfut-gray text-white hover:text-webfut-pink hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {pRow.name}
                      {getSortIcon(pRow.id, 'row')}
                    </div>
                  </td>
                  
                  {displayCols.map(pCol => {
                    const isSelf = pRow.id === pCol.id;
                    const val = interactionMap.get(`${pRow.id}_${pCol.id}`) ?? 0;
                    
                    let textColor = 'text-zinc-700';
                    let bgColor = '';
                    if (!isSelf) {
                      if (val > 0) textColor = 'text-green-500 font-bold';
                      if (val < 0) textColor = 'text-red-500 font-bold';
                      if (Math.abs(val) > 1.0) bgColor = val > 0 ? 'bg-green-500/10' : 'bg-red-500/10';
                      
                      // Highlight cross-section of sort
                      if (
                        (sortConfig.axis === 'col' && sortConfig.playerId === pCol.id) ||
                        (sortConfig.axis === 'row' && sortConfig.playerId === pRow.id)
                      ) {
                        bgColor = val > 0 ? 'bg-green-500/20' : val < 0 ? 'bg-red-500/20' : 'bg-white/5';
                      }
                    }

                    return (
                      <td 
                        key={pCol.id} 
                        className={`border-b border-webfut-border p-3 text-center font-mono text-[11px] transition-colors ${bgColor} ${textColor}`}
                      >
                        {isSelf ? '—' : val === 0 ? '0.00' : (val > 0 ? '+' : '') + val.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 shrink-0 pb-20">
        <div className="flex justify-between items-center mb-4 border-b border-webfut-border pb-2">
          <h2 className="text-zinc-600 text-[10px] text-900 uppercase tracking-[0.2em]">ЛОГИ: {activeCategory}</h2>
          <input 
            placeholder="ПОИСК ПО ИГРОКУ..." 
            value={playerSearch}
            onChange={e => setPlayerSearch(e.target.value)}
            className="bg-webfut-gray border border-webfut-border px-3 py-1 text-[10px] text-white outline-none focus:border-webfut-pink uppercase italic w-48"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredLogs.map(l => (
            <div key={l.id} className="bg-webfut-gray border border-webfut-border p-3 hover:border-zinc-500 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div className="text-[12px] text-900 uppercase italic flex items-center gap-2">
                  <span className="text-white">{getPlayerName(l.playerA_id)}</span>
                  <span className="text-zinc-600 text-[8px] font-black">{activeCategory === 'SYNERGY' ? '↔' : 'vs'}</span>
                  <span className="text-webfut-pink">{getPlayerName(l.playerB_id)}</span>
                </div>
                <div className="text-[8px] text-zinc-500 font-mono">{l.date.split(',')[0]}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-zinc-600 font-mono text-[10px]">{l.oldValue.toFixed(2)}</span>
                <span className="text-webfut-pink text-[10px]">→</span>
                <span className={`font-mono text-[11px] font-bold ${l.newValue >= l.oldValue ? 'text-green-500' : 'text-red-500'}`}>
                  {l.newValue.toFixed(2)}
                </span>
                <Badge color="bg-black/50 text-zinc-500">{l.ratingType}</Badge>
              </div>
              {l.comment && <div className="mt-2 text-[9px] text-zinc-500 italic uppercase truncate">"{l.comment}"</div>}
            </div>
          ))}
          {filteredLogs.length === 0 && (
             <div className="col-span-full py-8 text-center border border-dashed border-webfut-border text-[10px] text-zinc-600 uppercase italic font-black">ЛОГИ ПУСТЫ</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractionsSection;
