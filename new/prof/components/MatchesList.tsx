import React from 'react';
import { Match } from '../types';
import { ArrowRightIcon, LeaderboardIcon } from './Icons';

interface Props {
  matches: Match[];
}

// ------------------------------------------------------------------
// HERO MATCH CARD (Latest Game)
// ------------------------------------------------------------------
const HeroMatchCard: React.FC<{ match: Match }> = ({ match }) => {
  const isWin = match.result === 'WIN';
  const borderColor = isWin ? 'border-brand' : 'border-zinc-800';
  
  // Avatar Group Component
  const AvatarStack = ({ avatars, align }: { avatars: string[], align: 'left' | 'right' }) => (
    <div className={`flex items-center ${align === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
      {avatars.slice(0, 5).map((url, i) => (
        <div 
            key={i} 
            className={`
                w-8 h-8 rounded-full border-2 border-zinc-900 bg-zinc-800 overflow-hidden 
                ${align === 'left' ? '-ml-2 first:ml-0' : '-mr-2 first:mr-0'} 
                z-${10 - i} relative
            `}
        >
          <img src={url} alt="p" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full mb-3 mt-2">
        {/* Label */}
        <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                Latest Match Report
            </span>
            <span className="text-[9px] font-bold text-zinc-500 uppercase">{match.date}</span>
        </div>

        {/* Card Body */}
        <div className={`
            relative w-full border-2 ${borderColor} rounded-[1.5rem] p-4 
            flex flex-col gap-4 overflow-hidden group
            ${isWin ? 'bg-brand shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'bg-zinc-900'}
        `}>
            
            {/* MVP Badge - Redesigned to show Player */}
            {match.mvpPlayer && (
                <div className={`
                  absolute top-0 left-1/2 -translate-x-1/2 pl-3 pr-4 py-1.5 rounded-b-2xl shadow-[0_4px_20px_rgba(255,255,255,0.2)] z-20 flex items-center gap-3
                  ${isWin ? 'bg-black text-white' : 'bg-white text-black'}
                `}>
                    <div className="flex items-center gap-1.5 border-r-2 border-white/10 pr-3">
                        <LeaderboardIcon />
                        <span className="font-black text-[10px] uppercase tracking-widest">MVP</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-zinc-200 p-[1px] ring-1 ring-black/10">
                            <img src={match.mvpPlayer.avatarUrl} alt="MVP" className="w-full h-full rounded-full object-cover" />
                        </div>
                        <span className="font-black text-[10px] uppercase tracking-tight">{match.mvpPlayer.name}</span>
                    </div>
                </div>
            )}

            {/* Score & Teams */}
            <div className="flex items-center justify-between mt-4">
                {/* My Team */}
                <div className="flex flex-col items-start gap-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">My Team</span>
                    <AvatarStack avatars={match.myTeamAvatars} align="left" />
                </div>

                {/* Score */}
                <div className="flex flex-col items-center pt-2">
                    <div className="flex items-center gap-1">
                        <span className={`text-4xl font-black italic ${isWin ? 'text-black' : 'text-zinc-400'}`}>
                            {match.scoreMyTeam}
                        </span>
                        <span className="text-zinc-700 text-2xl font-black">:</span>
                        <span className={`text-4xl font-black italic ${isWin ? 'text-black/60' : 'text-white'}`}>
                            {match.scoreOpponent}
                        </span>
                    </div>
                    <span className={`
                        text-[10px] font-black uppercase px-2 py-0.5 rounded border mt-1
                        ${isWin ? 'border-black text-black' : 'border-zinc-700 text-zinc-500'}
                    `}>
                        {match.result}
                    </span>
                </div>

                {/* Opponent */}
                <div className="flex flex-col items-end gap-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Opponent</span>
                    <AvatarStack avatars={match.opponentAvatars} align="right" />
                </div>
            </div>

            {/* Match Info Footer */}
            <div className="flex items-center justify-between border-t pt-3 mt-1 border-white/10">
                <span className={`font-black text-sm uppercase italic truncate max-w-[150px] ${isWin ? 'text-black' : 'text-white'}`}>
                    VS {match.opponent}
                </span>
                 <button className={`flex items-center justify-center w-8 h-8 rounded-full ${isWin ? 'bg-black text-white' : 'bg-white text-black'}`}>
                    <ArrowRightIcon />
                 </button>
            </div>
        </div>
    </div>
  );
};

// ------------------------------------------------------------------
// COMPACT ROW (History)
// ------------------------------------------------------------------
const CompactMatchRow: React.FC<{ match: Match }> = ({ match }) => {
  const isWin = match.result === 'WIN';
  const isDraw = match.result === 'DRAW';
  
  let resultColor = 'text-zinc-500';
  if (isWin) resultColor = 'text-white';
  if (isDraw) resultColor = 'text-zinc-400';

  return (
    <div className="w-full h-14 flex items-center justify-between border-b border-zinc-800 px-1 hover:bg-white/5 transition-colors group">
        
        {/* Left: Result Indicator & Name */}
        <div className="flex items-center gap-3">
            <div className={`
                w-8 h-8 flex items-center justify-center rounded border-2 font-black text-[10px] uppercase
                ${isWin ? 'border-white bg-white text-black' : 'border-zinc-800 bg-transparent text-zinc-600'}
            `}>
                {match.result.substring(0, 1)}
            </div>
            <div className="flex flex-col leading-none">
                <span className="text-[12px] font-black text-white uppercase italic tracking-tight">{match.opponent}</span>
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wide">{match.date}</span>
            </div>
        </div>

        {/* Right: Score */}
        <div className="flex items-center gap-2">
            <span className={`text-lg font-black italic ${resultColor}`}>
                {match.scoreMyTeam}:{match.scoreOpponent}
            </span>
            <div className="text-zinc-700 group-hover:text-white transition-colors">
                <ArrowRightIcon />
            </div>
        </div>

    </div>
  );
};

// ------------------------------------------------------------------
// MAIN LIST COMPONENT
// ------------------------------------------------------------------
export const MatchesList: React.FC<Props> = ({ matches }) => {
  if (!matches.length) return null;

  const [latestMatch, ...previousMatches] = matches;

  return (
    <div className="w-full mt-6">
      
      {/* Latest Match (Hero) */}
      <HeroMatchCard match={latestMatch} />

      {/* History Header */}
      <div className="flex items-end justify-between mb-2 mt-6 px-1">
        <h2 className="font-black text-lg text-zinc-400 italic uppercase tracking-tighter leading-none">History</h2>
        <button className="text-[9px] font-bold text-zinc-600 hover:text-white transition-colors uppercase">
            View All
        </button>
      </div>
      
      {/* History List */}
      <div className="flex flex-col">
        {previousMatches.map(match => (
            <CompactMatchRow key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
};