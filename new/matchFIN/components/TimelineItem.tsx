
import React from 'react';
import { MatchEvent, EventType } from '../types';

interface TimelineItemProps {
  event: MatchEvent;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ event }) => {
  const isOG = event.type === EventType.OWN_GOAL;
  const isTeam1 = event.teamId === 't1';
  
  return (
    <div 
      className="relative h-16 rounded-[1.2rem] border-2 border-[var(--border-main)] flex items-center px-4 overflow-hidden transition-colors duration-300"
      style={{
        backgroundColor: isOG ? '#D1383D' : (isTeam1 ? 'var(--bg-contrast)' : 'var(--bg-surface)'),
        color: isOG ? 'white' : (isTeam1 ? 'var(--text-contrast)' : 'var(--text-main)')
      }}
    >
      <div className="w-10 text-xl font-black tracking-tighter">
        {event.scoreAtEvent}
      </div>
      
      <div className="mx-3 h-8 w-[1px] bg-current opacity-30"></div>
      
      <div className="flex-1">
        <div className="text-sm font-black italic leading-none uppercase tracking-tighter">
          {event.scorerName}
        </div>
        {isOG ? (
          <div className="text-[9px] font-bold opacity-80 uppercase mt-0.5">
            OWN GOAL ERROR
          </div>
        ) : (
          event.assistantName && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[8px] font-black border-[1px] border-current px-1 rounded opacity-60">ASSIST</span>
              <span className="text-[9px] font-bold opacity-80 uppercase">{event.assistantName}</span>
            </div>
          )
        )}
      </div>

      <div className="text-2xl">
        {isOG ? '💀' : '⚽'}
      </div>
    </div>
  );
};

export default TimelineItem;
