
import React from 'react';

export const SectionHeader: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="flex justify-between items-center mb-6 border-b border-webfut-border pb-4">
    <h1 className="text-4xl text-900 uppercase tracking-tighter italic">{title}</h1>
    <div className="flex gap-2">{children}</div>
  </div>
);

export const ActionButton: React.FC<{ 
  onClick?: () => void; 
  variant?: 'primary' | 'danger' | 'outline' | 'ghost'; 
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, variant = 'primary', children, className = '' }) => {
  const styles = {
    primary: 'bg-webfut-pink text-black hover:opacity-90',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border-2 border-white text-white hover:bg-white hover:text-black',
    ghost: 'border border-webfut-border text-white hover:bg-webfut-gray'
  };
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 text-900 uppercase text-sm tracking-tight transition-all duration-200 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-700 text-xs uppercase mb-1 text-zinc-400">{label}</label>}
    <input 
      {...props}
      className="w-full bg-webfut-gray border border-webfut-border text-white px-3 py-2 text-400 focus:outline-none focus:border-webfut-pink"
    />
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'bg-webfut-border' }) => (
  <span className={`${color} text-[10px] text-900 uppercase px-1.5 py-0.5 rounded-sm`}>
    {children}
  </span>
);

export const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <div className="group relative inline-block">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-zinc-800 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-50">
      {text}
    </div>
  </div>
);
