
import React from 'react';
import { MOCK_USER } from '../constants';

interface HeaderProps {
  onThemeClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onThemeClick }) => {
  const handleProfileClick = () => {
    console.log('Navigate to profile');
  };

  return (
    <div className="sticky top-0 flex-none bg-[var(--bg-surface)] p-4 border-b-2 border-[var(--border-main)] z-40 transition-colors duration-300">
      <div className="flex items-center justify-between">
        {/* Left: Theme Switcher */}
        <button
          onClick={onThemeClick}
          className="w-10 h-10 border-2 border-[var(--border-main)] flex items-center justify-center transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
          style={{ boxShadow: '4px 4px 0px 0px var(--border-main)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/>
            <path d="M12 3v18"/>
            <path d="M12 12h9"/>
          </svg>
        </button>

        <div className="flex-1 text-center">
          <h1 className="font-black italic text-xl tracking-tight leading-none uppercase text-[var(--text-main)]">
            WEBFUT
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* User Avatar */}
          <button
            onClick={handleProfileClick}
            className="w-10 h-10 border-2 border-[var(--border-main)] overflow-hidden transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            style={{ boxShadow: '4px 4px 0px 0px var(--border-main)' }}
          >
            <img
              src={MOCK_USER.avatar}
              alt="User avatar"
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;