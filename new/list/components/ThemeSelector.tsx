
import React from 'react';
import { Theme } from '../types';
import { THEMES } from '../constants';

interface ThemeSelectorProps {
  currentThemeId: string;
  onSelect: (theme: Theme) => void;
  onClose: () => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentThemeId, onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#FFF5F7] animate-in fade-in duration-300"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-md flex flex-col animate-in zoom-in duration-300">
        <h2 className="font-black italic text-3xl text-center uppercase tracking-tight mb-12 text-black">
          SELECT THEME
        </h2>

        <div className="grid grid-cols-3 gap-4 mb-16">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => onSelect(theme)}
              className={`flex flex-col items-center gap-3 p-4 rounded-[1.5rem] transition-all bg-[${theme.previewBg}] ${
                currentThemeId === theme.id 
                ? 'border-[3px] border-[#F2A1B8] shadow-none scale-105' 
                : 'border-[2px] border-black shadow-sm active:scale-95'
              }`}
              style={{ 
                backgroundColor: theme.previewBg,
                borderColor: currentThemeId === theme.id ? '#F2A1B8' : 'black'
              }}
            >
              <div 
                className="w-10 h-10 rounded-full border-2 border-black"
                style={{ backgroundColor: theme.circleColor }}
              ></div>
              <span className={`font-black text-[10px] tracking-tight ${theme.id === 'juve' || theme.id === 'shinnik' || theme.id === 'barca' || theme.id === 'bvb' ? 'text-white' : 'text-black'}`}>
                {theme.name}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-6 rounded-[2.5rem] bg-[#F2A1B8] border-[3px] border-black font-black italic text-2xl uppercase tracking-tight text-black shadow-[4px 4px 0px 0px rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};

export default ThemeSelector;