import React from 'react';
import { Calendar, ShieldCheck, Clock, CheckCircle2, User } from 'lucide-react';

interface HeaderProps {
  currentMonthName: string;
  currentYear: number;
  activeCount: number;
  totalCount: number;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  lastHourlySync: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentMonthName,
  currentYear,
  activeCount,
  totalCount,
  isAdmin,
  onOpenAdmin,
  lastHourlySync,
}) => {
  return (
    <header className="bg-[#0F172A] border-b-4 border-[#3B82F6] text-white px-4 sm:px-8 py-3.5 sm:py-4 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-[#3B82F6] rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-xs shrink-0">
            CH
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                CH Tournament Directory
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/80 text-blue-400 border border-blue-800/60">
                Monthly Auto-Detect
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Community Head tournament directory with hourly response sheet capacity detection
            </p>
          </div>
        </div>

        {/* System Status & Admin Control */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap self-start md:self-auto">
          {/* Hourly Auto-Detection Status */}
          <div className="hidden sm:flex flex-col items-start md:items-end">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" />
              Hourly Sync
            </span>
            <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {lastHourlySync || 'Active'}
            </span>
          </div>

          <div className="h-9 w-[1px] bg-slate-700 hidden sm:block"></div>

          {/* Current Month Reference */}
          <div className="text-left md:text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              Current Cycle
            </p>
            <p className="text-sm sm:text-base font-mono font-bold text-[#3B82F6]">
              {currentMonthName.toUpperCase()} {currentYear}
            </p>
          </div>

          <div className="h-9 w-[1px] bg-slate-700 hidden sm:block"></div>

          {/* Directory Count */}
          <div className="bg-slate-800/90 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <span className="text-blue-400 font-bold">{activeCount}</span>
            <span className="text-slate-400">/ {totalCount} CHs Displayed</span>
          </div>

          {/* Admin Control Button */}
          <button
            onClick={onOpenAdmin}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs border ${
              isAdmin
                ? 'bg-blue-600 text-white border-blue-400 hover:bg-blue-500 ring-2 ring-blue-400/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Open Admin Panel to select CH Nicknames and configure response sheets"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Admin Control</span>
          </button>
        </div>
      </div>
    </header>
  );
};
