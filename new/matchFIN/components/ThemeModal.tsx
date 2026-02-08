
import React from 'react';
import { Theme } from '../types';

interface ThemeModalProps {
  themes: Theme[];
  currentThemeId: string;
  onSelect: (theme: Theme) => void;
  onClose: () => void;
}

const ThemeModal: React.FC<ThemeModalProps> = ({ themes, currentThemeId, onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-[320px] bg-[var(--bg-surface)] border-2 border-[var(--border-main)] rounded-[2rem] p-6 animate-in fade-in zoom-in duration-200 brutalist-shadow"
        style={{ boxShadow: '4px 4px 0px 0px var(--border-main)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <h2 className="text-[var(--text-main)] text-xl font-black italic uppercase tracking-tighter">SELECT THEME</h2>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {themes.map(theme => {
            const isSelected = theme.id === currentThemeId;
            return (
              <button
                key={theme.id}
                onClick={() => onSelect(theme)}
                className={`
                  aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-transform active:scale-95
                  ${isSelected ? 'ring-2 ring-offset-2 ring-[var(--text-main)]' : ''}
                `}
                style={{
                  backgroundColor: theme.colors['--bg-page'],
                  borderColor: theme.colors['--border-main'],
                } as React.CSSProperties}
              >
                <div 
                  className="w-6 h-6 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.colors['--bg-contrast'] }}
                ></div>
                <span 
                  className="text-[8px] font-black uppercase tracking-widest truncate w-full px-1 text-center"
                  style={{ color: theme.colors['--text-main'] }}
                >
                  {theme.name}
                </span>
              </button>
            );
          })}
        </div>

        <button 
          onClick={onClose}
          className="w-full h-12 bg-[var(--bg-contrast)] rounded-xl border-2 border-[var(--border-main)] flex items-center justify-center text-[var(--text-contrast)] font-black text-sm uppercase tracking-widest active:scale-95 transition-transform"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};

export default ThemeModal;
