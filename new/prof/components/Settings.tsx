import React, { useState } from 'react';

const Toggle = ({ label, active, onToggle }: { label: string, active: boolean, onToggle: () => void }) => (
  <div 
    onClick={onToggle}
    className="flex items-center justify-between p-4 bg-surface border border-border rounded-2xl active:bg-surfaceHighlight transition-colors cursor-pointer"
  >
    <span className="font-black text-sm uppercase tracking-wide text-zinc-300">{label}</span>
    
    <div className={`
      w-14 h-8 rounded-full border-2 p-1 transition-all duration-200 ease-out flex items-center
      ${active ? 'bg-white border-white' : 'bg-transparent border-zinc-700'}
    `}>
      <div className={`
        w-5 h-5 rounded-full shadow-sm transition-all duration-200
        ${active ? 'translate-x-6 bg-black' : 'translate-x-0 bg-zinc-700'}
      `} />
    </div>
  </div>
);

export const SettingsSection: React.FC = () => {
  const [isDark, setIsDark] = useState(true);
  const [is18Plus, setIs18Plus] = useState(false);

  return (
    <div className="w-full mt-8 mb-12">
      <h2 className="font-black text-xl italic uppercase tracking-tighter mb-4 px-2">Preferences</h2>
      <div className="flex flex-col gap-2">
        <Toggle label="App Theme: Dark" active={isDark} onToggle={() => setIsDark(!isDark)} />
        <Toggle label="Mode: 18+" active={is18Plus} onToggle={() => setIs18Plus(!is18Plus)} />
      </div>
    </div>
  );
};