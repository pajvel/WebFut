
import React, { useState } from 'react';
import { TgProfile, Player } from '../types';
import { mockTgProfiles, mockPlayers } from '../data/mockData';
import { SectionHeader, ActionButton, Input, Badge } from '../components/Shared';

const TgLinkingSection: React.FC = () => {
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-webfut-border pb-4">
        <h1 className="text-2xl lg:text-4xl text-900 uppercase tracking-tighter italic">TG ↔ ПРОФИЛИ</h1>
        <ActionButton 
          onClick={() => alert('Linking successful!')} 
          disabled={!selectedProfile || !selectedPlayer}
          className="w-full sm:w-auto"
        >
          СВЯЗАТЬ ПРОФИЛИ
        </ActionButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-px bg-transparent lg:bg-webfut-border flex-1 lg:border border-webfut-border overflow-hidden lg:overflow-hidden overflow-y-auto">
        {/* Left Side: TG Profiles */}
        <div className="bg-black flex flex-col h-[300px] lg:h-full border border-webfut-border lg:border-none">
          <div className="bg-webfut-gray p-3 border-b border-webfut-border text-[10px] text-900 uppercase sticky top-0 z-10">TELEGRAM PROFILES</div>
          <div className="flex-1 overflow-auto">
            {mockTgProfiles.map(p => (
              <div 
                key={p.tg_id} 
                onClick={() => setSelectedProfile(p.tg_id)}
                className={`p-3 border-b border-webfut-border/30 flex items-center justify-between cursor-pointer transition-colors ${selectedProfile === p.tg_id ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
              >
                <div className="flex items-center gap-3">
                  <img src={p.avatar} className="w-6 h-6 lg:w-8 lg:h-8 rounded-full border border-webfut-border" alt="" />
                  <div>
                    <div className="text-900 text-xs lg:text-sm">{p.name}</div>
                    <div className="text-[8px] lg:text-[10px] font-mono text-zinc-500">ID: {p.tg_id}</div>
                  </div>
                </div>
                {p.linkedPlayerId ? (
                  <Badge color="bg-green-600">LINKED</Badge>
                ) : (
                  <Badge color="bg-zinc-700">UNLINKED</Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: System Players */}
        <div className="bg-black flex flex-col h-[300px] lg:h-full border border-webfut-border lg:border-none">
          <div className="bg-webfut-gray p-3 border-b border-webfut-border text-[10px] text-900 uppercase sticky top-0 z-10">WEBFUT PLAYERS</div>
          <div className="flex-1 overflow-auto">
            {mockPlayers.map(p => (
              <div 
                key={p.id} 
                onClick={() => setSelectedPlayer(p.id)}
                className={`p-3 border-b border-webfut-border/30 flex items-center justify-between cursor-pointer transition-colors ${selectedPlayer === p.id ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
              >
                <div>
                  <div className="text-900 italic uppercase text-xs lg:text-sm">{p.name}</div>
                  <div className="text-[8px] lg:text-[10px] text-zinc-500">TG_ID: {p.tg_id || 'NONE'}</div>
                </div>
                <div className="text-webfut-pink text-900 text-xs lg:text-sm">{p.globalRating}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TgLinkingSection;
