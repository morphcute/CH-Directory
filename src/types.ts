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

export interface RaffleEntry {
  id: string;
  fullName: string;
  prizeWon?: string | null;
  deviceId?: string;
  createdAt: string;
}

export interface RaffleData {
  id: string;
  title: string;
  description: string;
  cutoffDate: string; // ISO date or date string
  prizes: string[]; // e.g. ["Starlight", "100 Diamonds", "50 Diamonds"]
  isActive: boolean;
  isArchived?: boolean;
  entries: RaffleEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RaffleArchiveSummary {
  id: string;
  title: string;
  description: string;
  cutoffDate: string;
  prizes: string[];
  createdAt: string;
  entriesCount: number;
  winners: { id: string; fullName: string; prizeWon: string }[];
}

