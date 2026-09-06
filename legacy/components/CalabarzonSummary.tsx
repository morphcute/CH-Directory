import React from 'react';
import {
  MapPin,
  CheckCircle2,
  Users,
  Search,
  Filter,
  Ban,
  Clock,
  Sparkles,
} from 'lucide-react';
import { CHPlayer } from '../types';

interface CHDirectoryFiltersProps {
  players: CHPlayer[];
  selectedArea: string;
  onSelectArea: (area: string) => void;
  availabilityFilter: 'ALL' | 'OPEN' | 'FULL';
  onSelectAvailabilityFilter: (filter: 'ALL' | 'OPEN' | 'FULL') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const CHDirectoryFilters: React.FC<CHDirectoryFiltersProps> = ({
  players,
  selectedArea,
  onSelectArea,
  availabilityFilter,
  onSelectAvailabilityFilter,
  searchQuery,
  onSearchChange,
}) => {
  // Extract unique areas from players
  const areaCounts: Record<string, { total: number; open: number; full: number }> = {};

  players.forEach((p) => {
    const area = p.area || 'Other';
    if (!areaCounts[area]) {
      areaCounts[area] = { total: 0, open: 0, full: 0 };
    }
    areaCounts[area].total++;
    if (p.teamsRegistered >= p.maxTeams) {
      areaCounts[area].full++;
    } else {
      areaCounts[area].open++;
    }
  });

  const uniqueAreas = Object.keys(areaCounts);
  const totalTournaments = players.length;
  const totalOpen = players.filter((p) => p.teamsRegistered < p.maxTeams).length;
  const totalFull = players.filter((p) => p.teamsRegistered >= p.maxTeams).length;

  return (
    <div className="space-y-3.5">
      {/* Quick Area Filter Chips (Horizontal Scrollable) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => onSelectArea('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
            selectedArea === 'ALL'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-1 ring-amber-400'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>All Areas ({totalTournaments})</span>
        </button>

        {uniqueAreas.map((area) => {
          const stats = areaCounts[area];
          const isSelected = selectedArea === area;
          return (
            <button
              key={area}
              type="button"
              onClick={() => onSelectArea(area)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-1 ring-amber-400 font-bold'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              <MapPin className={`w-3 h-3 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`} />
              <span>{area}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {stats.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 backdrop-blur-md">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search CH Nickname (e.g. Lester, Meg, Frank, Tigz) or Area..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-100 placeholder:text-slate-500 font-medium"
          />
        </div>

        {/* Capacity / Join Availability Filter Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => onSelectAvailabilityFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              availabilityFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({totalTournaments})
          </button>
          <button
            type="button"
            onClick={() => onSelectAvailabilityFilter('OPEN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              availabilityFilter === 'OPEN'
                ? 'bg-emerald-500 text-slate-950 shadow-xs font-bold'
                : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Open ({totalOpen})</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectAvailabilityFilter('FULL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              availabilityFilter === 'FULL'
                ? 'bg-red-500 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-red-400'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Full 16/16 ({totalFull})</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const CalabarzonSummary = CHDirectoryFilters;
