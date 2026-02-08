
import React from 'react';

interface HeaderProps {
  onBack: () => void;
  onThemeClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onBack, onThemeClick }) => {
  return (
    <div className="flex-none bg-[var(--bg-surface)] p-4 border-b-2 border-[var(--border-main)] z-20">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 border-2 border-[var(--border-main)] bg-[var(--bg-surface)] active:scale-90"
          style={{ boxShadow: '4px 4px 0px 0px var(--border-main)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 text-center">
          <h1 className="font-black italic text-xl tracking-tight leading-none uppercase text-[var(--text-main)]">
            WEBFUT
          </h1>
        </div>

        <button
          onClick={onThemeClick}
          className="flex items-center justify-center w-10 h-10 border-2 border-[var(--border-main)] bg-[var(--bg-surface)] active:scale-90"
          style={{ boxShadow: '4px 4px 0px 0px var(--border-main)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
             <circle cx="12" cy="12" r="5" />
             <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Header;
