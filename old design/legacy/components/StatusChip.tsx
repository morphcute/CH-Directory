import React from 'react';

export type StatusType = 'open' | 'almost_full' | 'full';

export interface StatusChipProps {
  status?: StatusType;
  teamsRegistered?: number;
  maxTeams?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status: manualStatus,
  teamsRegistered = 0,
  maxTeams = 16,
  size = 'md',
  className = '',
}) => {
  // Compute status if not manually passed
  let resolvedStatus: StatusType = manualStatus || 'open';
  if (!manualStatus) {
    const slotsAvailable = Math.max(0, maxTeams - teamsRegistered);
    if (slotsAvailable === 0 || teamsRegistered >= maxTeams) {
      resolvedStatus = 'full';
    } else if (slotsAvailable <= maxTeams / 2) {
      resolvedStatus = 'almost_full';
    } else {
      resolvedStatus = 'open';
    }
  }

  const configs = {
    open: {
      label: 'Open',
      styles: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      dot: 'bg-emerald-400',
    },
    almost_full: {
      label: 'Almost full',
      styles: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      dot: 'bg-amber-400',
    },
    full: {
      label: 'Full',
      styles: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      dot: 'bg-rose-400',
    },
  };

  const config = configs[resolvedStatus] || configs.open;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1.5 font-bold',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-bold',
    lg: 'text-sm px-3 py-1.5 gap-2 font-extrabold',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-wide whitespace-nowrap select-none transition-colors ${config.styles} ${sizeClasses[size]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} shrink-0`} />
      <span>{config.label}</span>
    </span>
  );
};
