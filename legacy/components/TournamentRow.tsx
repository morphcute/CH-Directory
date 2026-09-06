import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  QrCode,
  Copy,
  Check,
  Share2,
  ExternalLink,
  MessageCircle,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { CHPlayer } from '../types';
import { StatusChip } from './StatusChip';
import { CapacityBar } from './CapacityBar';
import { getAvatarColor, getUniqueInitials } from '../utils/avatarUtils';

// Official Facebook Brand SVG Icon
const FacebookIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export interface TournamentRowProps {
  player: CHPlayer;
  onOpenProfile: (player: CHPlayer) => void;
  onOpenQR: (player: CHPlayer) => void;
  onJoinSuccess?: (player: CHPlayer) => void;
}

export const TournamentRow: React.FC<TournamentRowProps> = ({
  player,
  onOpenProfile,
  onOpenQR,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const registered = player.teamsRegistered || 0;
  const maxTeams = player.maxTeams || 16;
  const slotsAvailable = Math.max(0, maxTeams - registered);
  const isFull = slotsAvailable === 0 || registered >= maxTeams;
  const isAlmostFull = !isFull && slotsAvailable <= maxTeams / 2;

  const initials = getUniqueInitials(player.chNickname, player.fullName);
  const color = getAvatarColor(player.chNickname);

  const fbUrl =
    player.facebookProfileUrl ||
    `https://www.facebook.com/${player.chNickname.toLowerCase().replace(/[^a-z0-9]/g, '')}.mlbb`;

  const link =
    player.resolvedFormUrl ||
    player.registrationFormLink ||
    player.tournamentPostingLink ||
    '';

  // Close overflow menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleCopyLink = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAction(label);
      setTimeout(() => {
        setCopiedAction(null);
        setIsMenuOpen(false);
      }, 1200);
    } catch {
      // Fallback prompt
      window.prompt('Copy to clipboard: Ctrl+C, Enter', text);
      setIsMenuOpen(false);
    }
  };

  return (
    <div
      onClick={() => onOpenProfile(player)}
      className={`group relative rounded-xl sm:rounded-2xl border transition-all duration-150 cursor-pointer ${
        isMenuOpen ? 'z-40' : 'z-10 hover:z-20'
      } ${
        isFull
          ? 'bg-[#0e121e]/80 border-slate-800/60 opacity-85 hover:opacity-100 hover:border-slate-700/80 hover:bg-[#121727]'
          : 'bg-[#101626]/85 backdrop-blur-xl border-white/[0.08] hover:border-amber-400/50 hover:bg-[#131b2e] shadow-sm hover:shadow-md'
      }`}
    >
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-3.5 w-full">
        {/* Left Side: Avatar + Details in spacious block */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
          {/* Compact Initials Avatar */}
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center shrink-0 font-extrabold text-xs sm:text-sm tracking-wider shadow-sm transition-transform group-hover:scale-105 ${color.bg} ${color.border} ${color.text}`}
            title={`Community Head: ${player.chNickname}`}
          >
            {initials}
          </div>

          {/* Identity: Nickname & Status (Row 1) · Area & Slots (Row 2) */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="font-extrabold text-white text-sm sm:text-base group-hover:text-amber-400 transition-colors">
                {player.chNickname}
              </span>

              {/* Facebook icon link */}
              {player.facebookProfileUrl && (
                <a
                  href={fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#1877F2] hover:text-blue-400 p-0.5 -m-0.5 rounded shrink-0 cursor-pointer transition-transform hover:scale-110"
                  title={`Open ${player.chNickname}'s Facebook profile`}
                  aria-label={`Open ${player.chNickname}'s Facebook profile`}
                >
                  <FacebookIcon className="w-3.5 h-3.5" />
                </a>
              )}

              {/* Status Chip */}
              <StatusChip
                teamsRegistered={registered}
                maxTeams={maxTeams}
                size="sm"
                className="shrink-0"
              />
            </div>

            {/* Subtitle: Area · Registered Slots */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium leading-tight mt-0.5">
              <MapPin className="w-3 h-3 text-amber-400/80 shrink-0" />
              <span className="text-slate-300 truncate">
                {player.area || 'Philippines'}
              </span>
              <span className="text-slate-600 font-normal">·</span>
              <span
                className={`font-mono font-bold shrink-0 ${
                  isFull
                    ? 'text-rose-400'
                    : isAlmostFull
                    ? 'text-amber-300'
                    : 'text-emerald-400'
                }`}
              >
                {registered}/{maxTeams} slots
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: Capacity Badge + Menu + Click Indicator */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Live Capacity Bar Indicator */}
          <CapacityBar
            teamsRegistered={registered}
            maxTeams={maxTeams}
            variant="compact-chip"
          />

          {/* Action: "⋯" Quick Options Dropdown */}
          <div className={`relative shrink-0 ${isMenuOpen ? 'z-50' : ''}`} ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((prev) => !prev);
              }}
              className="btn-3d-glass w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-lg text-slate-300 hover:text-white cursor-pointer shrink-0"
              aria-label={`More options for ${player.chNickname}`}
              aria-haspopup="true"
              aria-expanded={isMenuOpen}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {/* Overflow Dropdown */}
            {isMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1.5 w-52 max-w-[calc(100vw-32px)] rounded-xl bg-[#13192a] border border-white/20 shadow-[0_16px_40px_rgba(0,0,0,0.95)] py-1 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-3xl"
              >
                {/* Direct Join Link if available */}
                {link && !isFull && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full min-h-[38px] px-3 py-2 text-left text-xs text-amber-300 hover:bg-slate-800/90 flex items-center gap-2 transition-colors cursor-pointer font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    <span>Join Tournament Form</span>
                  </a>
                )}

                {/* Direct Message on Facebook */}
                <a
                  href={fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full min-h-[38px] px-3 py-2 text-left text-xs text-blue-300 hover:bg-slate-800/90 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                  <span>Message on Facebook</span>
                </a>

                {/* QR Code Option */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenQR(player);
                  }}
                  className="w-full min-h-[38px] px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800/90 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>View QR Code</span>
                </button>

                {/* Copy Form Link */}
                {link && (
                  <button
                    type="button"
                    onClick={() => handleCopyLink(link, 'form')}
                    className="w-full min-h-[38px] px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800/90 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Form Link</span>
                    </div>
                    {copiedAction === 'form' && (
                      <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copied
                      </span>
                    )}
                  </button>
                )}

                {/* Copy Facebook Profile URL */}
                {player.facebookProfileUrl && (
                  <button
                    type="button"
                    onClick={() => handleCopyLink(player.facebookProfileUrl, 'fb')}
                    className="w-full min-h-[38px] px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800/90 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
                      <span>Copy Facebook URL</span>
                    </div>
                    {copiedAction === 'fb' && (
                      <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copied
                      </span>
                    )}
                  </button>
                )}

                {/* View Details */}
                <div className="border-t border-slate-800 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenProfile(player);
                  }}
                  className="w-full min-h-[38px] px-3 py-2 text-left text-xs text-amber-400 hover:bg-slate-800/90 flex items-center gap-2 font-medium transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>View Details & Stats</span>
                </button>
              </div>
            )}
          </div>

          {/* Clickable indicator chevron */}
          <div className="w-6 h-6 flex items-center justify-center text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
