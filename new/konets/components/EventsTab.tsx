
import React from 'react';
import { MatchData, MatchEvent, Player } from '../types';

interface EventsTabProps {
  data: MatchData;
}

const EventsTab: React.FC<EventsTabProps> = ({ data }) => {
  const groupedEvents = data.periods.map(period => ({
    period,
    events: data.events.filter(e => e.period === period)
  }));

  const allPlayers = [...data.teamA, ...data.teamB];
  const getPlayer = (name: string) => allPlayers.find(p => p.name === name);

  return (
    <div className="space-y-12 pb-20">
      {groupedEvents.map((group) => (
        <div key={group.period} className="space-y-4">
          {/* PERIOD HEADER */}
          <div className="flex items-center gap-4 px-2">
            <h2 className="text-xl font-black italic uppercase tracking-tighter">{group.period}</h2>
            <div className="h-[4px] bg-black flex-1 rounded-full"></div>
          </div>

          <div className="space-y-4">
             {group.events.map(event => (
               <EventCard 
                 key={event.id} 
                 event={event} 
                 scorer={getPlayer(event.player)}
                 assistant={event.assist ? getPlayer(event.assist) : undefined}
                 teamAName={data.teamAName}
                 teamBName={data.teamBName}
               />
             ))}
          </div>
        </div>
      ))}

      <div className="mt-12 p-8 border-4 border-black border-dashed rounded-[40px] flex flex-col items-center justify-center opacity-30">
        <div className="text-4xl font-black italic uppercase tracking-tighter">FULL TIME</div>
        <div className="text-sm font-bold uppercase">NO MORE EVENTS</div>
      </div>
    </div>
  );
};

interface EventCardProps {
  event: MatchEvent;
  scorer?: Player;
  assistant?: Player;
  teamAName: string;
  teamBName: string;
}

const EventCard: React.FC<EventCardProps> = ({ event, scorer, assistant, teamAName, teamBName }) => {
  const isTeamA = event.team === 'A';
  const hasAssist = !!event.assist;
  
  return (
    <div className={`
      relative w-full border-4 border-black rounded-[32px] p-5 brutal-shadow overflow-hidden
      ${isTeamA ? 'bg-black text-white' : 'bg-white text-black'}
    `}>
      {/* TEAM LABEL WATERMARK */}
      <div className={`absolute top-2 right-4 text-[40px] font-black italic opacity-10 pointer-events-none uppercase leading-none`}>
        {isTeamA ? teamAName : teamBName}
      </div>

      <div className="flex items-center justify-between relative z-10">
        
        {/* PLAYER INFO BLOCK */}
        <div className="flex items-center gap-4">
          {/* AVATAR COMBO */}
          <div className="relative h-20 w-20 shrink-0">
            {/* SCORER AVATAR - LARGER IF NO ASSIST */}
            <div className={`
              absolute top-0 left-0 border-4 border-current rounded-2xl overflow-hidden grayscale bg-gray-200 transition-all
              ${hasAssist ? 'w-16 h-16' : 'w-20 h-20'}
            `}>
               <img 
                 src={scorer?.avatar || 'https://picsum.photos/200/200'} 
                 className="w-full h-full object-cover" 
                 alt={event.player}
               />
            </div>
            {/* ASSISTANT AVATAR (OVERLAP) */}
            {hasAssist && assistant && (
              <div className={`
                absolute -bottom-1 -right-1 w-10 h-10 border-4 rounded-xl overflow-hidden grayscale bg-gray-300
                ${isTeamA ? 'border-white' : 'border-black'}
              `}>
                 <img 
                   src={assistant.avatar} 
                   className="w-full h-full object-cover" 
                   alt={event.assist}
                 />
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-[9px] font-black italic uppercase rounded-md border-2 border-current`}>
                {event.type === 'goal' ? 'GOAL' : 'OWN GOAL'}
              </span>
            </div>
            <h3 className="text-2xl font-black italic uppercase leading-none tracking-tighter">
              {event.player}
            </h3>
            {event.assist && (
              <div className="text-[10px] font-bold uppercase opacity-60 italic mt-1">
                ASSIST BY {event.assist}
              </div>
            )}
          </div>
        </div>

        {/* SCORE DISPLAY */}
        <div className="text-right">
           <div className={`text-3xl font-black italic tracking-tighter border-b-4 border-current pb-1`}>
             {event.scoreAfter.replace(/\s/g, '')}
           </div>
           <div className="text-[10px] font-black italic opacity-40 uppercase mt-1">
             RESULT
           </div>
        </div>

      </div>
    </div>
  );
};

export default EventsTab;
