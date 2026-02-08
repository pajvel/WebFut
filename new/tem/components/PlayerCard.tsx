
import React from 'react';
import { Player } from '../types';

interface PlayerCardProps {
  player: Player;
  variant?: 'light' | 'dark';
  size?: 'sm' | 'lg';
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, variant = 'light', size = 'sm' }) => {
  const isLarge = size === 'lg';
  
  // Use CSS variables for colors to maintain the "brutal" and unified look
  return (
    <div 
      className={`
        relative flex items-center border-[1.5px] border-[var(--border-main)] rounded-xl w-full transition-all
        bg-[var(--bg-surface)] text-[var(--text-main)]
        ${isLarge ? 'p-2 h-14' : 'p-1 h-8'}
      `}
      style={{ boxShadow: '2px 2px 0px 0px var(--border-main)' }}
    >
      <img 
        src={player.avatar} 
        alt={player.name} 
        className={`rounded-full border border-[var(--border-main)] object-cover ${isLarge ? 'w-10 h-10' : 'w-6 h-6'}`}
      />
      <div className="ml-2 flex-1 overflow-hidden">
        <div className={`font-black italic truncate uppercase tracking-tighter leading-none ${isLarge ? 'text-sm mb-1' : 'text-[10px]'}`}>
          {player.name}
        </div>
        {isLarge && (
           <div className={`inline-block px-1 rounded font-black text-[8px] uppercase tracking-tighter border border-[var(--border-main)] bg-[var(--bg-page)] opacity-50`}>
             Ranked Player
           </div>
        )}
      </div>
      <div className={`px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border-2 border-[var(--border-main)] bg-[var(--bg-page)] ${isLarge ? 'text-[10px]' : 'text-[8px]'}`}>
        {player.elo}
      </div>
    </div>
  );
};

export default PlayerCard;
