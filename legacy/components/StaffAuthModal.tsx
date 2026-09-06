import React, { useState } from 'react';
import { Shield, KeyRound, Lock, CheckCircle2, AlertCircle, X, Sparkles, UserCheck } from 'lucide-react';

interface StaffAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const StaffAuthModal: React.FC<StaffAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const validPasscodes = ['morphcute15'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const clean = passcode.trim().toLowerCase();
    if (validPasscodes.includes(clean)) {
      setTimeout(() => {
        setIsSubmitting(false);
        onLoginSuccess();
        onClose();
      }, 250);
    } else {
      setIsSubmitting(false);
      setError('Invalid password. Please enter the correct administrator password.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden">
        {/* Gold top accent line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

        <div className="p-6 sm:p-7 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Administrator Sign In</h3>
                <p className="text-xs text-slate-400">
                  Manage tournaments, Google Sheet sync, and header banner
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Normal Player Notice */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Normal players do not need an account.</strong> Players can freely browse and join tournaments from the directory. This login is for CH community organizers and staff only.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Administrator Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter administrator password..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono tracking-wider"
                />
              </div>

              {error && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel (Player View)
              </button>

              <button
                type="submit"
                disabled={!passcode.trim() || isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black tracking-wide shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Verifying...' : 'Unlock Admin Panel'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
