
import React from 'react';
import { Match, MatchStatus } from '../types';

interface MatchCardProps {
  match: Match;
  onClick: (match: Match) => void;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, onClick }) => {
  const isFinished = match.status === MatchStatus.FINISHED;
  const isLive = match.status === MatchStatus.LIVE;
  const isLobby = match.status === MatchStatus.JOINABLE || match.status === MatchStatus.WAITING;
  
  const isWin = isFinished && (match.scoreA || 0) > (match.scoreB || 0);
  const allPlayers = [...(match.teamAAvatars || []), ...(match.teamBAvatars || [])];

  const getStatusConfig = () => {
    switch (match.status) {
      case MatchStatus.LIVE:
        return { label: 'LIVE', color: 'bg-red-600' };
      case MatchStatus.WAITING:
        return { label: 'WAITING', color: 'bg-orange-500' };
      case MatchStatus.JOINABLE:
        return { label: 'JOINABLE', color: 'bg-green-600' };
      case MatchStatus.FINISHED:
        return { label: 'FINISHED', color: 'bg-gray-500' };
      default:
        return { label: '', color: 'bg-[var(--bg-contrast)]' };
    }
  };

  const status = getStatusConfig();

  const renderAvatars = (avatars: string[] = [], align: 'left' | 'right') => (
    <div className={`flex -space-x-3 overflow-hidden ${align === 'right' ? 'flex-row-reverse space-x-reverse' : ''}`}>
      {avatars.slice(0, 7).map((src, i) => (
        <div key={i} className="relative">
          <img
            className="inline-block h-11 w-11 rounded-full border-2 border-[var(--bg-surface)] ring-1 ring-black/10 object-cover bg-gray-100"
            src={src}
            alt={`Player ${i}`}
          />
        </div>
      ))}
      {avatars.length > 7 && (
        <div className={`h-11 w-11 rounded-full border-2 border-[var(--bg-surface)] bg-[var(--bg-contrast)] flex items-center justify-center text-[11px] font-black text-[var(--text-contrast)] z-10 ${align === 'right' ? '-mr-3' : '-ml-3'}`}>
          +{avatars.length - 7}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative mb-12">
      {/* Status Badge */}
      <div className={`absolute top-0 right-6 -translate-y-1/2 ${status.color} text-white px-3 py-1 rounded-full z-20 border-2 border-black shadow-[2px 2px 0px 0px rgba(0,0,0,1)]`}>
        <span className="font-black italic text-[10px] uppercase tracking-wider">
          {status.label}
        </span>
      </div>

      {/* Top MVP Badge - Only for Finished */}
      {isFinished && match.mvp && (
        <div className="absolute top-0 left-6 -translate-y-1/2 bg-[var(--bg-contrast)] text-[var(--text-contrast)] rounded-full px-4 py-1.5 flex items-center gap-2 z-10 shadow-lg border border-[var(--border-main)]/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
             <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1c2.45-.39 4.39-2.47 4.39-4.94 1.1-.08 2-.98 2-2.06V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.43 5 9.3 5 8zm14 0c0 1.3-.84 2.43-2 2.82V7h2v1z"/>
          </svg>
          <span className="font-black text-[10px] uppercase tracking-tight">MVP: {match.mvp.name}</span>
        </div>
      )}

      {/* Main Card Container */}
      <button
        onClick={() => onClick(match)}
        className="w-full text-left bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-[2.5rem] p-6 pt-10 flex flex-col transition-all active:scale-[0.98] brutalist-shadow"
      >
        <div className="grid grid-cols-3 items-center mb-6 w-full">
          {/* Column 1: Left */}
          <div className="flex flex-col gap-2 overflow-hidden">
            <span className="font-bold text-[10px] uppercase text-gray-400 tracking-wider">
              {isLobby ? 'PARTICIPANTS' : 'TEAM A'}
            </span>
            {isLobby ? renderAvatars(allPlayers, 'left') : renderAvatars(match.teamAAvatars, 'left')}
          </div>

          {/* Column 2: Center */}
          <div className="flex flex-col items-center justify-center">
            {(!isLobby) ? (
              <div className="font-black italic text-4xl tracking-tighter leading-none text-[var(--text-main)] flex items-center whitespace-nowrap">
                {isFinished ? (
                  <>
                    {match.scoreA}<span className="mx-0.5 text-gray-300">:</span>{match.scoreB}
                  </>
                ) : (
                  <span className="text-red-600 animate-pulse">{match.scoreA}:{match.scoreB}</span>
                )}
              </div>
            ) : (
              <div className="h-10"></div>
            )}
            {isFinished && (
              <div className="mt-3 border-2 border-[var(--border-main)] px-4 py-0.5 rounded-lg text-[var(--text-main)]">
                <span className="font-black text-[10px] uppercase tracking-tight">
                  {isWin ? 'WIN' : 'LOSS'}
                </span>
              </div>
            )}
          </div>

          {/* Column 3: Right */}
          <div className="flex flex-col gap-2 items-end overflow-hidden text-right">
            {!isLobby ? (
              <>
                <span className="font-bold text-[10px] uppercase text-gray-400 tracking-wider">
                  TEAM B
                </span>
                {renderAvatars(match.teamBAvatars, 'right')}
              </>
            ) : (
              <div className="h-10"></div>
            )}
          </div>
        </div>

        {/* Divider Line */}
        <div className="h-[1.5px] bg-[var(--border-main)]/5 w-full mb-4"></div>

        {/* Footer Area */}
        <div className="flex justify-between items-end">
          <div className="flex flex-col overflow-hidden">
            <h2 className="font-black italic text-xl tracking-tighter uppercase leading-none mb-1 truncate text-[var(--text-main)]">
              {isLobby ? (match.date || 'TODAY') : `VS ${match.teamB}`}
            </h2>
            <div className="flex gap-2 items-center flex-wrap">
               <span className="font-bold text-[11px] uppercase text-[var(--text-main)] tracking-tight whitespace-nowrap">
                 {match.time}
               </span>
               <div className="w-1 h-1 rounded-full bg-gray-300"></div>
               <span className="font-bold text-[11px] uppercase text-gray-400 tracking-tight truncate">
                 {match.venue}
               </span>
            </div>
          </div>
          
          <div className="w-10 h-10 rounded-full bg-[var(--bg-contrast)] text-[var(--text-contrast)] flex items-center justify-center shrink-0 shadow-lg ml-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        </div>
      </button>
    </div>
  );
};

export default MatchCard;