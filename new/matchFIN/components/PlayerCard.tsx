
import React from 'react';
import { Player } from '../types';

interface PlayerCardProps {
  player: Player;
  variant: 'dark' | 'light';
  onGoal: () => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, variant, onGoal }) => {
  const isDark = variant === 'dark';
  
  return (
    <div 
      className="relative h-14 rounded-xl border-2 border-[var(--border-main)] flex items-center p-1 overflow-hidden transition-colors duration-300"
      style={{
        backgroundColor: isDark ? 'var(--bg-contrast)' : 'var(--bg-surface)',
        color: isDark ? 'var(--text-contrast)' : 'var(--text-main)'
      }}
    >
      <img 
        src={player.avatar} 
        alt={player.name} 
        className="w-10 h-10 rounded-lg object-cover grayscale"
      />
      
      <div className="ml-2 flex-1 min-w-0">
        <div className="text-[11px] font-black italic leading-none truncate">{player.name}</div>
        <div 
          className="text-[8px] font-bold mt-0.5 inline-block px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            color: 'currentColor',
            opacity: 0.7
          }}
        >
          {player.elo}
        </div>
      </div>

      <div className="flex flex-col justify-center ml-1 pr-1">
        <button 
          onClick={onGoal}
          className="h-9 px-3 rounded-md border-[1.5px] border-[var(--border-main)] text-[9px] font-black italic uppercase transition-transform active:scale-95"
          style={{
            backgroundColor: isDark ? 'var(--bg-surface)' : 'var(--bg-contrast)',
            color: isDark ? 'var(--text-main)' : 'var(--text-contrast)'
          }}
        >
          GOAL
        </button>
      </div>
    </div>
  );
};

export default PlayerCard;
