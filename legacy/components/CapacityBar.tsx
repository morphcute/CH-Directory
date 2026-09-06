import React from 'react';

export interface CapacityBarProps {
  teamsRegistered: number;
  maxTeams?: number;
  variant?: 'compact-chip' | 'mini-bar' | 'modal-16-slot';
  size?: 'sm' | 'md';
  className?: string;
  showText?: boolean;
}

export const CapacityBar: React.FC<CapacityBarProps> = ({
  teamsRegistered,
  maxTeams = 16,
  variant = 'compact-chip',
  size = 'md',
  className = '',
  showText = true,
}) => {
  const registered = Math.min(Math.max(0, teamsRegistered), maxTeams);
  const slotsAvailable = Math.max(0, maxTeams - registered);
  const isFull = slotsAvailable === 0 || registered >= maxTeams;
  const isAlmostFull = !isFull && slotsAvailable <= maxTeams / 2;

  // Color scheme based on availability:
  // Green when >50% available (> 8 available)
  // Amber when 1-50% available (1-8 available)
  // Red "Full" when 0 available
  const colorScheme = isFull
    ? {
        text: 'text-rose-400',
        bg: 'bg-rose-500/15',
        border: 'border-rose-500/35',
        bar: 'bg-rose-500',
        blockFilled: 'bg-gradient-to-b from-rose-400 to-rose-600 border-t border-rose-300 shadow-[0_2px_6px_rgba(244,63,94,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]',
        blockEmpty: 'bg-slate-900/80 border border-slate-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]',
        glow: 'text-rose-400',
      }
    : isAlmostFull
    ? {
        text: 'text-amber-300',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/35',
        bar: 'bg-amber-400',
        blockFilled: 'bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 border-t border-yellow-200 shadow-[0_2px_8px_rgba(245,158,11,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)]',
        blockEmpty: 'bg-slate-900/80 border border-slate-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]',
        glow: 'text-amber-300',
      }
    : {
        text: 'text-emerald-300',
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/35',
        bar: 'bg-emerald-400',
        blockFilled: 'bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-600 border-t border-emerald-200 shadow-[0_2px_8px_rgba(16,185,129,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)]',
        blockEmpty: 'bg-slate-900/80 border border-slate-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]',
        glow: 'text-emerald-300',
      };

  // Compact Chip variant (used in row or table)
  if (variant === 'compact-chip') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono ${colorScheme.bg} ${colorScheme.border} ${className}`}
        title={`${registered} of ${maxTeams} slots taken (${slotsAvailable} remaining)`}
      >
        <span className={`text-xs font-bold ${colorScheme.text}`}>
          {isFull ? (
            <span className="font-sans font-extrabold uppercase tracking-wide">Full (16/16)</span>
          ) : (
            `${registered}/${maxTeams} slots`
          )}
        </span>
      </div>
    );
  }

  // Mini-bar variant (segmented preview inside row)
  if (variant === 'mini-bar') {
    return (
      <div className={`space-y-1 ${className}`}>
        {showText && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Capacity</span>
            <span className={`font-mono font-bold ${colorScheme.text}`}>
              {isFull ? 'Full (16/16)' : `${registered}/${maxTeams} slots`}
            </span>
          </div>
        )}
        <div className="flex gap-0.5 h-1.5 w-full bg-slate-950/80 p-0.5 rounded-full border border-slate-800 overflow-hidden">
          {Array.from({ length: maxTeams }).map((_, idx) => (
            <div
              key={idx}
              className={`flex-1 h-full rounded-xs transition-colors duration-200 ${
                idx < registered ? colorScheme.bar : 'bg-slate-800/60'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Modal 16-slot segmented progress bar
  // "Keep one line 'X of 16 Teams Registered' plus a segmented 16-slot progress bar (filled blocks per registered team) so empty/partial states look intentional."
  return (
    <div className={`space-y-1.5 sm:space-y-2 w-full ${className}`}>
      {showText && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium">
            <span className={`font-bold ${colorScheme.text}`}>{registered}</span> of{' '}
            <span className="font-bold text-white">{maxTeams}</span> teams registered
          </span>
          <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-md border ${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}`}>
            {isFull ? 'Tournament Full' : `${slotsAvailable} slots left`}
          </span>
        </div>
      )}

      {/* 16 discrete segmented blocks - compact esports style */}
      <div
        className="grid grid-cols-8 sm:grid-cols-16 gap-1 p-1.5 rounded-lg sm:rounded-xl bg-slate-950/90 border border-slate-800/90 shadow-inner"
        role="progressbar"
        aria-valuenow={registered}
        aria-valuemin={0}
        aria-valuemax={maxTeams}
        aria-label={`${registered} of ${maxTeams} teams registered`}
      >
        {Array.from({ length: maxTeams }).map((_, index) => {
          const isFilled = index < registered;
          return (
            <div
              key={index}
              className={`h-4.5 sm:h-5.5 rounded sm:rounded-md border flex items-center justify-center text-[9px] sm:text-[10px] font-mono transition-all duration-150 ${
                isFilled
                  ? colorScheme.blockFilled + ' text-slate-950 font-black'
                  : colorScheme.blockEmpty + ' text-slate-600 font-semibold'
              }`}
              title={`Slot #${index + 1}: ${isFilled ? 'Registered' : 'Available'}`}
            >
              {index + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
};
