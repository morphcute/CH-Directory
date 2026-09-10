import React from 'react';
import {
  ShieldCheck,
  Clock,
  Image as ImageIcon,
  Calendar,
  Upload,
  Sparkles,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { CommunityHeroLogo } from './CommunityHeroLogo';
import { HeaderBackgroundConfig } from '../types';
import { HEADER_PRESETS } from '../data/headerPresets';

interface CommunityHeroBannerProps {
  currentMonthName: string;
  currentYear: number;
  activeCount: number;
  totalCount: number;
  lastHourlySync: string;
  nextSyncCountdown: string;
  bgConfig: HeaderBackgroundConfig;
  onOpenAdmin: (tab?: 'banner' | 'nicknames' | 'responseSheets' | 'source') => void;
  activeTabName: string;
  isStaff?: boolean;
  onOpenStaffLogin?: () => void;
}

export const CommunityHeroBanner: React.FC<CommunityHeroBannerProps> = ({
  currentMonthName,
  currentYear,
  activeCount,
  totalCount,
  lastHourlySync,
  nextSyncCountdown,
  bgConfig,
  onOpenAdmin,
  activeTabName,
  isStaff = false,
  onOpenStaffLogin,
}) => {
  // Determine banner image url
  let bannerImageUrl = '';
  if (bgConfig.type === 'custom' && bgConfig.customUrl) {
    bannerImageUrl = bgConfig.customUrl;
  } else {
    const preset =
      HEADER_PRESETS.find((p) => p.id === bgConfig.presetId) || HEADER_PRESETS[0];
    bannerImageUrl = preset.imageUrl;
  }

  // Height class based on config (Google Forms style)
  const heightClass =
    bgConfig.bannerHeight === 'compact'
      ? 'h-36 sm:h-44 md:h-52'
      : bgConfig.bannerHeight === 'tall'
      ? 'h-56 sm:h-72 md:h-80'
      : 'h-44 sm:h-56 md:h-64'; // standard default

  const objectFit = bgConfig.bannerFit === 'contain' ? 'object-contain' : 'object-cover';
  const overlayDarkness = bgConfig.overlayDarkness ?? 0.15;

  return (
    <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
      {/* Outer Card Container styled like a modern, ultra-professional Google Form header card */}
      <div className="bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-md">
        
        {/* ========================================================= */}
        {/* 1. GOOGLE FORMS STYLE: TOP PICTURE BANNER UPLOADED BY ADMIN */}
        {/* ========================================================= */}
        <div className={`relative w-full ${heightClass} bg-slate-950 overflow-hidden group`}>
          {/* The actual image banner */}
          <img
            src={bannerImageUrl}
            alt="MLBB Community Heroes Tournament Banner"
            className={`w-full h-full ${objectFit} object-center transition-transform duration-500 group-hover:scale-[1.01]`}
            referrerPolicy="no-referrer"
          />

          {/* Optional subtle contrast overlay if configured by admin */}
          {overlayDarkness > 0 && (
            <div
              className="absolute inset-0 bg-slate-950 pointer-events-none transition-opacity"
              style={{ opacity: overlayDarkness }}
            />
          )}

          {/* Subtle top & bottom edge gradients for seamless framing */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

          {/* Top-Right Action Pill: Admin / Staff controls ONLY if isStaff */}
          {isStaff ? (
            <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10 flex items-center gap-2">
              <button
                onClick={() => onOpenAdmin('banner')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-amber-500 text-slate-200 hover:text-slate-950 border border-slate-700/80 hover:border-amber-400 text-xs font-bold transition-all shadow-lg backdrop-blur-md active:scale-95"
                title="Upload new banner picture or choose theme (Google Forms style)"
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-400 group-hover:text-slate-950" />
                <span>Change Header Picture</span>
              </button>

              <button
                onClick={() => onOpenAdmin('nicknames')}
                className="inline-flex items-center gap-1 px-3 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-400 border border-amber-500/40 text-xs font-bold transition-all shadow-lg backdrop-blur-md"
                title="Open Admin Control Center"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            </div>
          ) : (
            <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10">
              <span className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 text-[11px] font-bold backdrop-blur-md flex items-center gap-1.5 shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Official Player Registration</span>
              </span>
            </div>
          )}

          {/* Subtle Banner Tag */}
          <div className="absolute bottom-3 left-4 z-10 hidden sm:flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-700/80 text-[11px] font-bold text-slate-300 backdrop-blur-md flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Official Tournament Banner
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. FORM HEADER CONTENT CARD (Directly below the picture banner) */}
        {/* ========================================================= */}
        <div className="p-5 sm:p-7 md:p-8 bg-slate-900/95 border-t border-slate-800 flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            
            {/* Left: Community Hero Emblem + Big Title + Motto */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left">
              <div className="shrink-0 transform hover:scale-105 transition-transform duration-300">
                <CommunityHeroLogo size="md" />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
                    Mobile Legends: Bang Bang
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-bold">
                    Community Heroes
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                  Tournament Registration Directory
                </h1>

                {/* Slogan matching official Mobile Legends CH banner */}
                <p className="text-xs sm:text-sm font-black tracking-widest text-amber-400 uppercase flex items-center justify-center sm:justify-start gap-2">
                  <span>ONE GAME.</span>
                  <span className="text-slate-500">•</span>
                  <span>ONE NATION.</span>
                  <span className="text-slate-500">•</span>
                  <span>ONE COMMUNITY.</span>
                </p>

                <p className="text-xs text-slate-400 max-w-2xl pt-0.5 leading-relaxed">
                  Official community player directory for joining MLBB tournaments. Select your Community Head below and join while slots are open.
                </p>
              </div>
            </div>

            {/* Right: Live Sync Badge & Fast Admin Buttons */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-center lg:items-end gap-3 w-full lg:w-auto shrink-0">
              {/* Live Status Pill */}
              <div className="w-full sm:w-auto bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between sm:justify-end gap-4 shadow-inner">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Visible Community Heads
                  </p>
                  <p className="text-lg font-mono font-black text-amber-400">
                    {activeCount} <span className="text-xs text-slate-500 font-sans">/ {totalCount} displayed</span>
                  </p>
                </div>

                <div className="h-7 w-px bg-slate-800" />

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Hourly Auto-Check
                  </p>
                  <p className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>In {nextSyncCountdown}</span>
                  </p>
                </div>
              </div>

              {/* Quick Actions / Player Status Bar */}
              <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 w-full">
                {isStaff ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenAdmin('banner')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload Picture</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenAdmin('responseSheets')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                      <span>Slots (16/16)</span>
                    </button>
                  </>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] font-medium text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span>Click <strong>Join Tournament</strong> to register your team</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Metabar: Active Google Sheet Month Tab indicator */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 font-mono">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Monthly Cycle: {currentMonthName} {currentYear}</span>
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-300 hidden sm:inline">
                Sheet Tab: <strong className="text-white font-mono">{activeTabName}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Auto-detection: Hourly Column G Check
              </span>
              <span>•</span>
              <span className="text-slate-400">
                Last checked: <strong className="text-slate-300">{lastHourlySync}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
