
import React from 'react';
import { AppTheme } from '../types';
import { THEMES } from '../constants';

interface ThemeSelectorProps {
  currentThemeId: string;
  onSelect: (theme: AppTheme) => void;
  onClose: () => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentThemeId, onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xs bg-[#FFF1F5] rounded-[48px] p-8 border-4 border-black brutal-shadow-sm flex flex-col items-center animate-in zoom-in-95 duration-200">
        
        <h2 className="font-black italic text-2xl uppercase tracking-tight mb-8">
          SELECT THEME
        </h2>

        <div className="grid grid-cols-3 gap-3 w-full mb-8">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => onSelect(theme)}
              className={`
                aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-90
                ${theme.id === currentThemeId ? 'border-pink-400 border-[3px]' : 'border-black'}
              `}
              style={{ backgroundColor: theme.colors.bgPage }}
            >
              <div 
                className="w-6 h-6 rounded-full border border-black/10" 
                style={{ backgroundColor: theme.colors.bgContrast }}
              />
              <span 
                className="font-black text-[9px] uppercase tracking-wider"
                style={{ color: theme.id === 'juve' || theme.id === 'shinnik' || theme.id === 'barca' || theme.id === 'bvb' ? '#ffffff' : '#000000' }}
              >
                {theme.name}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-5 bg-[#F5A9C5] border-2 border-black rounded-[24px] font-black italic text-lg uppercase tracking-tight active:scale-95 transition-transform brutal-shadow-sm"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};

export default ThemeSelector;
