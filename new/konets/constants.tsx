
import React from 'react';
import { AppTheme } from './types';

export const BACK_ARROW_SVG = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 12H5" stroke="currentColor" strokeWidth="3" strokeLinecap="square"/>
    <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="3" strokeLinecap="square"/>
  </svg>
);

export const THEME_ICON_SVG = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5"/>
    <path d="M12 3V21" stroke="currentColor" strokeWidth="2.5"/>
    <path d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21" fill="currentColor"/>
  </svg>
);

export const CROWN_SVG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5ZM19 19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V18H19V19Z" />
  </svg>
);

export const ICON_GOAL = (
  <div className="w-6 h-6 bg-[var(--bg-contrast)] flex items-center justify-center rounded-sm">
     <div className="w-3 h-3 bg-[var(--bg-surface)] rounded-full"></div>
  </div>
);

export const ICON_OWN_GOAL = (
  <div className="w-6 h-6 bg-red-600 flex items-center justify-center rounded-sm">
     <div className="w-3 h-3 bg-white rounded-full"></div>
  </div>
);

export const THEMES: AppTheme[] = [
  {
    id: 'real',
    name: 'REAL',
    colors: {
      bgPage: '#ffffff',
      bgSurface: '#f8f8f8',
      bgContrast: '#000000',
      textMain: '#000000',
      textContrast: '#ffffff',
      borderMain: '#000000',
    }
  },
  {
    id: 'juve',
    name: 'JUVE',
    colors: {
      bgPage: '#000000',
      bgSurface: '#121212',
      bgContrast: '#ffffff',
      textMain: '#ffffff',
      textContrast: '#000000',
      borderMain: '#ffffff',
    }
  },
  {
    id: 'miami',
    name: 'MIAMI',
    colors: {
      bgPage: '#ffffff',
      bgSurface: '#fff0f5',
      bgContrast: '#F5A9C5',
      textMain: '#000000',
      textContrast: '#000000',
      borderMain: '#F5A9C5',
    }
  },
  {
    id: 'shinnik',
    name: 'SHINNIK',
    colors: {
      bgPage: '#000000',
      bgSurface: '#050a14',
      bgContrast: '#0B2C6B',
      textMain: '#ffffff',
      textContrast: '#ffffff',
      borderMain: '#0B2C6B',
    }
  },
  {
    id: 'barca',
    name: 'BARCA',
    colors: {
      bgPage: '#0f172a',
      bgSurface: '#1e293b',
      bgContrast: '#A50034',
      textMain: '#ffffff',
      textContrast: '#ffffff',
      borderMain: '#A50034',
    }
  },
  {
    id: 'city',
    name: 'CITY',
    colors: {
      bgPage: '#ffffff',
      bgSurface: '#f0f9ff',
      bgContrast: '#6CABDD',
      textMain: '#000000',
      textContrast: '#000000',
      borderMain: '#6CABDD',
    }
  },
  {
    id: 'psg',
    name: 'PSG',
    colors: {
      bgPage: '#ffffff',
      bgSurface: '#f5f3ff',
      bgContrast: '#3B3F8C',
      textMain: '#000000',
      textContrast: '#ffffff',
      borderMain: '#3B3F8C',
    }
  },
  {
    id: 'bvb',
    name: 'BVB',
    colors: {
      bgPage: '#000000',
      bgSurface: '#18181b',
      bgContrast: '#FDE100',
      textMain: '#FDE100',
      textContrast: '#000000',
      borderMain: '#FDE100',
    }
  },
  {
    id: 'loko',
    name: 'LOKO',
    colors: {
      bgPage: '#ffffff',
      bgSurface: '#f0fdf4',
      bgContrast: '#22c55e',
      textMain: '#14532d',
      textContrast: '#ffffff',
      borderMain: '#22c55e',
    }
  }
];
