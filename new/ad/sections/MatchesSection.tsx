
import React, { useState, useMemo } from 'react';
import { Match, Player, Segment, MatchEvent } from '../types';
import { mockMatches, mockPlayers } from '../data/mockData';
import { SectionHeader, ActionButton, Input, Badge } from '../components/Shared';

const MatchesSection: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [playerSearch, setPlayerSearch] = useState('');
  
  // Event Editing Modal State
  const [editingEvent, setEditingEvent] = useState<{ segmentId: string, event?: MatchEvent } | null>(null);

  const currentMatch = useMemo(() => {
    if (!selectedMatch) return null;
    return matches.find(m => m.match_id === selectedMatch.match_id) || selectedMatch;
  }, [matches, selectedMatch]);

  const availablePlayers = useMemo(() => {
    if (!currentMatch) return [];
    const teamIds = new Set([...currentMatch.teamA_ids, ...currentMatch.teamB_ids]);
    return mockPlayers.filter(p => !teamIds.has(p.id) && p.name.toLowerCase().includes(playerSearch.toLowerCase()));
  }, [currentMatch, playerSearch]);

  const getStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'finished': return 'bg-green-600';
      case 'active': return 'bg-webfut-pink text-black';
      default: return 'bg-zinc-600';
    }
  };

  const getPlayerName = (id: string) => mockPlayers.find(p => p.id === id)?.name || id;

  const updateMatchState = (updater: (m: Match) => Match) => {
    if (!currentMatch) return;
    setMatches(prev => prev.map(m => m.match_id === currentMatch.match_id ? updater(m) : m));
  };

  const addToTeam = (playerId: string, team: 'A' | 'B') => {
    updateMatchState(m => ({
      ...m,
      teamA_ids: team === 'A' ? [...m.teamA_ids, playerId] : m.teamA_ids,
      teamB_ids: team === 'B' ? [...m.teamB_ids, playerId] : m.teamB_ids,
    }));
  };

  const removeFromTeam = (playerId: string, team: 'A' | 'B') => {
    updateMatchState(m => ({
      ...m,
      teamA_ids: team === 'A' ? m.teamA_ids.filter(id => id !== playerId) : m.teamA_ids,
      teamB_ids: team === 'B' ? m.teamB_ids.filter(id => id !== playerId) : m.teamB_ids,
    }));
  };

  const addSegment = () => {
    updateMatchState(m => {
      const newSeg: Segment = {
        id: `s${m.segments.length + 1}`,
        name: `${m.segments.length + 1}-Й ТАЙМ`,
        scoreA: m.scoreA,
        scoreB: m.scoreB
      };
      return { ...m, segments: [...m.segments, newSeg] };
    });
  };

  const deleteSegment = (segId: string) => {
    if (!confirm('УДАЛИТЬ СЕГМЕНТ И ВСЕ ЕГО СОБЫТИЯ?')) return;
    updateMatchState(m => {
      const filteredSegments = m.segments.filter(s => s.id !== segId);
      const filteredEvents = m.events.filter(e => e.segment_id !== segId);
      // Recalculate score from last segment after deletion
      const lastSeg = filteredSegments[filteredSegments.length - 1];
      return {
        ...m,
        segments: filteredSegments,
        events: filteredEvents,
        scoreA: lastSeg ? lastSeg.scoreA : 0,
        scoreB: lastSeg ? lastSeg.scoreB : 0
      };
    });
  };

  const saveEvent = (segmentId: string, eventData: Partial<MatchEvent>) => {
    updateMatchState(m => {
      let newEvents = [...m.events];
      if (editingEvent?.event) {
        newEvents = newEvents.map(e => e.id === editingEvent.event?.id ? { ...e, ...eventData } as MatchEvent : e);
      } else {
        const newEvent: MatchEvent = {
          id: `e${Date.now()}`,
          segment_id: segmentId,
          type: (eventData.type as 'goal' | 'autogoal') || 'goal',
          player_id: eventData.player_id || '',
          assist_player_id: eventData.assist_player_id,
          team: eventData.team || 'A'
        };
        newEvents.push(newEvent);
      }

      // Logic: Final score is the score of the LAST segment.
      const updatedSegments = m.segments.map(seg => {
        const segEvents = newEvents.filter(e => e.segment_id === seg.id);
        const prevSegments = m.segments.slice(0, m.segments.indexOf(seg));
        const prevScoreA = prevSegments.length > 0 ? prevSegments[prevSegments.length - 1].scoreA : 0;
        const prevScoreB = prevSegments.length > 0 ? prevSegments[prevSegments.length - 1].scoreB : 0;

        const segGoalsA = segEvents.filter(e => (e.type === 'goal' && e.team === 'A') || (e.type === 'autogoal' && e.team === 'B')).length;
        const segGoalsB = segEvents.filter(e => (e.type === 'goal' && e.team === 'B') || (e.type === 'autogoal' && e.team === 'A')).length;

        return {
          ...seg,
          scoreA: prevScoreA + segGoalsA,
          scoreB: prevScoreB + segGoalsB
        };
      });

      const lastSeg = updatedSegments[updatedSegments.length - 1];

      return {
        ...m,
        events: newEvents,
        segments: updatedSegments,
        scoreA: lastSeg ? lastSeg.scoreA : 0,
        scoreB: lastSeg ? lastSeg.scoreB : 0
      };
    });
    setEditingEvent(null);
  };

  const deleteEvent = (eventId: string) => {
    updateMatchState(m => {
      const filteredEvents = m.events.filter(e => e.id !== eventId);
      // Recalculate all segment scores
      const updatedSegments = m.segments.map(seg => {
        const index = m.segments.indexOf(seg);
        const prevSegments = m.segments.slice(0, index);
        const prevScoreA = prevSegments.length > 0 ? prevSegments[prevSegments.length - 1].scoreA : 0;
        const prevScoreB = prevSegments.length > 0 ? prevSegments[prevSegments.length - 1].scoreB : 0;
        
        const segEvents = filteredEvents.filter(e => e.segment_id === seg.id);
        const segGoalsA = segEvents.filter(e => (e.type === 'goal' && e.team === 'A') || (e.type === 'autogoal' && e.team === 'B')).length;
        const segGoalsB = segEvents.filter(e => (e.type === 'goal' && e.team === 'B') || (e.type === 'autogoal' && e.team === 'A')).length;

        return { ...seg, scoreA: prevScoreA + segGoalsA, scoreB: prevScoreB + segGoalsB };
      });

      const lastSeg = updatedSegments[updatedSegments.length - 1];
      return { 
        ...m, 
        events: filteredEvents, 
        segments: updatedSegments,
        scoreA: lastSeg ? lastSeg.scoreA : 0,
        scoreB: lastSeg ? lastSeg.scoreB : 0 
      };
    });
  };

  if (!selectedMatch) {
    return (
      <div className="h-full flex flex-col">
        <SectionHeader title="МАТЧИ">
          <select 
            className="bg-webfut-gray border border-webfut-border text-white text-[10px] text-900 uppercase px-2 py-1 outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">ВСЕ</option>
            <option value="finished">ЗАВЕРШЕН</option>
            <option value="active">АКТИВЕН</option>
          </select>
        </SectionHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="hidden lg:block border border-webfut-border bg-black">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-webfut-gray text-zinc-500 text-[10px] text-900 uppercase z-20">
                <tr>
                  <th className="p-3 border-b border-webfut-border">ID</th>
                  <th className="p-3 border-b border-webfut-border">ДАТА</th>
                  <th className="p-3 border-b border-webfut-border text-center">СТАТУС</th>
                  <th className="p-3 border-b border-webfut-border text-center">СЧЁТ</th>
                  <th className="p-3 border-b border-webfut-border text-right">ДЕЙСТВИЕ</th>
                </tr>
              </thead>
              <tbody className="text-400 text-sm">
                {matches.filter(m => filterStatus === 'all' || m.status === filterStatus).map(m => (
                  <tr key={m.match_id} className="hover:bg-zinc-900 transition-colors">
                    <td className="p-3 border-b border-webfut-border font-mono text-[10px] text-zinc-500">{m.match_id}</td>
                    <td className="p-3 border-b border-webfut-border font-mono text-xs uppercase italic">{m.date}</td>
                    <td className="p-3 border-b border-webfut-border text-center">
                      <Badge color={getStatusColor(m.status)}>{m.status}</Badge>
                    </td>
                    <td className="p-3 border-b border-webfut-border text-center text-900 italic tracking-widest">
                      {m.scoreA}:{m.scoreB}
                    </td>
                    <td className="p-3 border-b border-webfut-border text-right">
                      <ActionButton variant="outline" className="py-1 text-[10px]" onClick={() => setSelectedMatch(m)}>УПРАВЛЕНИЕ</ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-6 pb-24">
            {matches.filter(m => filterStatus === 'all' || m.status === filterStatus).map(m => (
              <div key={m.match_id} className="bg-webfut-gray border border-webfut-border p-4 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="block font-mono text-[10px] text-zinc-500 uppercase">{m.match_id}</span>
                    <span className="block text-[11px] text-zinc-400 font-black uppercase mt-0.5 italic">{m.date}</span>
                  </div>
                  <Badge color={getStatusColor(m.status)}>{m.status}</Badge>
                </div>
                <div className="flex justify-between items-center bg-black/40 p-4 border border-webfut-border mb-4">
                  <div className="text-center flex-1">
                    <div className="text-[9px] text-zinc-500 font-black mb-1">TEAM A</div>
                    <div className="text-xl text-900 italic">{m.teamA_ids.length}</div>
                  </div>
                  <div className="text-3xl text-900 italic text-webfut-pink tracking-widest px-4">{m.scoreA}:{m.scoreB}</div>
                  <div className="text-center flex-1">
                    <div className="text-[9px] text-zinc-500 font-black mb-1">TEAM B</div>
                    <div className="text-xl text-900 italic">{m.teamB_ids.length}</div>
                  </div>
                </div>
                <ActionButton variant="primary" className="w-full py-4 font-black" onClick={() => setSelectedMatch(m)}>РЕЖИМ КОНТРОЛЯ</ActionButton>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pb-10 overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b-4 border-white pb-4 sticky top-0 bg-black z-30">
        <h1 className="text-2xl lg:text-4xl text-900 uppercase tracking-tighter italic leading-none">
          КОНТРОЛЬ: <span className="text-webfut-pink">{currentMatch.match_id}</span>
        </h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <ActionButton variant="ghost" onClick={() => setSelectedMatch(null)} className="flex-1 sm:flex-none border-2">ЗАКРЫТЬ</ActionButton>
          <ActionButton variant="danger" onClick={() => confirm('УДАЛИТЬ МАТЧ ПОЛНОСТЬЮ?') && setSelectedMatch(null)} className="flex-1 sm:flex-none">УДАЛИТЬ</ActionButton>
        </div>
      </div>

      <div className="space-y-6">
        {/* Match Overview Score Card */}
        <div className="bg-webfut-gray p-6 border-2 border-white flex flex-col lg:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-webfut-pink"></div>
          <div className="flex-1 w-full text-center lg:text-left">
            <label className="block text-[10px] text-zinc-500 font-black uppercase mb-1">VENUE & TIME</label>
            <div className="text-2xl text-900 italic uppercase leading-none">{currentMatch.venue}</div>
            <div className="text-xs font-mono text-zinc-400 mt-2">{currentMatch.date}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <span className="block text-[8px] text-zinc-500 font-black mb-1 uppercase">FINAL SCORE A</span>
              <div className="bg-black border-2 border-white text-4xl lg:text-5xl text-900 text-center w-20 lg:w-24 py-2 italic">{currentMatch.scoreA}</div>
            </div>
            <div className="text-4xl text-900 italic mt-4 text-webfut-pink">:</div>
            <div className="text-center">
              <span className="block text-[8px] text-zinc-500 font-black mb-1 uppercase">FINAL SCORE B</span>
              <div className="bg-black border-2 border-white text-4xl lg:text-5xl text-900 text-center w-20 lg:w-24 py-2 italic">{currentMatch.scoreB}</div>
            </div>
          </div>
        </div>

        {/* Team Rosters */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-black border-2 border-white p-4">
            <div className="flex justify-between items-center mb-4 border-b border-webfut-border pb-2">
              <h3 className="text-900 uppercase italic text-lg">TEAM A</h3>
              <Badge color="bg-white text-black">{currentMatch.teamA_ids.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {currentMatch.teamA_ids.map(id => (
                <div key={id} className="flex justify-between items-center bg-webfut-gray p-2 group border border-transparent hover:border-zinc-500">
                  <span className="text-[10px] text-900 uppercase italic truncate max-w-[120px]">{getPlayerName(id)}</span>
                  <button onClick={() => removeFromTeam(id, 'A')} className="text-red-500 text-[8px] font-black uppercase opacity-0 group-hover:opacity-100">УДАЛИТЬ</button>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-black border-2 border-webfut-pink p-4">
            <div className="flex justify-between items-center mb-4 border-b border-webfut-border pb-2 text-webfut-pink">
              <h3 className="text-900 uppercase italic text-lg">TEAM B</h3>
              <Badge color="bg-webfut-pink text-black">{currentMatch.teamB_ids.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {currentMatch.teamB_ids.map(id => (
                <div key={id} className="flex justify-between items-center bg-webfut-gray p-2 group border border-transparent hover:border-zinc-500">
                  <span className="text-[10px] text-900 uppercase italic truncate max-w-[120px]">{getPlayerName(id)}</span>
                  <button onClick={() => removeFromTeam(id, 'B')} className="text-red-500 text-[8px] font-black uppercase opacity-0 group-hover:opacity-100">УДАЛИТЬ</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Segments & Events Timeline */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-webfut-border pb-2">
            <h3 className="text-900 uppercase italic text-xl">СЕГМЕНТЫ И СОБЫТИЯ</h3>
            <ActionButton variant="outline" className="text-[10px] py-1" onClick={addSegment}>+ ДОБАВИТЬ СЕГМЕНТ</ActionButton>
          </div>

          {currentMatch.segments.map((seg, idx) => (
            <div key={seg.id} className="bg-webfut-dark border border-webfut-border overflow-hidden">
              <div className="bg-zinc-900 p-3 flex justify-between items-center border-b border-webfut-border">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-900 uppercase italic text-zinc-400">{seg.name}</span>
                  <div className="text-lg text-900 italic tracking-widest text-white">{seg.scoreA}:{seg.scoreB}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingEvent({ segmentId: seg.id })} className="text-[9px] font-black uppercase text-webfut-pink hover:bg-webfut-pink hover:text-black px-2 py-1 transition-colors border border-webfut-pink/20">НОВОЕ СОБЫТИЕ</button>
                  <button onClick={() => deleteSegment(seg.id)} className="text-[9px] font-black uppercase text-red-500/50 hover:text-red-500">УДАЛИТЬ</button>
                </div>
              </div>
              <div className="p-3">
                <div className="space-y-1">
                  {currentMatch.events.filter(e => e.segment_id === seg.id).map(e => (
                    <div key={e.id} className="flex items-center gap-4 bg-black/40 p-2 border border-zinc-800 hover:border-zinc-600 group">
                      <div className={`w-2 h-2 rounded-full ${e.team === 'A' ? 'bg-white' : 'bg-webfut-pink'}`}></div>
                      <div className="flex-1">
                        <span className="text-[10px] text-900 uppercase italic">
                          {e.type === 'goal' ? 'ГОЛ' : 'АВТОГОЛ'}: {getPlayerName(e.player_id)}
                        </span>
                        {e.assist_player_id && (
                          <span className="text-[8px] text-zinc-500 ml-2 uppercase font-black italic">АССИСТ: {getPlayerName(e.assist_player_id)}</span>
                        )}
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingEvent({ segmentId: seg.id, event: e })} className="text-[8px] font-black uppercase text-zinc-400 hover:text-white">ПРАВКА</button>
                        <button onClick={() => deleteEvent(e.id)} className="text-[8px] font-black uppercase text-red-500">X</button>
                      </div>
                    </div>
                  ))}
                  {currentMatch.events.filter(e => e.segment_id === seg.id).length === 0 && (
                    <div className="text-center py-4 text-[9px] text-zinc-700 font-black uppercase italic tracking-widest">НЕТ СОБЫТИЙ</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Player Roster Picker */}
        <div className="bg-webfut-gray border-2 border-white flex flex-col overflow-hidden">
          <div className="p-4 bg-black border-b border-webfut-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-900 uppercase italic text-lg text-webfut-pink leading-none">ПУЛ ВСЕХ ИГРОКОВ</h3>
              <p className="text-[10px] text-zinc-500 font-black mt-1 uppercase">ДОБАВИТЬ В МАТЧ</p>
            </div>
            <div className="w-full sm:w-64">
              <Input 
                placeholder="БЫСТРЫЙ ПОИСК ПО ИМЕНИ..." 
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="!mb-0 !py-1.5 !text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-px bg-webfut-border max-h-[400px] overflow-y-auto">
            {availablePlayers.map(p => (
              <div key={p.id} className="bg-black p-4 flex items-center justify-between hover:bg-zinc-900 transition-all group">
                <div className="flex items-center gap-4">
                  <img src={p.avatar} className="w-12 h-12 rounded-sm grayscale group-hover:grayscale-0" alt="" />
                  <div>
                    <div className="text-sm text-900 uppercase italic leading-none mb-1">{p.name}</div>
                    <div className="text-[9px] text-zinc-500 font-black uppercase italic">GLOBAL: {p.globalRating}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addToTeam(p.id, 'A')} className="w-10 h-10 border border-white text-white text-[10px] font-black hover:bg-white hover:text-black italic">+A</button>
                  <button onClick={() => addToTeam(p.id, 'B')} className="w-10 h-10 border border-webfut-pink text-webfut-pink text-[10px] font-black hover:bg-webfut-pink hover:text-black italic">+B</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event Add/Edit Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4">
          <div className="bg-webfut-dark border-4 border-white w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-2xl text-900 uppercase italic mb-6 border-b border-webfut-border pb-2">
              {editingEvent.event ? 'ПРАВКА СОБЫТИЯ' : 'НОВОЕ СОБЫТИЕ'}
            </h2>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase italic">ТИП</label>
                <select id="ev-type" defaultValue={editingEvent.event?.type || 'goal'} className="bg-webfut-gray border border-webfut-border p-2 text-xs uppercase text-900">
                  <option value="goal">ГОЛ</option>
                  <option value="autogoal">АВТОГОЛ</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase italic">КОМАНДА</label>
                <select id="ev-team" defaultValue={editingEvent.event?.team || 'A'} className="bg-webfut-gray border border-webfut-border p-2 text-xs uppercase text-900">
                  <option value="A">TEAM A (WHITE)</option>
                  <option value="B">TEAM B (PINK)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase italic">ИГРОК</label>
                <select id="ev-player" defaultValue={editingEvent.event?.player_id || ''} className="bg-webfut-gray border border-webfut-border p-2 text-xs uppercase text-900">
                  <option value="">ВЫБЕРИТЕ...</option>
                  {[...currentMatch.teamA_ids, ...currentMatch.teamB_ids].map(id => (
                    <option key={id} value={id}>{getPlayerName(id)}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-black uppercase italic">АССИСТ (ТОЛЬКО ДЛЯ ГОЛА)</label>
                <select id="ev-assist" defaultValue={editingEvent.event?.assist_player_id || ''} className="bg-webfut-gray border border-webfut-border p-2 text-xs uppercase text-900">
                  <option value="">БЕЗ АССИСТА</option>
                  {[...currentMatch.teamA_ids, ...currentMatch.teamB_ids].map(id => (
                    <option key={id} value={id}>{getPlayerName(id)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex gap-2">
              <ActionButton variant="ghost" onClick={() => setEditingEvent(null)} className="flex-1 py-4 text-xs">ОТМЕНА</ActionButton>
              <ActionButton onClick={() => {
                const type = (document.getElementById('ev-type') as HTMLSelectElement).value as any;
                const team = (document.getElementById('ev-team') as HTMLSelectElement).value as any;
                const player_id = (document.getElementById('ev-player') as HTMLSelectElement).value;
                const assist_player_id = (document.getElementById('ev-assist') as HTMLSelectElement).value || undefined;
                saveEvent(editingEvent.segmentId, { type, team, player_id, assist_player_id });
              }} className="flex-1 py-4 text-xs">СОХРАНИТЬ</ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchesSection;
