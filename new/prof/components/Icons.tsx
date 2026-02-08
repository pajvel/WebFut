import React from 'react';
import { ArrowLeft, Edit2, Trophy, ChevronRight, Share2, Star, Shield, Zap, TrendingUp, TrendingDown, LayoutGrid, Palette } from 'lucide-react';

// Unified icon style: Thick strokes, assertive
export const BackIcon = () => <ArrowLeft strokeWidth={3} size={24} />;
export const MenuIcon = () => <LayoutGrid strokeWidth={3} size={24} />;
export const PaletteIcon = () => <Palette strokeWidth={3} size={24} />;
export const EditIcon = () => <Edit2 strokeWidth={3} size={20} />;
export const LeaderboardIcon = () => <Trophy strokeWidth={3} size={20} />;
export const ArrowRightIcon = () => <ChevronRight strokeWidth={3} size={24} />;
export const ShareIcon = () => <Share2 strokeWidth={3} size={20} />;
export const StarIcon = () => <Star strokeWidth={3} size={16} fill="currentColor" />;
export const ShieldIcon = () => <Shield strokeWidth={3} size={16} />;
export const ZapIcon = () => <Zap strokeWidth={3} size={16} />;
export const TrendUpIcon = () => <TrendingUp strokeWidth={4} size={20} />;
export const TrendDownIcon = () => <TrendingDown strokeWidth={4} size={20} />;