/**
 * Avatar utilities for unique 2-letter initials and deterministic vibrant color palette
 */

export interface AvatarColor {
  bg: string;
  text: string;
  border: string;
  ring: string;
}

const PALETTE: AvatarColor[] = [
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', ring: 'ring-emerald-500/30' },
  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40', ring: 'ring-amber-500/30' },
  { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/40', ring: 'ring-indigo-500/30' },
  { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/40', ring: 'ring-violet-500/30' },
  { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/40', ring: 'ring-rose-500/30' },
  { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/40', ring: 'ring-teal-500/30' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40', ring: 'ring-cyan-500/30' },
  { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/40', ring: 'ring-fuchsia-500/30' },
  { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/40', ring: 'ring-sky-500/30' },
  { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/40', ring: 'ring-orange-500/30' },
];

/**
 * Assigns a deterministic distinct hue from the palette based on string hash
 */
export function getAvatarColor(identifier: string): AvatarColor {
  if (!identifier) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

/**
 * Generates unique 2-letter initials disambiguating duplicates like Taki vs Tala
 */
export function getUniqueInitials(nickname: string, fullName?: string): string {
  const cleanNick = (nickname || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  const cleanFull = (fullName || '').trim();

  // If full name has multiple words, check if initials differ
  const fullParts = cleanFull.split(/\s+/).filter(Boolean);
  if (fullParts.length >= 2) {
    const f1 = fullParts[0][0]?.toUpperCase() || '';
    const f2 = fullParts[fullParts.length - 1][0]?.toUpperCase() || '';
    if (f1 && f2) {
      // Use Nickname 1st letter + Last name 1st letter to make it personal & unique
      if (cleanNick.length > 0) {
        return (cleanNick[0] + f2).toUpperCase();
      }
      return (f1 + f2).toUpperCase();
    }
  }

  // Fallback to Nickname letters
  if (cleanNick.length >= 2) {
    // If nickname is 4+ chars, pick first and 3rd or last char to avoid common 'TA' collision
    if (cleanNick.length >= 4) {
      return (cleanNick[0] + cleanNick[cleanNick.length - 1]).toUpperCase();
    }
    return cleanNick.substring(0, 2).toUpperCase();
  }

  if (cleanNick.length === 1) {
    return (cleanNick + 'H').toUpperCase();
  }

  return 'CH';
}
