import React from 'react';
import { PlayerProfile } from '../types';
import { TrendUpIcon, TrendDownIcon } from './Icons';

interface Props {
  profile: PlayerProfile;
}

export const ProfileCard: React.FC<Props> = ({ profile }) => {
  const isPositive = profile.eloChange >= 0;

  return (
    <div className="w-full aspect-[3/4] bg-zinc-900 border border-border rounded-[2rem] relative overflow-hidden group mt-4">
      {/* LAYER 1: Background Big Typography (Behind Image) */}
      <div className="absolute inset-0 p-4 flex flex-col z-0 pointer-events-none select-none overflow-hidden leading-none">
        <h1 className="text-[6.5rem] font-black uppercase text-white/10 break-all tracking-tighter leading-[0.8]">
          {profile.name}
        </h1>
      </div>

      {/* LAYER 2: Hero Image */}
      <div className="absolute inset-0 z-10 top-16 bottom-24 mx-4 rounded-3xl overflow-hidden border-2 border-white/5 shadow-2xl group">
         <img 
            src={profile.avatarUrl} 
            alt={profile.name} 
            className="w-full h-full object-cover filter contrast-125 saturate-0 brightness-110" 
         />
         {/* Gradient for text readability */}
         <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
      </div>

      {/* LAYER 3: Foreground Stats & Name */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex gap-3 h-24 items-end">
        
        {/* Left Card: ELO */}
        <div className="w-1/2 bg-brand rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden h-full">
            {/* Value */}
            <div className="flex items-baseline gap-1 z-10">
                 <span className="text-5xl font-black text-black tracking-tighter leading-none">{profile.elo}</span>
            </div>

            {/* Label */}
            <div className="z-10 mt-auto">
                <span className="block text-[10px] font-black uppercase text-black leading-none">Global</span>
                <span className="block text-[10px] font-black uppercase text-black/60 leading-none">Rating</span>
            </div>

            {/* Trend Indicator */}
            <div className="absolute top-4 right-4 text-black bg-black/20 rounded-full p-1">
                 {isPositive ? <TrendUpIcon size={16} /> : <TrendDownIcon size={16} />}
            </div>
        </div>

        {/* Right Side: Player Name (Replaces Rank Card) */}
        <div className="w-1/2 flex flex-col justify-end items-end h-full pb-1">
             <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none drop-shadow-xl text-right">
                 {profile.name}
             </h2>
             <div className="flex items-center gap-2 mt-2">
                 <div className="bg-brand text-black text-[9px] font-black px-1.5 py-0.5 uppercase tracking-wider rounded-sm">
                    PRO
                 </div>
                 <span className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest drop-shadow-md">
                    #10
                 </span>
             </div>
        </div>

      </div>
    </div>
  );
};