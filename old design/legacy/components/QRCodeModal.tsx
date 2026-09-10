import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, ExternalLink, Copy, Check, QrCode } from 'lucide-react';
import { CHPlayer } from '../types';

interface QRCodeModalProps {
  player: CHPlayer | null;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ player, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const targetLink =
    player?.resolvedFormUrl ||
    player?.registrationFormLink ||
    player?.tournamentPostingLink ||
    '';

  useEffect(() => {
    if (targetLink) {
      QRCode.toDataURL(targetLink, {
        width: 260,
        margin: 1.5,
        color: {
          dark: '#0a0e1a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code', err));
    }
  }, [targetLink]);

  if (!player) return null;

  const handleCopy = async () => {
    if (!targetLink) return;
    try {
      await navigator.clipboard.writeText(targetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 animate-fadeIn overflow-hidden"
      onClick={onClose}
    >
      <div
        className="glass-3d rounded-2xl sm:rounded-3xl max-w-sm w-full p-5 sm:p-6 text-white relative animate-scaleUp border border-white/15 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top 3D Luminous Specular Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-[0_1px_12px_rgba(250,204,21,0.5)] rounded-t-3xl" />

        {/* Tactile Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center rounded-lg btn-3d-glass text-slate-300 hover:text-white transition-all cursor-pointer"
          aria-label="Close QR Code dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-1 pt-1">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
            <QrCode className="w-3 h-3" />
            <span>Tournament Quick Scan</span>
          </div>
          <h3 className="text-xl font-black text-white drop-shadow-sm">
            CH {player.chNickname}
          </h3>
          <p className="text-xs text-slate-300">
            {player.area || 'Philippines'} {player.fullName ? `• ${player.fullName}` : ''}
          </p>
        </div>

        {/* QR Code Canvas with 3D inset frame */}
        <div className="mt-4 p-3 bg-white/95 rounded-2xl border border-white/30 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_8px_20px_rgba(0,0,0,0.4)]">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${player.chNickname}`}
              className="w-44 h-44 rounded-xl"
            />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-500 animate-pulse font-medium">
              Generating 3D QR Code...
            </div>
          )}
        </div>

        {/* Link Info (3D Inset Panel) */}
        <div className="mt-3.5 p-2.5 glass-inset-panel rounded-xl flex items-center justify-between text-xs">
          <span className="text-amber-300 font-mono text-[11px] truncate mr-2">
            {targetLink}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="btn-3d-glass px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-200 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-300" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Action Button - Normal Sized Designed Button */}
        <div className="mt-3.5">
          <a
            href={targetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-3d-gold w-full h-9 sm:h-9.5 px-4 rounded-lg text-xs sm:text-sm font-black text-slate-950 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm no-underline select-none"
          >
            <span>Open Link in Browser</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
