import React from 'react';
import { StarIcon } from './Icons';

const TOP_PLAYERS = [
  { rank: 2, name: 'ALEX', elo: 1480, avatar: 'https://i.pravatar.cc/150?u=11' },
  { rank: 1, name: 'ZAYAC', elo: 1520, avatar: 'https://picsum.photos/400/400' },
  { rank: 3, name: 'MORTY', elo: 1465, avatar: 'https://i.pravatar.cc/150?u=12' },
];

const TABLE_PLAYERS = [
  { pos: 4, name: 'SOLO', games: 120, wins: 70, losses: 50, elo: 1440, avatar: 'https://i.pravatar.cc/150?u=13' },
  { pos: 5, name: 'DENDI', games: 310, wins: 180, losses: 130, elo: 1420, avatar: 'https://i.pravatar.cc/150?u=14' },
  { pos: 6, name: 'MIRACLE', games: 95, wins: 60, losses: 35, elo: 1395, avatar: 'https://i.pravatar.cc/150?u=15' },
  { pos: 7, name: 'PUPEY', games: 240, wins: 110, losses: 130, elo: 1380, avatar: 'https://i.pravatar.cc/150?u=16' },
];

export const LeaderboardView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="flex flex-col gap-8 pb-10">
      
      {/* MONOLITHIC PEDESTAL */}
      <div className="flex items-end justify-between gap-1 h-[460px] w-full px-1">
         
         {[TOP_PLAYERS[0], TOP_PLAYERS[1], TOP_PLAYERS[2]].map((player) => {
            const isWinner = player.rank === 1;
            const isSecond = player.rank === 2;
            
            const orderClass = isWinner ? 'order-2' : isSecond ? 'order-1' : 'order-3';
            const heightClass = isWinner ? 'h-full' : isSecond ? 'h-[85%]' : 'h-[70%]';
            
            return (
              <div key={player.rank} className={`flex-1 flex flex-col ${orderClass} ${heightClass} transition-all duration-700 ease-out`}>
                  
                  {/* Rank Header */}
                  <div className="flex items-center justify-between px-2 mb-2">
                      <span className={`font-black text-[10px] tracking-[0.2em] ${isWinner ? 'text-brand' : 'text-zinc-600'}`}>
                        {player.rank === 1 ? 'TOP_ONE' : `TIER_0${player.rank}`}
                      </span>
                      {isWinner && <StarIcon />}
                  </div>

                  {/* The Monolith Pillar */}
                  <div className={`
                    flex-1 flex flex-col items-center justify-between p-2 rounded-2xl relative overflow-hidden border-2
                    ${isWinner ? 'bg-brand border-brand shadow-[0_0_40px_rgba(var(--color-accent-rgb),0.2)]' : 'bg-surface border-zinc-800'}
                  `}>
                      
                      {/* Avatar: High Contrast Squircle */}
                      <div className={`
                        w-full aspect-square rounded-xl overflow-hidden border-2 mb-2
                        ${isWinner ? 'border-black/20' : 'border-zinc-700'}
                      `}>
                         <img 
                            src={player.avatar} 
                            alt={player.name} 
                            className={`w-full h-full object-cover ${!isWinner && 'grayscale contrast-125 brightness-75'}`} 
                         />
                      </div>

                      {/* Player Info */}
                      <div className="flex flex-col items-center text-center w-full z-10 px-1 py-2">
                          <h3 className={`font-black text-xs uppercase tracking-tighter leading-none mb-1 w-full truncate ${isWinner ? 'text-black italic' : 'text-white'}`}>
                            {player.name}
                          </h3>
                          <div className={`text-[10px] font-black uppercase tracking-widest ${isWinner ? 'text-black/60' : 'text-zinc-500'}`}>
                            {player.elo} <span className="text-[7px]">PTS</span>
                          </div>
                      </div>

                      {/* Giant Foundation Number (No Overlap - Pure Structural Element) */}
                      <div className="mt-auto w-full flex justify-center pb-2">
                        <span className={`
                          font-black text-6xl leading-[0.7] tracking-tighter select-none
                          ${isWinner ? 'text-black/10' : 'text-zinc-800/50'}
                        `}>
                          {player.rank}
                        </span>
                      </div>

                      {/* Industrial accents */}
                      <div className={`absolute top-0 right-0 p-1 opacity-20 ${isWinner ? 'text-black' : 'text-zinc-600'}`}>
                          <div className="w-2 h-2 border-r-2 border-t-2"></div>
                      </div>
                  </div>
              </div>
            )
         })}
      </div>

      {/* LIST SECTION: BOLDER & CLEANER */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
            <h2 className="font-black text-2xl italic uppercase tracking-tighter text-white">The Pursuit</h2>
            <span className="bg-zinc-800 text-zinc-400 font-black text-[9px] px-2 py-1 rounded uppercase tracking-[0.2em]">Season 04</span>
        </div>

        <div className="flex flex-col rounded-3xl overflow-hidden border-2 border-zinc-800 bg-surface/50">
           {TABLE_PLAYERS.map((p) => (
             <div key={p.pos} className="flex items-center py-4 px-5 border-b-2 border-zinc-800 last:border-0 hover:bg-white/[0.02] active:bg-white/[0.05] transition-all group">
                {/* Pos with massive impact */}
                <span className="w-10 font-black text-xl text-zinc-700 italic group-hover:text-zinc-500 transition-colors">
                  {p.pos}
                </span>
                
                {/* Competitor */}
                <div className="flex-1 flex items-center gap-4">
                   <div className="w-11 h-11 rounded-lg bg-zinc-800 border-2 border-zinc-700 overflow-hidden shrink-0">
                      <img src={p.avatar} alt={p.name} className="w-full h-full object-cover grayscale opacity-80" />
                   </div>
                   <div className="flex flex-col leading-none">
                      <span className="font-black text-white text-sm uppercase tracking-tight italic mb-1">{p.name}</span>
                      <div className="flex gap-1">
                          <div className="h-1 w-8 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-zinc-600" style={{ width: '60%' }}></div>
                          </div>
                      </div>
                   </div>
                </div>

                {/* Rating */}
                <div className="flex flex-col items-end leading-none">
                    <span className="font-black text-lg text-white tracking-tighter italic">{p.elo}</span>
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1">Rating</span>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* PERSISTENT FOOTER: YOUR STATUS */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t-2 border-brand/20 flex items-center justify-between rounded-t-[2rem]">
          <div className="flex flex-col">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Your Current Position</span>
              <span className="text-2xl font-black text-white italic uppercase tracking-tighter">Elite Rank #10</span>
          </div>
          <div className="flex items-center gap-4">
              <div className="text-right">
                  <span className="block font-black text-xl text-brand leading-none tracking-tighter">1,450</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">+12 Today</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-black">
                  <StarIcon />
              </div>
          </div>
      </div>

    </div>
  );
};