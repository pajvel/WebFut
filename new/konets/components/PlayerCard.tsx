
import React from 'react';
import { Player } from '../types';

interface PlayerCardProps {
  player: Player;
  variant: 'black' | 'white';
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, variant }) => {
  const isBlack = variant === 'black';

  return (
    <div className={`
      flex items-center p-2 border-2 border-[var(--border-main)] transition-all active:scale-95 cursor-pointer rounded-2xl
      ${isBlack ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' : 'bg-[var(--bg-surface)] text-[var(--text-main)]'}
    `}>
      <img src={player.avatar} alt={player.name} className="w-10 h-10 border-2 border-current grayscale rounded-xl object-cover" />
      <div className="ml-2 flex-1 min-w-0">
        <div className="font-black italic text-[11px] truncate leading-none mb-1 uppercase">{player.name}</div>
        <div className={`text-[8px] font-black px-1.5 py-0.5 inline-block rounded-md ${isBlack ? 'bg-white/20' : 'bg-black/10'}`}>
          {player.elo} ELO
        </div>
      </div>
      <div className="flex flex-col gap-1 ml-1">
        <div className={`
          px-1.5 py-0.5 border-2 border-current font-black italic text-[8px] uppercase leading-none text-center min-w-[32px] rounded-lg
          ${isBlack ? 'bg-[var(--bg-surface)] text-[var(--text-main)]' : 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]'}
        `}>
          {player.goals}G
        </div>
        <div className={`
          px-1.5 py-0.5 border-2 border-current font-black italic text-[8px] uppercase leading-none text-center min-w-[32px] rounded-lg
          ${isBlack ? 'bg-[var(--bg-surface)] text-[var(--text-main)]' : 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]'}
        `}>
          {player.assists}A
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
