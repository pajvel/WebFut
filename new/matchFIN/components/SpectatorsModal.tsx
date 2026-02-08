
import React, { useState } from 'react';

interface Spectator {
  id: string;
  name: string;
  avatar: string;
  isAdmin: boolean;
}

const MOCK_SPECTATORS: Spectator[] = [
  { id: '1', name: 'ultra_fan_99', avatar: 'https://picsum.photos/seed/u1/100', isAdmin: false },
  { id: '2', name: 'coach_boris', avatar: 'https://picsum.photos/seed/u2/100', isAdmin: true },
  { id: '3', name: 'casual_dave', avatar: 'https://picsum.photos/seed/u3/100', isAdmin: false },
  { id: '4', name: 'hooligan_joe', avatar: 'https://picsum.photos/seed/u4/100', isAdmin: false },
  { id: '5', name: 'referee_watcher', avatar: 'https://picsum.photos/seed/u5/100', isAdmin: false },
  { id: '6', name: 'scout_master', avatar: 'https://picsum.photos/seed/u6/100', isAdmin: false },
  { id: '7', name: 'var_check', avatar: 'https://picsum.photos/seed/u7/100', isAdmin: false },
  { id: '8', name: 'linesman_eye', avatar: 'https://picsum.photos/seed/u8/100', isAdmin: false },
];

interface SpectatorsModalProps {
  onClose: () => void;
}

const SpectatorsModal: React.FC<SpectatorsModalProps> = ({ onClose }) => {
  const [spectators, setSpectators] = useState(MOCK_SPECTATORS);

  const toggleRights = (id: string) => {
    setSpectators(prev => prev.map(s => 
      s.id === id ? { ...s, isAdmin: !s.isAdmin } : s
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-[320px] bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-[2rem] p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]"
        style={{ boxShadow: '4px 4px 0px 0px var(--border-main)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-6 flex-none">
          <h2 className="text-[var(--text-main)] text-xl font-black italic uppercase tracking-tighter">SPECTATORS</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-[var(--text-main)] text-[10px] font-bold uppercase tracking-widest opacity-60">1,342 ONLINE</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 mb-6">
          {spectators.map(s => (
            <div 
              key={s.id} 
              className="flex items-center gap-3 p-2 rounded-xl border-2 border-[var(--border-main)] bg-[var(--bg-page)] transition-colors"
            >
              <img 
                src={s.avatar} 
                alt={s.name} 
                className="w-8 h-8 rounded-lg grayscale object-cover border border-[var(--border-main)]"
              />
              
              <div className="flex-1 min-w-0">
                <div className="text-[var(--text-main)] text-[10px] font-black uppercase truncate leading-tight">
                  {s.name}
                </div>
                <div className="text-[var(--text-main)] opacity-50 text-[8px] font-bold uppercase tracking-widest leading-tight">
                  {s.isAdmin ? 'ADMIN' : 'VIEWER'}
                </div>
              </div>

              <button
                onClick={() => toggleRights(s.id)}
                className={`
                  h-7 px-2 rounded border-[1.5px] border-[var(--border-main)] 
                  text-[8px] font-black uppercase tracking-wider transition-all active:scale-95
                  ${s.isAdmin 
                    ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' 
                    : 'bg-[var(--bg-surface)] text-[var(--text-main)] opacity-60 hover:opacity-100'}
                `}
              >
                {s.isAdmin ? 'REVOKE' : 'GRANT'}
              </button>
            </div>
          ))}
        </div>

        <button 
          onClick={onClose}
          className="flex-none w-full h-12 bg-[var(--bg-contrast)] rounded-xl border-2 border-[var(--border-main)] flex items-center justify-center text-[var(--text-contrast)] font-black text-sm uppercase tracking-widest active:scale-95 transition-transform"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};

export default SpectatorsModal;
