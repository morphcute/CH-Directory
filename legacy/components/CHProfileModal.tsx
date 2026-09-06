import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  MessageCircle,
  Users,
  QrCode,
  Copy,
  Check,
  Shield,
  Lock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { CHPlayer } from '../types';
import { CapacityBar } from './CapacityBar';
import { StatusChip } from './StatusChip';
import { getAvatarColor, getUniqueInitials } from '../utils/avatarUtils';

// Facebook Official SVG Icon
const FacebookIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

interface CHProfileModalProps {
  player: CHPlayer | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenQR: (player: CHPlayer) => void;
}

export const CHProfileModal: React.FC<CHProfileModalProps> = ({
  player,
  isOpen,
  onClose,
  onOpenQR,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedFB, setCopiedFB] = useState(false);

  if (!isOpen || !player) return null;

  const registered = player.teamsRegistered || 0;
  const maxTeams = player.maxTeams || 16;
  const isFull = registered >= maxTeams;
  const regLink =
    player.resolvedFormUrl ||
    player.registrationFormLink ||
    player.tournamentPostingLink;

  const initials = getUniqueInitials(player.chNickname, player.fullName);
  const avatarColor = getAvatarColor(player.chNickname);

  const fbUrl =
    player.facebookProfileUrl ||
    `https://www.facebook.com/${player.chNickname.toLowerCase().replace(/[^a-z0-9]/g, '')}.mlbb`;

  const handleCopyFormLink = async () => {
    if (!regLink) return;
    try {
      await navigator.clipboard.writeText(regLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      window.prompt('Copy form link: Ctrl+C, Enter', regLink);
    }
  };

  const handleCopyFBUrl = async () => {
    try {
      await navigator.clipboard.writeText(fbUrl);
      setCopiedFB(true);
      setTimeout(() => setCopiedFB(false), 2000);
    } catch {
      window.prompt('Copy Facebook URL: Ctrl+C, Enter', fbUrl);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xl animate-fadeIn overflow-hidden"
      onClick={onClose}
    >
      {/* 3D Ambient Refraction Lights behind modal */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 bg-blue-600/12 rounded-full blur-3xl pointer-events-none" />

      {/* 3D Glassmorphic Modal Card - Compact Esports Style */}
      <div
        className="relative w-full max-w-[420px] glass-3d rounded-2xl overflow-hidden text-white flex flex-col no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden animate-scaleUp border border-white/15 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Specular Accent Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-[0_1px_8px_rgba(250,204,21,0.5)] shrink-0" />

        {/* Tactile Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 w-7.5 h-7.5 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg btn-3d-glass text-slate-300 hover:text-white transition-all z-20 cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Body: Compact, mathematically balanced to fit mobile perfectly */}
        <div className="p-3.5 sm:p-4 space-y-2.5 sm:space-y-3 no-scrollbar">
          {/* 1. Identity Header: Compact Avatar + Nickname + City */}
          <div className="flex items-center gap-2.5 sm:gap-3 pr-7">
            {/* Initials Avatar */}
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center text-xs sm:text-sm font-black shrink-0 tracking-wider shadow-sm ${avatarColor.bg} ${avatarColor.border} ${avatarColor.text}`}
            >
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <a
                  href={fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1 hover:opacity-95 transition-opacity"
                  title="Visit Facebook Profile"
                >
                  <h2 className="text-base sm:text-lg font-black text-white group-hover:text-amber-400 transition-colors leading-tight">
                    {player.chNickname}
                  </h2>
                  <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
                </a>

                <StatusChip
                  teamsRegistered={registered}
                  maxTeams={maxTeams}
                  size="sm"
                />
              </div>

              {/* Area & Full Name */}
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-0.5 flex-wrap font-medium leading-tight">
                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-slate-200">{player.area || 'Philippines'}</span>
                {player.fullName && (
                  <>
                    <span className="text-slate-600 font-normal">·</span>
                    <span className="text-slate-400 truncate max-w-[140px]">{player.fullName}</span>
                  </>
                )}
                {player.isCalabarzon && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                    CALABARZON
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Live Capacity: 16 discrete segmented blocks */}
          <div className="glass-inset-panel rounded-xl p-2.5 space-y-1.5">
            <CapacityBar
              teamsRegistered={registered}
              maxTeams={maxTeams}
              variant="modal-16-slot"
              showText={true}
            />
          </div>

          {/* 3. Primary Actions: Normal Sized Designed Buttons (PRL Automated Style) */}
          <div className="flex items-center gap-2">
            {/* Join Tournament Button */}
            {isFull ? (
              <div className="flex-1 h-9 sm:h-9.5 px-3 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-500 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed select-none">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Full (16/16)</span>
              </div>
            ) : regLink ? (
              <a
                href={regLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-3d-gold flex-1 h-9 sm:h-9.5 px-3 rounded-lg text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm no-underline cursor-pointer select-none"
                aria-label={`Join ${player.chNickname}'s tournament`}
              >
                <Sparkles className="w-3.5 h-3.5 fill-current text-slate-950" />
                <span>Join Form</span>
                <ExternalLink className="w-3 h-3 text-slate-950" />
              </a>
            ) : (
              <div className="flex-1 h-9 sm:h-9.5 px-2 rounded-lg bg-slate-900/60 border border-white/5 text-slate-400 text-xs flex items-center justify-center italic">
                Form pending
              </div>
            )}

            {/* Message on Facebook Button */}
            <a
              href={fbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-3d-blue flex-1 h-9 sm:h-9.5 px-3 rounded-lg text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm no-underline cursor-pointer select-none"
              title={`Message ${player.chNickname} on Facebook`}
            >
              <FacebookIcon className="w-3.5 h-3.5" />
              <span>Message</span>
              <ExternalLink className="w-3 h-3 text-blue-200" />
            </a>
          </div>

          {/* 4. Quick Tools: Normal Sized Compact Glass Buttons */}
          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
            {/* Show QR Code */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenQR(player);
              }}
              className="btn-3d-glass h-8 px-2 rounded-lg text-xs font-bold text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
              aria-label="Display tournament QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>QR Code</span>
            </button>

            {/* Copy Form Link */}
            <button
              type="button"
              onClick={handleCopyFormLink}
              disabled={!regLink}
              className="btn-3d-glass h-8 px-2 rounded-lg text-xs font-bold text-slate-200 flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Copy Google Form link"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Copy Form</span>
                </>
              )}
            </button>

            {/* Copy Facebook Profile URL */}
            <button
              type="button"
              onClick={handleCopyFBUrl}
              className="btn-3d-glass h-8 px-2 rounded-lg text-xs font-bold text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
              aria-label="Copy Facebook URL"
            >
              {copiedFB ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px]">Copied!</span>
                </>
              ) : (
                <>
                  <FacebookIcon className="w-3 h-3 text-[#1877F2]" />
                  <span>Copy FB</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
