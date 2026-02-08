
import React from 'react';
import { BACK_ARROW_SVG, THEME_ICON_SVG } from '../constants';

interface HeaderProps {
  matchDate: string;
  matchTime: string;
  matchStatus: string;
  onThemeClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ matchDate, matchTime, matchStatus, onThemeClick }) => {
  return (
    <div className="flex-none bg-[var(--bg-surface)] p-4 border-b-2 border-[var(--border-main)] z-20">
      <div className="flex items-center justify-between">
        
        <div className="flex gap-2 shrink-0">
          <button
            className="flex items-center justify-center w-10 h-10 border-2 border-[var(--border-main)] bg-[var(--bg-surface)] active:scale-90 brutal-shadow-sm transition-transform"
          >
            {BACK_ARROW_SVG}
          </button>
          <button
            onClick={onThemeClick}
            className="flex items-center justify-center w-10 h-10 border-2 border-[var(--border-main)] bg-[var(--bg-surface)] active:scale-90 brutal-shadow-sm transition-transform"
          >
            {THEME_ICON_SVG}
          </button>
        </div>

        <div className="flex-1 text-center">
          <h1 className="font-black italic text-xl tracking-tight leading-none uppercase text-[var(--text-main)]">
            WEBFUT
          </h1>
        </div>

        <div className="w-24 text-right text-xs font-bold italic leading-tight uppercase text-[var(--text-main)]">
          <div>{matchDate}</div>
          <div>{matchTime}</div>
          <div className="text-red-600">{matchStatus}</div>
        </div>

      </div>
    </div>
  );
};

export default Header;
