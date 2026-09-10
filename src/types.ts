export interface CHPlayer {
  id: string;
  active: boolean;
  area: string;
  isCalabarzon?: boolean;
  fullName: string;
  chNickname: string;
  facebookProfileUrl?: string; // Direct Facebook Profile link for messaging the CH
  registrationFormLink: string; // Column F in Google Sheet
  tournamentPostingLink: string; // alias for registrationFormLink
  tournamentResponseSheet: string; // Column G in Google Sheet
  teamsRegistered: number; // e.g. 16 for Lester, 10 for Meg
  maxTeams: number; // default 16
  lastDetectedAt?: string;
  remarks?: string;
  rowIndex?: number;
  avatarUrl?: string; // Custom picture or avatar photo for Community Head
  formStatus?: 'open' | 'closed' | 'full' | 'error' | 'checking';
  formStatusDetail?: string;
  resolvedResponseSheetUrl?: string;
  resolvedFormUrl?: string;
  registeredTeams?: string[];
  prlCutoff?: string;
}

export interface AppState {
  players: CHPlayer[];
  bannerSettings?: HeaderBackgroundConfig;
  selectedNicknames?: string[];
  activeTabName?: string;
  spreadsheetUrl?: string;
  rawTabsList?: string[];
  lastUpdated?: number;
  lastHourlySync?: number;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleConnectedEmail?: string;
  googleTokenExpiresAt?: number;
  logoUrl?: string;
  bannerUrl?: string;
  pageViews?: number;
  prlCutoff?: string;
}

export interface SheetTab {
  name: string;
  monthName: string;
  monthIndex: number; // 0-11
  day?: number;
  year: number;
  isCurrentMonth: boolean;
  gid?: string;
}

export interface MonthInfo {
  monthIndex: number;
  name: string;
  year: number;
}

export interface SheetSource {
  title: string;
  url: string;
  spreadsheetId: string;
  selectedTab: string;
  detectedTabs: SheetTab[];
  autoDetectedTab: string | null;
  currentMonthName: string;
  currentYear: number;
}

export interface HeaderBackgroundConfig {
  type: 'preset' | 'custom';
  presetId: string;
  customUrl?: string;
  uploadedBannerDataUrl?: string;
  bannerFileName?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  avatarType?: 'icon' | 'custom';
  avatarCustomUrl?: string;
  avatarFileName?: string;
  overlayDarkness?: number; // 0 to 0.8
  bannerHeight?: 'compact' | 'standard' | 'tall'; // 140px, 180px, 240px
  bannerFit?: 'cover' | 'contain';
  facebookPageUrl?: string;
  followersText?: string;
  categoryText?: string;
}

export interface AdminConfig {
  selectedNicknames: string[];
  autoDetectHourly: boolean;
  lastHourlySync: string;
  defaultMaxTeams: number;
  headerBackground: HeaderBackgroundConfig;
}

export interface RafflePrizeItem {
  id?: string;
  name: string;
  winnerCount: number;
}

export function normalizePrizeItems(prizes?: (string | RafflePrizeItem)[] | null): RafflePrizeItem[] {
  if (!Array.isArray(prizes)) return [];
  return prizes
    .map((p, idx) => {
      if (typeof p === "string") {
        const trimmed = p.trim();
        const leading = trimmed.match(/^(\d+)\s*[xX×]\s*(.+)$/);
        if (leading) {
          return { id: `pz-${idx}`, name: leading[2].trim(), winnerCount: parseInt(leading[1], 10) || 1 };
        }
        const trailing = trimmed.match(/^(.+?)\s*\((\d+)\s*[xX×]?\s*(?:winners)?\)$/i);
        if (trailing) {
          return { id: `pz-${idx}`, name: trailing[1].trim(), winnerCount: parseInt(trailing[2], 10) || 1 };
        }
        return { id: `pz-${idx}`, name: trimmed, winnerCount: 1 };
      }
      if (typeof p === "object" && p !== null) {
        return {
          id: p.id || `pz-${idx}`,
          name: String(p.name || "").trim(),
          winnerCount: Math.max(1, Number(p.winnerCount) || 1),
        };
      }
      return { id: `pz-${idx}`, name: String(p).trim(), winnerCount: 1 };
    })
    .filter((p) => Boolean(p.name));
}

export interface RaffleEntry {
  id: string;
  fullName: string;
  prizeWon?: string | null;
  deviceId?: string;
  ipAddress?: string;
  fingerprint?: string;
  raffleId?: string;
  raffleTitle?: string;
  category?: string;
  createdAt: string;
}

export interface RaffleData {
  id: string;
  title: string;
  category?: string;
  description: string;
  cutoffDate: string; // ISO date or date string
  prizes: (string | RafflePrizeItem)[];
  isActive: boolean;
  isArchived?: boolean;
  entries: RaffleEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RaffleActiveSummary {
  id: string;
  title: string;
  category?: string;
  description: string;
  cutoffDate: string;
  prizes: (string | RafflePrizeItem)[];
  isActive: boolean;
  entriesCount: number;
  createdAt: string;
}

export interface RaffleArchiveSummary {
  id: string;
  title: string;
  category?: string;
  description: string;
  cutoffDate: string;
  prizes: (string | RafflePrizeItem)[];
  createdAt: string;
  entriesCount: number;
  winners: { id: string; fullName: string; prizeWon: string }[];
}
