
import React from 'react';
import { Player } from '../types';

interface GoalModalProps {
  scorer: Player;
  teamPlayers: Player[];
  onSelectAssist: (id?: string) => void;
  onSelectOG: () => void;
  onCancel: () => void;
}

const GoalModal: React.FC<GoalModalProps> = ({ scorer, teamPlayers, onSelectAssist, onSelectOG, onCancel }) => {
  const assistants = teamPlayers.filter(p => p.id !== scorer.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <div 
        className="w-full max-w-[320px] bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-[2rem] p-6 animate-in fade-in zoom-in duration-200"
        style={{ boxShadow: '4px 4px 0px 0px var(--border-main)' }}
      >
        <div className="text-center mb-6">
          <h2 className="text-[var(--text-main)] text-3xl font-black italic uppercase tracking-tighter leading-none">GOAL ASSIST?</h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[var(--text-main)] text-[10px] font-bold uppercase tracking-widest opacity-60">SCORER:</span>
            <span className="bg-[var(--bg-contrast)] text-[var(--text-contrast)] text-[10px] font-black uppercase px-2 py-0.5 rounded border border-[var(--border-main)]">
              {scorer.name}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {assistants.map(p => (
            <button 
              key={p.id}
              onClick={() => onSelectAssist(p.id)}
              className="bg-[var(--bg-page)] border-2 border-[var(--border-main)] rounded-xl p-3 flex flex-col items-center gap-2 active:scale-95 transition-all hover:bg-[var(--bg-contrast)] group"
            >
              <img 
                src={p.avatar} 
                className="w-10 h-10 rounded-lg grayscale border border-[var(--border-main)] group-hover:grayscale-0 transition-all object-cover" 
                alt={p.name} 
              />
              <span className="text-[var(--text-main)] group-hover:text-[var(--text-contrast)] text-[10px] font-black uppercase tracking-widest truncate w-full text-center transition-colors">
                {p.name}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => onSelectAssist(undefined)}
            className="w-full h-14 bg-[var(--bg-contrast)] rounded-xl border-2 border-[var(--border-main)] flex items-center justify-center text-[var(--text-contrast)] font-black italic text-lg uppercase tracking-tighter active:scale-95 transition-transform shadow-sm"
          >
            NO ASSIST / SOLO
          </button>
          
          <button 
            onClick={onSelectOG}
            className="w-full h-10 bg-[#ef4444] rounded-lg border-2 border-[var(--border-main)] flex items-center justify-center text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-transform"
          >
            RECORD AS OWN GOAL
          </button>

          <button 
            onClick={onCancel}
            className="w-full py-2 text-[var(--text-main)] font-black text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
          >
            CANCEL ENTRY
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoalModal;
