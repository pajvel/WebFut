
import React, { useState, useMemo, useEffect } from 'react';
import { MatchData, Player } from '../types';
import { CROWN_SVG } from '../constants';

interface BestTabProps {
  data: MatchData;
}

type Contender = Player & { currentScore: number };

interface StepData {
  players: Contender[];
  score: number;
}

const BestTab: React.FC<BestTabProps> = ({ data }) => {
  const [filter, setFilter] = useState<'ALL' | 'A' | 'B'>('ALL');
  const [timeLeft, setTimeLeft] = useState({ hours: 3, minutes: 14 });
  
  // Use state for player scores so the scale updates in real-time when voting
  const [playerScores, setPlayerScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const all = [...data.teamA, ...data.teamB];
    all.forEach(p => {
      initial[p.id] = p.mvpVotes;
    });
    return initial;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let newMin = prev.minutes - 1;
        let newHour = prev.hours;
        if (newMin < 0) {
          newMin = 59;
          newHour = Math.max(0, newHour - 1);
        }
        return { hours: newHour, minutes: newMin };
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleVote = (id: string, delta: number) => {
    setPlayerScores(prev => ({
      ...prev,
      [id]: (prev[id] || 0) + delta
    }));
  };

  const allPlayersWithScores = useMemo(() => {
    return [...data.teamA, ...data.teamB].map(p => ({
      ...p,
      currentScore: playerScores[p.id] || 0
    }));
  }, [data, playerScores]);

  const contenders = useMemo<Contender[]>(() => {
    return [...allPlayersWithScores]
      .sort((a, b) => b.currentScore - a.currentScore)
      .filter(p => p.currentScore !== 0)
      .slice(0, 5); 
  }, [allPlayersWithScores]);

  const leaderId = contenders.length > 0 && contenders[0].currentScore > 0 ? contenders[0].id : null;

  const maxVisualRange = 4;

  const visualMapping = useMemo(() => {
    const mapping: Record<string, number> = {};
    const posContenders = contenders.filter(p => p.currentScore > 0);
    const uniquePos = Array.from<number>(new Set(posContenders.map(p => p.currentScore)))
      .sort((a, b) => b - a);
    
    uniquePos.forEach((score, rank) => {
      const vStep = Math.max(1, Math.min(score, maxVisualRange - rank));
      posContenders.filter(p => p.currentScore === score).forEach(p => {
        mapping[p.id] = vStep;
      });
    });

    const negContenders = contenders.filter(p => p.currentScore < 0);
    const uniqueNeg = Array.from<number>(new Set(negContenders.map(p => p.currentScore)))
      .sort((a, b) => a - b);

    uniqueNeg.forEach((score, rank) => {
      const vStep = Math.min(-1, Math.max(score, -maxVisualRange + rank));
      negContenders.filter(p => p.currentScore === score).forEach(p => {
        mapping[p.id] = vStep;
      });
    });

    return mapping;
  }, [contenders, maxVisualRange]);

  const stepsData = useMemo(() => {
    const steps: Record<number, StepData> = {};
    steps[0] = { players: [], score: 0 };
    contenders.forEach(p => {
      const vStep = visualMapping[p.id];
      if (vStep === undefined) return;
      if (!steps[vStep]) {
        steps[vStep] = { players: [], score: p.currentScore };
      }
      steps[vStep].players.push(p);
    });
    return steps;
  }, [visualMapping, contenders]);

  const maxStackDepth = useMemo(() => {
    return Math.max(0, ...(Object.values(stepsData) as StepData[]).map(s => s.players.length));
  }, [stepsData]);

  const containerPaddingBottom = useMemo(() => {
    if (maxStackDepth >= 3) return 'pb-44';
    if (maxStackDepth >= 2) return 'pb-32';
    return 'pb-24';
  }, [maxStackDepth]);

  const getLeftPos = (step: number) => {
    return ((step + maxVisualRange) / (maxVisualRange * 2)) * 100;
  };

  const filteredPlayers = filter === 'ALL' ? allPlayersWithScores : filter === 'A' ? allPlayersWithScores.filter(p => data.teamA.some(tp => tp.id === p.id)) : allPlayersWithScores.filter(p => data.teamB.some(tp => tp.id === p.id));
  
  const topStats = {
    combined: [...filteredPlayers].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists)).slice(0, 3),
    goals: [...filteredPlayers].sort((a, b) => b.goals - a.goals).slice(0, 3),
    assists: [...filteredPlayers].sort((a, b) => b.assists - a.assists).slice(0, 3)
  };

  return (
    <div className="space-y-6 pb-24 text-[var(--text-main)]">
      {/* MVP RACE SECTION */}
      <section className="space-y-0">
        <div className="text-center space-y-1 mb-2">
          <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter">MVP RACE</h2>
          <div className="flex flex-col items-center">
            <div className="font-black italic text-[14px] uppercase tracking-tight opacity-80 tabular-nums">
              ДО КОНЦА ОСТАЛОСЬ {timeLeft.hours} Ч. {timeLeft.minutes} М.
            </div>
            <div className="text-[10px] font-black uppercase opacity-20 tracking-[0.2em] mt-0.5">LIVE UPDATING</div>
          </div>
        </div>

        <div className={`relative px-4 pt-16 ${containerPaddingBottom} min-h-[160px] flex flex-col justify-center transition-all duration-500 ease-in-out`}>
           <div className="relative mx-10 h-0.5">
              {/* Horizontal Line - Fixed Visibility */}
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-[var(--border-main)] -translate-y-1/2 rounded-full opacity-60" />
              
              {(Object.entries(stepsData) as [string, StepData][]).map(([stepStr, step]) => {
                const stepIdx = parseInt(stepStr);
                const isZero = stepIdx === 0;
                return (
                  <div key={`vstep-${stepIdx}`} className="absolute top-1/2 -translate-y-1/2 transition-all duration-700" style={{ left: `${getLeftPos(stepIdx)}%` }}>
                    <div className="flex flex-col items-center pointer-events-none">
                      {/* Scale markers - Vertical lines */}
                      <div className={`transition-all duration-500 rounded-full ${isZero ? 'bg-[var(--border-main)] w-1.5 h-12' : 'bg-[var(--border-main)] w-1 h-6 opacity-80'}`}></div>
                      
                      <div className={`absolute -bottom-10 px-1.5 py-0.5 rounded-lg font-black italic text-[10px] leading-none border-2 ${isZero ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)] border-[var(--border-main)]' : 'bg-[var(--bg-surface)] text-[var(--text-main)] border-[var(--border-main)] shadow-sm'}`}>
                        {step.score > 0 ? `+${step.score}` : step.score}
                      </div>
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      {step.players.map((p, idx) => {
                        const isLeader = p.id === leaderId;
                        const yOffset = idx === 0 ? -64 : (idx === 1 ? 64 : 116);
                        return (
                          <div key={p.id} className="absolute transition-all duration-700" style={{ transform: `translate(-50%, ${yOffset}px)`, zIndex: isLeader ? 30 : 20 }}>
                             <div className="relative">
                                {isLeader && (
                                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-yellow-500 drop-shadow-[0_2px_0_rgba(0,0,0,1)] scale-110">
                                    {CROWN_SVG}
                                  </div>
                                )}
                                <div className={`w-11 h-11 border-2 border-[var(--border-main)] rounded-2xl overflow-hidden grayscale bg-[var(--bg-surface)] brutal-shadow-sm transition-transform ${isLeader ? 'scale-110 ring-4 ring-yellow-400/20' : ''}`}>
                                  <img src={p.avatar} className="w-full h-full object-cover" alt={p.name} />
                                </div>
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
           </div>
        </div>
      </section>

      {/* STATS SECTION - PODIUMS STACKED VERTICALLY */}
      <section className="space-y-4 pt-4">
        <div className="flex border-4 border-[var(--border-main)] rounded-3xl overflow-hidden mx-1 brutal-shadow bg-[var(--bg-surface)]">
          {(['ALL', 'A', 'B'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`flex-1 py-5 font-black italic text-[14px] uppercase transition-colors ${filter === f ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' : 'bg-[var(--bg-surface)] text-[var(--text-main)] active:bg-black/5'}`}>
              {f === 'ALL' ? 'OVERALL' : f === 'A' ? data.teamAName : data.teamBName}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-6 px-1 pb-4">
          <PodiumBlock title="GOAL + ASSIST" players={topStats.combined} getVal={p => p.goals + p.assists} />
          <PodiumBlock title="GOALS" players={topStats.goals} getVal={p => p.goals} />
          <PodiumBlock title="ASSISTS" players={topStats.assists} getVal={p => p.assists} />
        </div>
      </section>

      {/* VOTING SECTION - AT THE VERY BOTTOM */}
      <section className="space-y-4 pt-6 pb-12 border-t-4 border-[var(--border-main)]/10">
        <div className="text-center">
           <div className="text-[12px] font-black uppercase opacity-40 tracking-widest mb-1">VOTE FOR THE BEST</div>
           <div className="h-1.5 w-12 bg-[var(--bg-contrast)] mx-auto"></div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-1">
          {[...data.teamA, ...data.teamB]
            .sort((a, b) => (playerScores[b.id] || 0) - (playerScores[a.id] || 0))
            .map(p => (
            <div key={`vote-${p.id}`} className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-2xl p-2 flex items-center justify-between brutal-shadow-sm">
               <div className="flex items-center gap-2 overflow-hidden">
                 <img src={p.avatar} className="w-8 h-8 rounded-lg grayscale border border-[var(--border-main)]/20" />
                 <span className="font-black italic text-[10px] uppercase truncate">{p.name}</span>
               </div>
               <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => handleVote(p.id, -1)}
                    className="w-7 h-7 bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-md font-black text-sm flex items-center justify-center active:bg-black/10"
                  >-</button>
                  <div className="min-w-[16px] text-center font-black italic text-[11px] tabular-nums">
                    {playerScores[p.id] || 0}
                  </div>
                  <button 
                    onClick={() => handleVote(p.id, 1)}
                    className="w-7 h-7 bg-[var(--bg-contrast)] text-[var(--text-contrast)] border-2 border-[var(--border-main)] rounded-md font-black text-sm flex items-center justify-center active:opacity-80"
                  >+</button>
               </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

interface PodiumBlockProps {
  title: string;
  players: Player[];
  getVal: (p: Player) => number;
}

const PodiumBlock: React.FC<PodiumBlockProps> = ({ title, players, getVal }) => {
  const podiumOrder = useMemo(() => {
    const order = [];
    if (players[1]) order.push({ p: players[1], rank: 2 });
    if (players[0]) order.push({ p: players[0], rank: 1 });
    if (players[2]) order.push({ p: players[2], rank: 3 });
    return order;
  }, [players]);

  return (
    <div className="w-full bg-[var(--bg-surface)] border-4 border-[var(--border-main)] rounded-[40px] brutal-shadow p-6 flex flex-col items-center">
      <div className="text-[11px] font-black opacity-40 uppercase mb-8 tracking-widest text-center">
        {title}
      </div>

      <div className="flex items-end justify-center w-full gap-2 mt-auto">
        {podiumOrder.map(({ p, rank }) => {
          const isFirst = rank === 1;
          const isSecond = rank === 2;
          const isThird = rank === 3;
          
          // Higher heights and clearer steps
          const height = isFirst ? 'h-40' : isSecond ? 'h-32' : 'h-24';
          const avatarSize = isFirst ? 'w-16 h-16' : 'w-13 h-13';

          return (
            <div key={p.id} className="flex flex-col items-center flex-1">
              <div className="relative mb-2">
                <img src={p.avatar} className={`${avatarSize} border-2 border-[var(--border-main)] rounded-xl grayscale bg-[var(--bg-surface)] brutal-shadow-sm`} />
                <div className="absolute -bottom-2 -right-1 bg-[var(--bg-contrast)] text-[var(--text-contrast)] font-black italic text-[10px] px-1.5 py-0.5 rounded-md border border-[var(--bg-surface)]">
                  {getVal(p)}
                </div>
              </div>
              
              <div className={`${height} w-full border-x-4 border-t-4 border-[var(--border-main)] flex flex-col items-center justify-start pt-3 rounded-t-xl bg-[var(--border-main)]/5 transition-all`}>
                 <div className={`font-black italic text-2xl leading-none ${isFirst ? 'opacity-100' : 'opacity-20'}`}>{rank}</div>
                 <div className="text-[10px] font-black uppercase italic truncate w-full px-2 text-center mt-2 tracking-tight">
                    {p.name}
                 </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BestTab;
