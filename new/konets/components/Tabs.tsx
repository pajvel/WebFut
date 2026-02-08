
import React from 'react';
import { MatchTab } from '../types';

interface TabsProps {
  activeTab: MatchTab;
  onTabChange: (tab: MatchTab) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = Object.values(MatchTab);

  return (
    <div className="flex bg-[var(--bg-surface)] border-b-2 border-[var(--border-main)]">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`flex-1 py-4 text-sm font-black italic tracking-tight transition-all
            ${activeTab === tab 
              ? 'bg-[var(--bg-contrast)] text-[var(--text-contrast)]' 
              : 'bg-[var(--bg-surface)] text-[var(--text-main)] opacity-50 active:opacity-100'}
          `}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
