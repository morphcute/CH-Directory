import React from 'react';
import { LogOut, UserCheck } from 'lucide-react';
import { User } from 'firebase/auth';

interface GoogleSignInButtonProps {
  user: User | null;
  isLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  compact?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  user,
  isLoading,
  onSignIn,
  onSignOut,
  compact = false,
}) => {
  if (user) {
    return (
      <div className="flex items-center gap-2 bg-slate-900 border border-emerald-500/40 px-3 py-1.5 rounded-xl shadow-xs">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Google User'}
            className="w-6 h-6 rounded-full border border-emerald-400/50"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-emerald-950 flex items-center justify-center text-emerald-400 font-bold text-xs">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="flex flex-col text-left">
          <span className="text-[11px] font-bold text-emerald-300 leading-tight">
            {user.displayName || 'Google Editor'}
          </span>
          <span className="text-[10px] text-slate-400 leading-tight truncate max-w-[180px]">
            {user.email}
          </span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          title="Sign out of Google"
          className="ml-1 p-1 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-md transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      id="btn-google-signin"
      onClick={onSignIn}
      disabled={isLoading}
      className={`gsi-material-button relative inline-flex items-center justify-center font-medium rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-xs cursor-pointer disabled:opacity-60 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      }`}
    >
      <div className="gsi-material-button-content-wrapper flex items-center gap-2">
        <div className="gsi-material-button-icon shrink-0">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            className="w-4 h-4 block"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
        </div>
        <span className="gsi-material-button-contents font-semibold text-slate-800 text-xs">
          {isLoading ? 'Connecting...' : 'Sign in with Google'}
        </span>
      </div>
    </button>
  );
};
