import React from 'react';
import { PlayerStats } from '../types';
import { LeaderboardIcon, ZapIcon } from './Icons';

interface Props {
  stats: PlayerStats;
}

export const StatsGrid: React.FC<Props> = ({ stats }) => {
  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="flex items-end justify-between mb-4 px-1">
        <h2 className="font-black text-xl italic uppercase tracking-tighter leading-none">
          Statistics
        </h2>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border border-zinc-800 px-2 py-1 rounded">
            Season 24/25
        </span>
      </div>
      
      <div className="flex flex-col gap-2">
        
        {/* TOP ROW: The Big Numbers (Goals / Assists) */}
        <div className="grid grid-cols-2 gap-2">
            {/* GOALS */}
            <div className="bg-brand rounded-[1.25rem] p-4 flex flex-col justify-between h-36 relative overflow-hidden group shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                 <div className="flex justify-between items-start">
                    <span className="font-bold text-black/60 text-[10px] uppercase tracking-[0.2em] border-b border-black/10 pb-1">Goals</span>
                    <div className="text-black/20">
                        <ZapIcon />
                    </div>
                 </div>
                 <span className="font-black text-[5rem] text-black tracking-tighter leading-[0.8] -ml-1">
                    {stats.goals}
                 </span>
            </div>

            {/* ASSISTS */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-[1.25rem] p-4 flex flex-col justify-between h-36 relative overflow-hidden">
                 <div className="flex justify-between items-start">
                    <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-[0.2em] border-b border-white/5 pb-1">Assists</span>
                 </div>
                 <span className="absolute bottom-4 left-4 font-black text-[5rem] text-white tracking-tighter leading-[0.8] -ml-1">
                    {stats.assists}
                 </span>
            </div>
        </div>

        {/* MIDDLE ROW: MVP Bar */}
        <div className="bg-surface border border-zinc-800 p-4 rounded-[1.25rem] flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-zinc-800 p-2 rounded-lg text-white">
                    <LeaderboardIcon />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="font-black text-white text-sm uppercase tracking-wider">MVP Awards</span>
                    <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Match Best Player</span>
                </div>
            </div>
            <span className="font-black text-3xl text-white tracking-tighter">{stats.mvp}</span>
        </div>

        {/* BOTTOM ROW: The Grid (Matches, Wins, Losses) */}
        <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-900 rounded-2xl p-3 flex flex-col items-center justify-center h-20 border border-zinc-800/50">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Games</span>
                <span className="font-black text-2xl text-white leading-none">{stats.matches}</span>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-3 flex flex-col items-center justify-center h-20 border-2 border-white/10 shadow-lg shadow-white/5">
                <span className="text-[9px] font-bold text-white uppercase tracking-widest mb-0.5">Wins</span>
                <span className="font-black text-2xl text-white leading-none">{stats.wins}</span>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-3 flex flex-col items-center justify-center h-20 border border-zinc-800/50">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Loss</span>
                <span className="font-black text-2xl text-zinc-500 leading-none">{stats.losses}</span>
            </div>
        </div>

      </div>
    </div>
  );
};