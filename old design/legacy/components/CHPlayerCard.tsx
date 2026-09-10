import React, { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  QrCode,
  CheckCircle2,
  Ban,
  Users,
  Sparkles,
  Shield,
  MessageCircle,
} from 'lucide-react';
import { CHPlayer } from '../types';

interface CHPlayerCardProps {
  player: CHPlayer;
  onOpenQR: (player: CHPlayer) => void;
}

export const CHPlayerCard: React.FC<CHPlayerCardProps> = ({ player, onOpenQR }) => {
  const [copied, setCopied] = useState(false);

  const regLink = player.registrationFormLink || player.tournamentPostingLink;
  const isCapacityFull = player.teamsRegistered >= player.maxTeams;
  const isFormClosed = player.formStatus === 'closed';
  const isFullOrClosed = isCapacityFull || isFormClosed || player.formStatus === 'full';
  const slotsLeft = Math.max(0, player.maxTeams - player.teamsRegistered);
  const percentFilled = Math.min(100, Math.round((player.teamsRegistered / player.maxTeams) * 100));

  const handleCopyLink = async () => {
    if (!regLink) return;
    try {
      await navigator.clipboard.writeText(regLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-300 p-5 flex flex-col justify-between overflow-hidden shadow-sm ${
        isFullOrClosed
          ? 'bg-slate-900/95 border-slate-800 text-slate-200'
          : 'bg-slate-900 border-amber-500/40 hover:border-yellow-400 hover:shadow-lg hover:shadow-amber-500/10 text-white'
      }`}
    >
      {/* Top Gold Foil Accent Line */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
          isFullOrClosed ? 'from-slate-700 via-slate-600 to-slate-700' : 'from-amber-500 via-yellow-400 to-amber-500'
        }`}
      />

      <div>
        {/* 1. CH Avatar & Nickname (Prominent & Clean) */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Custom CH Picture or Shield Badge */}
            {player.avatarUrl ? (
              <div className="relative shrink-0">
                <img
                  src={player.avatarUrl}
                  alt={player.chNickname}
                  className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-md shadow-amber-500/20"
                />
                {player.active && (
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-400 bg-slate-950 rounded-full absolute -bottom-1 -right-1"
                    title="Verified Community Head"
                  />
                )}
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/40 flex items-center justify-center shrink-0">
                <span className="text-base font-black text-amber-400">
                  {player.chNickname.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-400 mb-0.5">
                <Shield className="w-3 h-3 text-amber-400" />
                <span>Community Head</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={
                    player.facebookProfileUrl ||
                    `https://www.facebook.com/${player.chNickname.toLowerCase().replace(/[^a-z0-9]/g, '')}.mlbb`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group hover:opacity-90 inline-flex items-center gap-1.5 transition-opacity"
                  title={`Click to visit ${player.chNickname}'s Facebook Profile`}
                >
                  <h3 className="text-2xl font-black tracking-tight text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                    <span>{player.chNickname}</span>
                    <ExternalLink className="w-4 h-4 text-blue-400 opacity-75 group-hover:opacity-100" />
                  </h3>
                </a>
                {player.active && !player.avatarUrl && (
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-400 shrink-0 inline"
                    title="Verified Community Head"
                  />
                )}
              </div>
              {player.fullName && (
                <p className="text-[11px] text-slate-400 font-medium truncate max-w-[180px]">
                  {player.fullName}
                </p>
              )}
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
            {player.area}
          </span>
        </div>

        {/* 2. Tournament Status (Capacity & Availability) */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              Tournament Status
            </span>

            {/* Glowing Status Badge */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black font-mono tracking-tight ${
                isFullOrClosed
                  ? 'bg-red-950/80 text-red-400 border border-red-800/80'
                  : slotsLeft <= 2
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
              }`}
            >
              STATUS {player.teamsRegistered}/{player.maxTeams}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isFullOrClosed
                  ? 'bg-red-500'
                  : slotsLeft <= 2
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${percentFilled}%` }}
            />
          </div>

          {/* Can Join Notification & Form Status */}
          <div className="mt-2.5 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between">
              {isFullOrClosed ? (
                <span className="text-red-400 font-bold flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>
                    {isCapacityFull
                      ? `Tournament Full (${player.teamsRegistered}/${player.maxTeams}) • Closed`
                      : 'Registration Closed by Owner'}
                  </span>
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Can Join • {slotsLeft} {slotsLeft === 1 ? 'slot' : 'slots'} open</span>
                </span>
              )}

              <span className="text-slate-400 font-mono text-[11px]">
                {percentFilled}%
              </span>
            </div>

            {/* Registration Form & Sheet Detection Detail */}
            {player.formStatusDetail && (
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-900">
                <span className={`w-1.5 h-1.5 rounded-full ${isFullOrClosed ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <span className="truncate">{player.formStatusDetail}</span>
                {player.lastDetectedAt && (
                  <span className="text-slate-500 ml-auto shrink-0">Checked {player.lastDetectedAt}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Tournament Posting Link (Action Join Button) */}
      <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center gap-2">
        {isFullOrClosed ? (
          <div className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800/80 text-slate-400 border border-slate-700 text-xs font-bold text-center flex items-center justify-center gap-2 cursor-not-allowed select-none">
            <Ban className="w-4 h-4 text-slate-500" />
            <span>
              {isCapacityFull
                ? `Registration Closed (${player.teamsRegistered}/${player.maxTeams} Full)`
                : 'Registration Closed'}
            </span>
          </div>
        ) : regLink ? (
          <>
            <a
              href={regLink}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black tracking-wide transition-all shadow-md shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-1.5 border border-yellow-300"
            >
              <span>Join Tournament</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href={
                player.facebookProfileUrl ||
                `https://www.facebook.com/${player.chNickname.toLowerCase().replace(/[^a-z0-9]/g, '')}.mlbb`
              }
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 transition-colors"
              title={`Message ${player.chNickname} on Facebook`}
            >
              <MessageCircle className="w-4 h-4" />
            </a>

            <button
              onClick={handleCopyLink}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
              title="Copy Registration Form Link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={() => onOpenQR(player)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
              title="Scan QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex-1 text-center py-2 text-xs text-slate-500 italic">
            Link pending
          </div>
        )}
      </div>
    </div>
  );
};
