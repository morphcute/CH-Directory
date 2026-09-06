import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  Image as ImageIcon,
  Table as TableIcon,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Search,
  CheckSquare,
  Square,
  Link as LinkIcon,
  Minus,
  Globe,
  Upload,
  Palette,
  ExternalLink,
  Eye,
  SlidersHorizontal,
  Clock,
  Sparkles,
  Smartphone,
  Save,
  X,
  ListPlus,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Lock,
  Camera,
  Check,
  Type,
  FileImage,
  Crop,
  Database,
} from 'lucide-react';
import { CHPlayer, HeaderBackgroundConfig, SheetTab } from '../types';
import { HEADER_PRESETS } from '../data/headerPresets';
import { LinktreeView } from './LinktreeView';
import { compressImageFile } from '../utils/imageUtils';
import { User } from 'firebase/auth';
import { GoogleSignInButton } from './GoogleSignInButton';

interface AdminDashboardViewProps {
  players: CHPlayer[];
  selectedNicknames: string[];
  onToggleNickname: (nickname: string) => void;
  onSelectAllNicknames: (select: boolean) => void;
  onSelectActiveOnly: () => void;
  onAddPlayer: (player: Omit<CHPlayer, 'id'>) => void;
  onUpdatePlayer: (player: CHPlayer) => void;
  onDeletePlayer: (playerId: string) => void;
  onBulkAddNicknames: (nicknames: string[]) => void;
  onUpdatePlayerCapacity: (playerId: string, teamsRegistered: number, maxTeams: number) => void;
  onRunHourlyDetection: () => Promise<void>;
  isDetecting: boolean;
  lastHourlySync: string;
  nextSyncCountdown: string;
  bgConfig: HeaderBackgroundConfig;
  onUpdateBgConfig: (config: HeaderBackgroundConfig) => void;
  spreadsheetUrl: string;
  onUpdateSpreadsheetUrl: (url: string) => void;
  detectedTabs: SheetTab[];
  activeTabName: string;
  onSelectTab: (tabName: string) => void;
  onViewPublicLinktree: () => void;
  onExitStaffMode: () => void;
  currentMonthName: string;
  currentYear: number;
  onOpenQR: (player: CHPlayer) => void;
  onSetDisplayOnlyNickname?: (nickname: string) => void;
  onSyncSpreadsheet?: (url: string, tabName?: string) => Promise<boolean>;
  onImportRawSheetData?: (text: string) => Promise<boolean>;
  syncStatus?: {
    loading: boolean;
    error: string | null;
    successMessage: string | null;
  };
  googleUser?: User | null;
  isGoogleSigningIn?: boolean;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  players,
  selectedNicknames,
  onToggleNickname,
  onSelectAllNicknames,
  onSelectActiveOnly,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onBulkAddNicknames,
  onUpdatePlayerCapacity,
  onRunHourlyDetection,
  isDetecting,
  lastHourlySync,
  nextSyncCountdown,
  bgConfig,
  onUpdateBgConfig,
  spreadsheetUrl,
  onUpdateSpreadsheetUrl,
  detectedTabs,
  activeTabName,
  onSelectTab,
  onViewPublicLinktree,
  onExitStaffMode,
  currentMonthName,
  currentYear,
  onOpenQR,
  onSetDisplayOnlyNickname,
  onSyncSpreadsheet,
  onImportRawSheetData,
  syncStatus,
  googleUser,
  isGoogleSigningIn = false,
  onGoogleSignIn,
  onGoogleSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'directory' | 'banner' | 'sheets' | 'preview'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Helper to isolate 1 CH Nickname on the public linktree
  const handleDisplayOnlyThisCH = (nickname: string) => {
    if (onSetDisplayOnlyNickname) {
      onSetDisplayOnlyNickname(nickname);
    } else {
      onSelectAllNicknames(false);
      onToggleNickname(nickname);
    }
    setStatusMessage(`Public Treeview is now set to display ONLY "${nickname}".`);
  };

  // Add Form state (defaults to 0 registered = Open slots)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newFacebookUrl, setNewFacebookUrl] = useState('');
  const [newPostingLink, setNewPostingLink] = useState('');
  const [newResponseSheet, setNewResponseSheet] = useState('');
  const [newTeamsRegistered, setNewTeamsRegistered] = useState(0);
  const [newMaxTeams, setNewMaxTeams] = useState(16);

  // Direct paste importer state
  const [pastedSheetText, setPastedSheetText] = useState('');
  const [showDirectPasteBox, setShowDirectPasteBox] = useState(false);
  const [isSyncingLiveSheet, setIsSyncingLiveSheet] = useState(false);

  // Bulk add state
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  // Edit player state
  const [editingPlayer, setEditingPlayer] = useState<CHPlayer | null>(null);
  const [editForm, setEditForm] = useState<{
    chNickname: string;
    area: string;
    fullName: string;
    facebookProfileUrl?: string;
    registrationFormLink: string;
    tournamentResponseSheet: string;
    teamsRegistered: number;
    maxTeams: number;
    avatarUrl?: string;
  }>({
    chNickname: '',
    area: '',
    fullName: '',
    facebookProfileUrl: '',
    registrationFormLink: '',
    tournamentResponseSheet: '',
    teamsRegistered: 10,
    maxTeams: 16,
    avatarUrl: '',
  });

  const [isProcessingChAvatar, setIsProcessingChAvatar] = useState(false);

  const handleChAvatarUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please choose a valid image file');
      return;
    }
    setIsProcessingChAvatar(true);
    try {
      const result = await compressImageFile(file, 400, 400, 0.85);
      setEditForm((prev) => ({ ...prev, avatarUrl: result.dataUrl }));
    } catch (err: any) {
      alert('Failed to process image: ' + (err.message || 'unknown error'));
    } finally {
      setIsProcessingChAvatar(false);
    }
  };

  // Custom Banner State
  const [customImageUrlInput, setCustomImageUrlInput] = useState(
    bgConfig.type === 'custom' && bgConfig.customUrl ? bgConfig.customUrl : ''
  );
  const [isProcessingBanner, setIsProcessingBanner] = useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleBannerFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose a valid image file (PNG, JPG, WebP, etc.)');
      return;
    }
    setUploadError(null);
    setIsProcessingBanner(true);
    try {
      const result = await compressImageFile(file, 1600, 800, 0.85);
      onUpdateBgConfig({
        ...bgConfig,
        type: 'custom',
        uploadedBannerDataUrl: result.dataUrl,
        bannerFileName: file.name,
      });
      setStatusMessage(`Banner picture "${file.name}" uploaded and applied!`);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to compress or upload banner image.');
    } finally {
      setIsProcessingBanner(false);
    }
  };

  const handleAvatarFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose a valid image file for logo');
      return;
    }
    setUploadError(null);
    setIsProcessingAvatar(true);
    try {
      const result = await compressImageFile(file, 400, 400, 0.85);
      onUpdateBgConfig({
        ...bgConfig,
        avatarType: 'custom',
        avatarCustomUrl: result.dataUrl,
      });
      setStatusMessage('Custom tournament logo uploaded!');
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to compress or upload logo image.');
    } finally {
      setIsProcessingAvatar(false);
    }
  };

  // Unique Areas
  const allAreas = useMemo(() => {
    const set = new Set(players.map((p) => p.area).filter(Boolean));
    return ['ALL', ...Array.from(set).sort()];
  }, [players]);

  // Filtered Players for Admin Table
  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      if (areaFilter !== 'ALL' && player.area !== areaFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nMatch = player.chNickname.toLowerCase().includes(q);
        const fMatch = player.fullName?.toLowerCase().includes(q);
        const aMatch = player.area?.toLowerCase().includes(q);
        if (!nMatch && !fMatch && !aMatch) return false;
      }
      return true;
    });
  }, [players, areaFilter, searchQuery]);

  // Metrics
  const totalCount = players.length;
  const visibleOnLinktreeCount = players.filter((p) =>
    selectedNicknames.includes(p.chNickname)
  ).length;
  const fullCount = players.filter(
    (p) => p.teamsRegistered >= p.maxTeams && selectedNicknames.includes(p.chNickname)
  ).length;
  const openCount = visibleOnLinktreeCount - fullCount;
  const totalRegisteredTeams = players.reduce((sum, p) => sum + p.teamsRegistered, 0);

  // Handle Export CSV
  const handleExportCSV = () => {
    const headers = [
      'CH Nickname',
      'Area',
      'Full Name',
      'Visible on Linktree',
      'Registered Teams',
      'Max Teams',
      'Capacity Status',
      'Tournament Form Link',
      'Response Sheet Link',
    ];
    const rows = players.map((p) => [
      `"${p.chNickname}"`,
      `"${p.area}"`,
      `"${p.fullName || ''}"`,
      selectedNicknames.includes(p.chNickname) ? 'YES' : 'NO',
      p.teamsRegistered,
      p.maxTeams,
      p.teamsRegistered >= p.maxTeams ? 'FULL' : 'OPEN',
      `"${p.registrationFormLink || p.tournamentPostingLink || ''}"`,
      `"${p.tournamentResponseSheet || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CH_Tournaments_${currentMonthName}_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 1. Master Admin Navigation Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-sm sm:text-base text-white tracking-wide">
                  Community Heroes Admin Console
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                  STAFF MODE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Manage CH Nicknames, Tournament Links, Google Forms Banner & Hourly Slots
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick View Public Linktree button */}
            <button
              onClick={onViewPublicLinktree}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 rounded-xl text-xs sm:text-sm font-black transition-all shadow-md flex items-center gap-2"
              title="Switch to the public player Linktree view"
            >
              <Smartphone className="w-4 h-4" />
              <span>View Public Linktree</span>
            </button>

            {/* Logout button */}
            <button
              onClick={onExitStaffMode}
              className="px-3 py-2 bg-slate-800 hover:bg-red-900/60 hover:text-red-300 text-slate-300 rounded-xl text-xs font-semibold transition-colors border border-slate-700"
              title="Logout from admin mode"
            >
              Exit Admin
            </button>
          </div>
        </div>
      </header>

      {/* 2. Admin Workspace Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Status notification banner */}
        {statusMessage && (
          <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs font-semibold shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-emerald-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total CHs Listed
            </p>
            <p className="text-2xl font-black text-white mt-1">{totalCount}</p>
            <p className="text-[11px] text-slate-500 mt-1">In master directory</p>
          </div>

          <div className="bg-slate-900/90 border border-blue-500/40 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
              Active on Linktree
            </p>
            <p className="text-2xl font-black text-blue-400 mt-1">{visibleOnLinktreeCount}</p>
            <p className="text-[11px] text-slate-400 mt-1">Visible to public players</p>
          </div>

          <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              Open Tournaments
            </p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{openCount}</p>
            <p className="text-[11px] text-emerald-500 mt-1">Accepting squad entries</p>
          </div>

          <div className="bg-slate-900/90 border border-red-500/40 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
              Full (16/16 Slots)
            </p>
            <p className="text-2xl font-black text-red-400 mt-1">{fullCount}</p>
            <p className="text-[11px] text-red-400 mt-1">Registration closed</p>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-slate-900/90 border border-amber-500/40 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Hourly Auto-Sync
            </p>
            <p className="text-lg font-black text-amber-300 mt-1 font-mono">{nextSyncCountdown}</p>
            <p className="text-[11px] text-slate-400 mt-1">Last: {lastHourlySync}</p>
          </div>
        </div>

        {/* Tab Selection Bar */}
        <div className="border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'directory'
                  ? 'border-amber-400 text-amber-300 bg-slate-900/50'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>CH Nickname Management</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300">
                {players.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('banner')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'banner'
                  ? 'border-amber-400 text-amber-300 bg-slate-900/50'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Google Forms Header Banner</span>
            </button>

            <button
              onClick={() => setActiveTab('sheets')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'sheets'
                  ? 'border-amber-400 text-amber-300 bg-slate-900/50'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Google Sheets & Hourly Sync</span>
            </button>

            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'preview'
                  ? 'border-amber-400 text-amber-300 bg-slate-900/50'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Live Linktree Preview</span>
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* TAB 1: CH Nicknames Directory Manager */}
        {activeTab === 'directory' && (
          <div className="space-y-4">
            {/* Top Controls: Add CH, Bulk Paste, Search & Filters */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowAddForm(!showAddForm);
                      setShowBulkAdd(false);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                      showAddForm
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{showAddForm ? 'Close Add Form' : '+ List New CH Nickname'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowBulkAdd(!showBulkAdd);
                      setShowAddForm(false);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      showBulkAdd
                        ? 'bg-slate-800 text-white border-slate-700'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    <ListPlus className="w-4 h-4 text-amber-400" />
                    <span>{showBulkAdd ? 'Close Bulk' : 'Bulk Paste Nicknames'}</span>
                  </button>
                </div>

                {/* Batch visibility selections */}
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="text-slate-400 mr-1 text-[11px]">Linktree Visibility:</span>
                  <button
                    onClick={() => onSelectAllNicknames(true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => onSelectAllNicknames(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={onSelectActiveOnly}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    Active Only
                  </button>
                </div>
              </div>

              {/* Form 1: Add New CH Nickname */}
              {showAddForm && (
                <div className="bg-slate-950 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-amber-400" />
                      <span>List New CH Nickname (Nationwide: Any Region/Province)</span>
                    </h3>
                    <span className="text-[11px] text-amber-400/80">
                      Will automatically appear on the public Linktree
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        CH Nickname <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        placeholder="e.g. Lester, Meg, Frank, Tigz"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        Area / Province / City <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newArea}
                        onChange={(e) => setNewArea(e.target.value)}
                        placeholder="e.g. Quezon Province, Manila, Cebu, Cavite"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        Full Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                        placeholder="e.g. Kim Lester L. Evangelista"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        Facebook Profile URL (Column D / Hyperlink)
                      </label>
                      <input
                        type="url"
                        value={newFacebookUrl}
                        onChange={(e) => setNewFacebookUrl(e.target.value)}
                        placeholder="https://www.facebook.com/... (For players to message CH)"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-300 mb-1">
                        Tournament Registration Form Link (Column F) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="url"
                        value={newPostingLink}
                        onChange={(e) => setNewPostingLink(e.target.value)}
                        placeholder="https://forms.gle/... or https://tinyurl.com/..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        Initial Capacity (Registered / Max)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={64}
                          value={newTeamsRegistered}
                          onChange={(e) => setNewTeamsRegistered(parseInt(e.target.value) || 0)}
                          className="w-16 px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-center text-white"
                        />
                        <span className="text-slate-500 font-bold">/</span>
                        <input
                          type="number"
                          min={1}
                          max={64}
                          value={newMaxTeams}
                          onChange={(e) => setNewMaxTeams(parseInt(e.target.value) || 16)}
                          className="w-16 px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-center text-white"
                        />
                        <span className="text-[11px] text-slate-400">
                          {newTeamsRegistered >= newMaxTeams ? 'Full (16/16)' : 'Open'}
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block font-bold text-slate-300 mb-1">
                        Tournament Response Sheet URL (Optional Column G, for auto hourly counting)
                      </label>
                      <input
                        type="url"
                        value={newResponseSheet}
                        onChange={(e) => setNewResponseSheet(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/... (Responses sheet)"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newNickname.trim()) {
                          alert('Please enter a CH Nickname');
                          return;
                        }
                        const nick = newNickname.trim();
                        const link =
                          newPostingLink.trim() ||
                          `https://forms.gle/${nick.toLowerCase()}-mlbb-tournament`;
                        const area = newArea.trim() || 'General';

                        onAddPlayer({
                          active: true,
                          area: area,
                          fullName: newFullName.trim() || nick,
                          chNickname: nick,
                          facebookProfileUrl: newFacebookUrl.trim() || undefined,
                          registrationFormLink: link,
                          tournamentPostingLink: link,
                          tournamentResponseSheet: newResponseSheet.trim(),
                          teamsRegistered: newTeamsRegistered,
                          maxTeams: newMaxTeams,
                          lastDetectedAt:
                            new Date().toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            }) + ' PHT',
                        });

                        setStatusMessage(
                          `Added "${nick}" to the directory and published to Linktree!`
                        );
                        setNewNickname('');
                        setNewArea('');
                        setNewFullName('');
                        setNewFacebookUrl('');
                        setNewPostingLink('');
                        setNewResponseSheet('');
                        setNewTeamsRegistered(10);
                        setShowAddForm(false);
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs shadow-lg transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save & Publish to Linktree</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Form 2: Bulk Add Nicknames */}
              {showBulkAdd && (
                <div className="bg-slate-950 border-2 border-slate-700 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <ListPlus className="w-4 h-4 text-amber-400" />
                      <span>Bulk Paste CH Nicknames</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">Separated by comma or new lines</span>
                  </div>

                  <div>
                    <textarea
                      rows={3}
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder="e.g. Lester, Meg, Frank, Tigz, Kix, Clyde, Tala, Yvonne, Dan, Cheska, Vien, Seiun, Jerz, Tron, Yuki, JV"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      New nicknames will be added with default 10/16 slots and automatically enabled on Linktree.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkAdd(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!bulkInput.trim()) return;
                        const nicks = bulkInput
                          .split(/[,\n]/)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        onBulkAddNicknames(nicks);
                        setStatusMessage(`Added/Selected ${nicks.length} CH Nicknames.`);
                        setBulkInput('');
                        setShowBulkAdd(false);
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>List All Nicknames</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Modal / Banner Form */}
              {editingPlayer && (
                <div className="bg-slate-950 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Edit2 className="w-4 h-4 text-amber-400" />
                      <h3 className="font-bold text-sm text-white">
                        Editing CH: <span className="text-amber-400">{editingPlayer.chNickname}</span>
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingPlayer(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    {/* CH Picture Upload Section */}
                    <div className="sm:col-span-2 md:col-span-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
                      <label className="block font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>CH Profile Picture / Photo (Real-time Synced to Linktree)</span>
                      </label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {editForm.avatarUrl ? (
                          <div className="relative">
                            <img
                              src={editForm.avatarUrl}
                              alt="CH Preview"
                              className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-md"
                            />
                            <button
                              type="button"
                              onClick={() => setEditForm((prev) => ({ ...prev, avatarUrl: '' }))}
                              className="absolute -top-1 -right-1 p-0.5 bg-red-600 hover:bg-red-500 rounded-full text-white text-[10px]"
                              title="Remove Photo"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                            <Camera className="w-5 h-5 text-slate-500" />
                          </div>
                        )}

                        <div className="flex-1 space-y-2 w-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="cursor-pointer px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors">
                              <Upload className="w-3.5 h-3.5" />
                              <span>{isProcessingChAvatar ? 'Compressing...' : 'Upload Picture'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isProcessingChAvatar}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleChAvatarUpload(file);
                                }}
                              />
                            </label>
                            {editForm.avatarUrl && (
                              <button
                                type="button"
                                onClick={() => setEditForm((prev) => ({ ...prev, avatarUrl: '' }))}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-medium"
                              >
                                Clear Picture
                              </button>
                            )}
                          </div>
                          <input
                            type="url"
                            placeholder="Or paste image URL (https://...)"
                            value={editForm.avatarUrl || ''}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">CH Nickname</label>
                      <input
                        type="text"
                        value={editForm.chNickname}
                        onChange={(e) => setEditForm({ ...editForm, chNickname: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Area / Province</label>
                      <input
                        type="text"
                        value={editForm.area}
                        onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editForm.fullName}
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        Facebook Profile URL (Column D / Hyperlink)
                      </label>
                      <input
                        type="url"
                        placeholder="https://www.facebook.com/..."
                        value={editForm.facebookProfileUrl || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, facebookProfileUrl: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-300 mb-1">
                        Tournament Registration Form Link
                      </label>
                      <input
                        type="url"
                        value={editForm.registrationFormLink}
                        onChange={(e) =>
                          setEditForm({ ...editForm, registrationFormLink: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Teams / Max</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={64}
                          value={editForm.teamsRegistered}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              teamsRegistered: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-16 px-2 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-center text-white"
                        />
                        <span className="text-slate-500">/</span>
                        <input
                          type="number"
                          min={1}
                          max={64}
                          value={editForm.maxTeams}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              maxTeams: parseInt(e.target.value) || 16,
                            })
                          }
                          className="w-16 px-2 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-center text-white"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block font-bold text-slate-300 mb-1">Response Sheet URL</label>
                      <input
                        type="url"
                        value={editForm.tournamentResponseSheet}
                        onChange={(e) =>
                          setEditForm({ ...editForm, tournamentResponseSheet: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingPlayer(null)}
                      className="px-3 py-1.5 text-xs text-slate-400 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!editForm.chNickname.trim()) return;
                        onUpdatePlayer({
                          ...editingPlayer,
                          chNickname: editForm.chNickname.trim(),
                          area: editForm.area.trim() || 'General',
                          fullName: editForm.fullName.trim(),
                          facebookProfileUrl: editForm.facebookProfileUrl?.trim() || undefined,
                          registrationFormLink: editForm.registrationFormLink.trim(),
                          tournamentPostingLink: editForm.registrationFormLink.trim(),
                          tournamentResponseSheet: editForm.tournamentResponseSheet.trim(),
                          teamsRegistered: editForm.teamsRegistered,
                          maxTeams: editForm.maxTeams,
                          avatarUrl: editForm.avatarUrl?.trim() || undefined,
                        });
                        setStatusMessage(`Saved changes for "${editForm.chNickname}".`);
                        setEditingPlayer(null);
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs shadow-md flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Search & Area Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between pt-1 border-t border-slate-800">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by CH Nickname, area, or name..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Area:</span>
                  <select
                    value={areaFilter}
                    onChange={(e) => setAreaFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  >
                    {allAreas.map((a) => (
                      <option key={a} value={a}>
                        {a === 'ALL' ? 'All Areas / Provinces' : a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Single CH Visibility Status Banner if exactly 1 CH is selected */}
            {selectedNicknames.length === 1 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-400 text-slate-950 shrink-0 shadow-sm">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                      Public Treeview: Display Only Mode Active
                    </span>
                    <p className="text-xs text-white font-bold">
                      Public visitors now see <u>ONLY</u> <span className="text-amber-300 font-extrabold text-sm">{selectedNicknames[0]}</span>. All other CH cards are hidden on the public page.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectAllNicknames(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 transition-colors"
                  >
                    Restore All ({players.length})
                  </button>
                  <button
                    type="button"
                    onClick={onViewPublicLinktree}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors shadow-md flex items-center gap-1"
                  >
                    <span>View Public Treeview</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Admin Directory: Mobile Card View (md:hidden) & Desktop Table (hidden md:block) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {/* Mobile Cards (No Horizontal Scrollbar!) */}
              <div className="md:hidden divide-y divide-slate-800/80">
                {filteredPlayers.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    No Community Heads match your filter.
                  </div>
                ) : (
                  filteredPlayers.map((player) => {
                    const isVisible = selectedNicknames.includes(player.chNickname);
                    const isFull = player.teamsRegistered >= player.maxTeams;
                    const regLink = player.registrationFormLink || player.tournamentPostingLink;

                    return (
                      <div
                        key={player.id}
                        className={`p-4 space-y-3 transition-colors ${
                          isVisible ? 'bg-transparent' : 'opacity-60 bg-slate-950/40'
                        }`}
                      >
                        {/* Top Row: Visibility Checkbox, Nickname, Area */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => onToggleNickname(player.chNickname)}
                              className="text-amber-400 hover:text-amber-300 transition-colors shrink-0 p-1"
                              title={isVisible ? 'Visible on Linktree (tap to hide)' : 'Hidden from Linktree (tap to show)'}
                            >
                              {isVisible ? (
                                <CheckSquare className="w-5 h-5 text-amber-400" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-600" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-sm text-white truncate">
                                  {player.chNickname}
                                </span>
                                {isVisible ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                                    ON LINKTREE
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-800 text-slate-400">
                                    HIDDEN
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDisplayOnlyThisCH(player.chNickname)}
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-black transition-colors flex items-center gap-1 ${
                                    selectedNicknames.length === 1 && selectedNicknames[0].toLowerCase() === player.chNickname.toLowerCase()
                                      ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs'
                                      : 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                                  }`}
                                  title={`Display ONLY "${player.chNickname}" on the public Linktree view`}
                                >
                                  <Eye className="w-2.5 h-2.5" />
                                  <span>{selectedNicknames.length === 1 && selectedNicknames[0].toLowerCase() === player.chNickname.toLowerCase() ? 'ONLY THIS CH' : 'DISPLAY ONLY'}</span>
                                </button>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <span className="text-xs text-slate-400">
                                  {player.area} {player.fullName && player.fullName !== player.chNickname && `• ${player.fullName}`}
                                </span>
                                <a
                                  href={
                                    player.facebookProfileUrl ||
                                    `https://www.facebook.com/${player.chNickname.toLowerCase().replace(/[^a-z0-9]/g, '')}.mlbb`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-400 hover:underline inline-flex items-center gap-0.5 font-bold"
                                  title="View Facebook Profile"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>FB Profile</span>
                                </a>
                              </div>
                            </div>
                          </div>

                          {/* Edit / Delete Icon Buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPlayer(player);
                                setEditForm({
                                  chNickname: player.chNickname,
                                  area: player.area,
                                  fullName: player.fullName,
                                  facebookProfileUrl: player.facebookProfileUrl || '',
                                  registrationFormLink: regLink,
                                  tournamentResponseSheet: player.tournamentResponseSheet || '',
                                  teamsRegistered: player.teamsRegistered,
                                  maxTeams: player.maxTeams,
                                  avatarUrl: player.avatarUrl || '',
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-800/60 rounded-lg"
                              title="Edit CH"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete "${player.chNickname}" from master directory?`)) {
                                  onDeletePlayer(player.id);
                                  setStatusMessage(`Deleted "${player.chNickname}".`);
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-400 bg-slate-800/60 rounded-lg"
                              title="Delete CH"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Middle Row: Slot Capacity Controls */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-400">Slots:</span>
                            <div className="inline-flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdatePlayerCapacity(
                                    player.id,
                                    Math.max(0, player.teamsRegistered - 1),
                                    player.maxTeams
                                  )
                                }
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 font-bold"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span
                                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg ${
                                  isFull
                                    ? 'bg-red-950 text-red-300 border border-red-500/40'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                }`}
                              >
                                {player.teamsRegistered}/{player.maxTeams}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdatePlayerCapacity(
                                    player.id,
                                    Math.min(player.maxTeams, player.teamsRegistered + 1),
                                    player.maxTeams
                                  )
                                }
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 font-bold"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              onUpdatePlayerCapacity(
                                player.id,
                                isFull ? 0 : player.maxTeams,
                                player.maxTeams
                              )
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              isFull
                                ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-600/40'
                                : 'bg-red-900/80 text-red-200 border border-red-600/40'
                            }`}
                          >
                            {isFull ? 'Reopen' : 'Mark Full'}
                          </button>
                        </div>

                        {/* Bottom Row: Link indicator */}
                        {regLink && (
                          <div className="text-xs pt-1 border-t border-slate-800/50 flex items-center justify-between">
                            <a
                              href={regLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-400 hover:underline flex items-center gap-1 truncate text-[11px]"
                            >
                              <LinkIcon className="w-3 h-3 shrink-0" />
                              <span className="truncate">{regLink}</span>
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop / Tablet Table View (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] font-black uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                    <tr>
                      <th className="p-3.5 w-12 text-center">Public Linktree</th>
                      <th className="p-3.5">CH Nickname</th>
                      <th className="p-3.5">Area / Province</th>
                      <th className="p-3.5 text-center">Registered Slots (Live Stepper)</th>
                      <th className="p-3.5">Registration Form Link</th>
                      <th className="p-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredPlayers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No Community Heads match your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPlayers.map((player) => {
                        const isVisible = selectedNicknames.includes(player.chNickname);
                        const isFull = player.teamsRegistered >= player.maxTeams;
                        const regLink = player.registrationFormLink || player.tournamentPostingLink;

                        return (
                          <tr
                            key={player.id}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              isVisible ? 'bg-transparent' : 'opacity-50 bg-slate-950/40'
                            }`}
                          >
                            {/* Checkbox for Linktree Visibility */}
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => onToggleNickname(player.chNickname)}
                                className="text-amber-400 hover:text-amber-300 transition-colors"
                                title={
                                  isVisible
                                    ? 'Visible on public Linktree (click to hide)'
                                    : 'Hidden from Linktree (click to show)'
                                }
                              >
                                {isVisible ? (
                                  <CheckSquare className="w-5 h-5 text-amber-400 inline" />
                                ) : (
                                  <Square className="w-5 h-5 text-slate-600 inline" />
                                )}
                              </button>
                            </td>

                            {/* Nickname & Full Name */}
                            <td className="p-3.5 font-bold text-white">
                              <div className="flex items-center gap-3">
                                {player.avatarUrl ? (
                                  <img
                                    src={player.avatarUrl}
                                    alt={player.chNickname}
                                    className="w-8 h-8 rounded-full object-cover border border-amber-400 shrink-0 shadow-sm"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-black text-amber-400 shrink-0">
                                    {player.chNickname.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm text-white font-extrabold">
                                      {player.chNickname}
                                    </span>
                                    {isVisible ? (
                                      <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                                        ON LINKTREE
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-slate-800 text-slate-400">
                                        HIDDEN
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleDisplayOnlyThisCH(player.chNickname)}
                                      className={`px-2 py-0.5 rounded-full text-[9px] font-black transition-colors flex items-center gap-1 ${
                                        selectedNicknames.length === 1 && selectedNicknames[0].toLowerCase() === player.chNickname.toLowerCase()
                                          ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs'
                                          : 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                                      }`}
                                      title={`Display ONLY "${player.chNickname}" on the public Linktree view`}
                                    >
                                      <Eye className="w-2.5 h-2.5" />
                                      <span>{selectedNicknames.length === 1 && selectedNicknames[0].toLowerCase() === player.chNickname.toLowerCase() ? 'ONLY THIS CH' : 'DISPLAY ONLY'}</span>
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {player.fullName && (
                                      <p className="text-[11px] text-slate-400 font-normal">
                                        {player.fullName}
                                      </p>
                                    )}
                                    <a
                                      href={
                                        player.facebookProfileUrl ||
                                        `https://www.facebook.com/${player.chNickname.toLowerCase().replace(/[^a-z0-9]/g, '')}.mlbb`
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-blue-400 hover:underline inline-flex items-center gap-0.5 font-bold"
                                      title="Open Facebook Profile"
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" />
                                      <span>FB Profile</span>
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Area */}
                            <td className="p-3.5">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-amber-300 border border-slate-700">
                                {player.area}
                              </span>
                            </td>

                            {/* Live Slot Capacity Stepper */}
                            <td className="p-3.5 text-center">
                              <div className="inline-flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdatePlayerCapacity(
                                      player.id,
                                      Math.max(0, player.teamsRegistered - 1),
                                      player.maxTeams
                                    )
                                  }
                                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs"
                                  title="Decrease 1 team"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>

                                <span
                                  className={`px-3 py-1 text-xs font-mono font-black rounded-lg ${
                                    isFull
                                      ? 'bg-red-950 text-red-300 border border-red-500/50'
                                      : 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                                  }`}
                                >
                                  {player.teamsRegistered}/{player.maxTeams}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdatePlayerCapacity(
                                      player.id,
                                      Math.min(player.maxTeams, player.teamsRegistered + 1),
                                      player.maxTeams
                                    )
                                  }
                                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs"
                                  title="Increase 1 team"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>

                                {/* Quick Mark Full / Open Toggle */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdatePlayerCapacity(
                                      player.id,
                                      isFull ? 0 : player.maxTeams,
                                      player.maxTeams
                                    )
                                  }
                                  className={`ml-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isFull
                                      ? 'bg-emerald-900/60 hover:bg-emerald-900 text-emerald-300'
                                      : 'bg-red-900/60 hover:bg-red-900 text-red-300'
                                  }`}
                                  title={isFull ? 'Reopen slots to 0/16 Open' : 'Mark as 16/16 Full'}
                                >
                                  {isFull ? 'Reopen' : 'Make Full'}
                                </button>
                              </div>
                            </td>

                            {/* Form Link */}
                            <td className="p-3.5 max-w-xs">
                              {regLink ? (
                                <a
                                  href={regLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-amber-400 hover:underline flex items-center gap-1 truncate text-xs"
                                >
                                  <LinkIcon className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{regLink}</span>
                                </a>
                              ) : (
                                <span className="text-slate-500 text-xs italic">No link</span>
                              )}
                              {player.tournamentResponseSheet && (
                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                  Sheet: {player.tournamentResponseSheet}
                                </p>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPlayer(player);
                                    setEditForm({
                                      chNickname: player.chNickname,
                                      area: player.area,
                                      fullName: player.fullName,
                                      facebookProfileUrl: player.facebookProfileUrl || '',
                                      registrationFormLink: regLink,
                                      tournamentResponseSheet: player.tournamentResponseSheet || '',
                                      teamsRegistered: player.teamsRegistered,
                                      maxTeams: player.maxTeams,
                                      avatarUrl: player.avatarUrl || '',
                                    });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Edit details"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Delete "${player.chNickname}" from master directory?`
                                      )
                                    ) {
                                      onDeletePlayer(player.id);
                                      setStatusMessage(`Deleted "${player.chNickname}".`);
                                    }
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
                                  title="Delete CH"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Google Forms Header Banner */}
        {activeTab === 'banner' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-amber-400" />
                  <span>Tournament Header Banner & Branding</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload your own tournament banner picture, configure branding text, and customize layout.
                </p>
              </div>

              {bgConfig.uploadedBannerDataUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateBgConfig({
                      ...bgConfig,
                      uploadedBannerDataUrl: undefined,
                      bannerFileName: undefined,
                      type: 'preset',
                      presetId: bgConfig.presetId || 'preset-esports-arena',
                    });
                    setStatusMessage('Reverted uploaded banner back to esports preset.');
                  }}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Custom Banner</span>
                </button>
              )}
            </div>

            {uploadError && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Live Banner Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Live Header Preview</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  Reflects public Linktree appearance
                </span>
              </div>

              <div
                className={`relative w-full rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-[#0b0e14] transition-all duration-200 ${
                  bgConfig.bannerHeight === 'compact'
                    ? 'h-40 sm:h-48'
                    : bgConfig.bannerHeight === 'tall'
                    ? 'h-60 sm:h-72'
                    : 'h-48 sm:h-56'
                }`}
              >
                {/* Banner Image */}
                <img
                  src={
                    bgConfig.uploadedBannerDataUrl ||
                    (bgConfig.type === 'custom' && bgConfig.customUrl) ||
                    (HEADER_PRESETS.find((p) => p.id === bgConfig.presetId) || HEADER_PRESETS[0]).imageUrl
                  }
                  alt="Banner Preview"
                  className={`w-full h-full transition-all duration-300 ${
                    bgConfig.bannerFit === 'contain' ? 'object-contain' : 'object-cover'
                  }`}
                />

                {/* Darkness Overlay */}
                <div
                  className="absolute inset-0 bg-slate-950"
                  style={{ opacity: bgConfig.overlayDarkness ?? 0.35 }}
                />

                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />

                {/* Preview Overlay Info */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300/40 flex items-center justify-center text-slate-950 font-black shadow-lg shrink-0 overflow-hidden">
                      {bgConfig.avatarType === 'custom' && bgConfig.avatarCustomUrl ? (
                        <img
                          src={bgConfig.avatarCustomUrl}
                          alt="Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>CH</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white tracking-wide truncate drop-shadow-md">
                        {bgConfig.title || 'MLBB COMMUNITY HEROES'}
                      </h4>
                      <p className="text-[11px] text-amber-300/90 font-semibold truncate drop-shadow-sm">
                        {bgConfig.subtitle || `${currentMonthName} ${currentYear} • Official Tournament Portal`}
                      </p>
                    </div>
                  </div>

                  {bgConfig.uploadedBannerDataUrl && (
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-[10px] font-extrabold text-emerald-300">
                      CUSTOM BANNER ACTIVE
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Banner Upload Card & Direct URL */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
              {/* Box 1: File Upload (Drag and drop or Browse) */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Upload Banner Picture File</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">JPG, PNG, WebP</span>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingBanner(true);
                  }}
                  onDragLeave={() => setIsDraggingBanner(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingBanner(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleBannerFileUpload(file);
                  }}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                    isDraggingBanner
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isProcessingBanner}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBannerFileUpload(file);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    title="Click or drag to upload banner picture"
                  />

                  <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      {isProcessingBanner ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <FileImage className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {isProcessingBanner ? 'Compressing & saving banner...' : 'Click to browse or drop picture here'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Recommended: 1600×600 or 1200×400 (Auto-compressed for fast loading)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Uploaded File Status */}
                {bgConfig.uploadedBannerDataUrl && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-semibold text-emerald-300 truncate">
                        {bgConfig.bannerFileName || 'Custom banner loaded'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateBgConfig({
                          ...bgConfig,
                          uploadedBannerDataUrl: undefined,
                          bannerFileName: undefined,
                        });
                        setStatusMessage('Cleared uploaded banner picture.');
                      }}
                      className="text-[11px] font-bold text-red-400 hover:text-red-300 ml-2 shrink-0 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Direct Image URL Option */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400">
                    Or Use Direct Image Link (Google Forms banner URL):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customImageUrlInput}
                      onChange={(e) => setCustomImageUrlInput(e.target.value)}
                      placeholder="https://lh3.googleusercontent.com/... or image link"
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customImageUrlInput.trim()) {
                          onUpdateBgConfig({
                            ...bgConfig,
                            type: 'custom',
                            customUrl: customImageUrlInput.trim(),
                            uploadedBannerDataUrl: undefined,
                          });
                          setStatusMessage('Direct banner URL applied!');
                        }
                      }}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-colors cursor-pointer"
                    >
                      Apply Link
                    </button>
                  </div>
                </div>
              </div>

              {/* Box 2: Tournament Branding & Text */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-black text-white flex items-center gap-2">
                  <Type className="w-4 h-4 text-amber-400" />
                  <span>Tournament Title & Subtitle</span>
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Main Tournament Title:
                    </label>
                    <input
                      type="text"
                      value={bgConfig.title ?? ''}
                      onChange={(e) =>
                        onUpdateBgConfig({
                          ...bgConfig,
                          title: e.target.value,
                        })
                      }
                      placeholder="e.g. MLBB COMMUNITY HEROES"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Header Subtitle / Tagline:
                    </label>
                    <input
                      type="text"
                      value={bgConfig.subtitle ?? ''}
                      onChange={(e) =>
                        onUpdateBgConfig({
                          ...bgConfig,
                          subtitle: e.target.value,
                        })
                      }
                      placeholder="e.g. March 2026 • Official Tournament Portal"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Bio / Instructions for Players:
                    </label>
                    <textarea
                      rows={2}
                      value={bgConfig.description ?? ''}
                      onChange={(e) =>
                        onUpdateBgConfig({
                          ...bgConfig,
                          description: e.target.value,
                        })
                      }
                      placeholder="e.g. MLBB PH - Community Heroes, leading MLBB community events for the Filipinos."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
                      <span>Facebook Page Link (Follow Button):</span>
                      <span className="text-[11px] text-blue-400 font-normal">Follows on Facebook</span>
                    </label>
                    <input
                      type="url"
                      value={bgConfig.facebookPageUrl ?? 'https://www.facebook.com/MLBBPHCommunityHeroes'}
                      onChange={(e) =>
                        onUpdateBgConfig({
                          ...bgConfig,
                          facebookPageUrl: e.target.value,
                        })
                      }
                      placeholder="https://www.facebook.com/MLBBPHCommunityHeroes"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Followers Count:
                      </label>
                      <input
                        type="text"
                        value={bgConfig.followersText ?? '286K followers • 5 following'}
                        onChange={(e) =>
                          onUpdateBgConfig({
                            ...bgConfig,
                            followersText: e.target.value,
                          })
                        }
                        placeholder="286K followers • 5 following"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Category Tag:
                      </label>
                      <input
                        type="text"
                        value={bgConfig.categoryText ?? 'Interest'}
                        onChange={(e) =>
                          onUpdateBgConfig({
                            ...bgConfig,
                            categoryText: e.target.value,
                          })
                        }
                        placeholder="Interest"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Layout Controls: Banner Height, Fit, Darkness, & Avatar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Banner Height */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <label className="block text-xs font-black text-white">
                  Banner Height
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['compact', 'standard', 'tall'] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onUpdateBgConfig({ ...bgConfig, bannerHeight: h })}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all capitalize cursor-pointer ${
                        (bgConfig.bannerHeight || 'standard') === h
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500">
                  Adjust vertical size of the top banner.
                </p>
              </div>

              {/* Banner Fit & Darkness Overlay */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-white">
                    Darkness Overlay
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {Math.round((bgConfig.overlayDarkness ?? 0.35) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.05"
                  value={bgConfig.overlayDarkness ?? 0.35}
                  onChange={(e) =>
                    onUpdateBgConfig({
                      ...bgConfig,
                      overlayDarkness: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400">Image Fit:</span>
                  <div className="flex gap-1.5">
                    {(['cover', 'contain'] as const).map((fit) => (
                      <button
                        key={fit}
                        type="button"
                        onClick={() => onUpdateBgConfig({ ...bgConfig, bannerFit: fit })}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all capitalize cursor-pointer ${
                          (bgConfig.bannerFit || 'cover') === fit
                            ? 'bg-slate-700 text-white border-amber-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {fit}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tournament Logo / Avatar */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <label className="block text-xs font-black text-white">
                  Tournament Logo / Avatar
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300/40 flex items-center justify-center text-slate-950 font-black shrink-0 overflow-hidden">
                    {bgConfig.avatarType === 'custom' && bgConfig.avatarCustomUrl ? (
                      <img
                        src={bgConfig.avatarCustomUrl}
                        alt="Logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>CH</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="block w-full">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors">
                        {isProcessingAvatar ? 'Uploading...' : 'Upload Logo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isProcessingAvatar}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleAvatarFileUpload(file);
                        }}
                        className="hidden"
                      />
                    </label>

                    {bgConfig.avatarType === 'custom' && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateBgConfig({
                            ...bgConfig,
                            avatarType: 'default',
                            avatarCustomUrl: undefined,
                          })
                        }
                        className="text-[10px] text-slate-400 hover:text-amber-400 underline block"
                      >
                        Reset to default CH shield
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Esports Presets */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-amber-400" />
                  <span>Or Pick from Curated Esports Presets</span>
                </h4>
                <span className="text-[11px] text-slate-500">
                  Instant one-click backgrounds
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {HEADER_PRESETS.map((preset) => {
                  const isSelected =
                    !bgConfig.uploadedBannerDataUrl &&
                    bgConfig.type === 'preset' &&
                    bgConfig.presetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        onUpdateBgConfig({
                          ...bgConfig,
                          type: 'preset',
                          presetId: preset.id,
                          uploadedBannerDataUrl: undefined,
                          bannerFileName: undefined,
                        });
                        setStatusMessage(`Preset "${preset.name}" applied.`);
                      }}
                      className={`cursor-pointer rounded-xl border-2 overflow-hidden transition-all group ${
                        isSelected
                          ? 'border-amber-400 ring-2 ring-amber-500/50 shadow-lg scale-[1.02]'
                          : 'border-slate-800 hover:border-slate-700 hover:scale-[1.01]'
                      }`}
                    >
                      <div className="h-20 bg-slate-950 overflow-hidden relative">
                        <img
                          src={preset.imageUrl}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="p-2 bg-slate-950 text-[11px] font-bold text-slate-200 truncate">
                        {preset.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Google Sheets & Hourly Sync */}
        {activeTab === 'sheets' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                  <span>Google Sheets Connection & Hourly Sync</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Connect master DIY preparation sheet and configure hourly capacity tracking.
                </p>
              </div>

              <button
                onClick={onRunHourlyDetection}
                disabled={isDetecting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isDetecting ? 'animate-spin' : ''}`} />
                <span>{isDetecting ? 'Detecting Slots...' : 'Run Hourly Sync Now'}</span>
              </button>
            </div>

            {/* Google Editor Authentication (For Restricted / Private Sheets) */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">Google Editor Authorization</span>
                    {googleUser ? (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                        Connected as Editor
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-bold">
                        Editor Sign-in Required for Private Sheets
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                    {googleUser
                      ? `Signed in as ${googleUser.email}. The app now has secure editor permission to read your private tournament spreadsheet and registration responses.`
                      : 'Because your Google Sheet is Restricted to your Google Account, click below to sign in with your editor account so the app can sync all tabs and response counts securely.'}
                  </p>
                </div>

                <div className="shrink-0">
                  {onGoogleSignIn && onGoogleSignOut && (
                    <GoogleSignInButton
                      user={googleUser || null}
                      isLoading={isGoogleSigningIn}
                      onSignIn={onGoogleSignIn}
                      onSignOut={onGoogleSignOut}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Master Sheet URL */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                Master Google Sheet URL:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={spreadsheetUrl}
                  onChange={(e) => onUpdateSpreadsheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSyncingLiveSheet || syncStatus?.loading}
                    onClick={async () => {
                      if (!onSyncSpreadsheet) return;
                      setIsSyncingLiveSheet(true);
                      const ok = await onSyncSpreadsheet(spreadsheetUrl, activeTabName);
                      setIsSyncingLiveSheet(false);
                      if (ok) {
                        setStatusMessage('Google Sheet synced successfully! Tournament directory updated.');
                      }
                    }}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLiveSheet || syncStatus?.loading ? 'animate-spin' : ''}`} />
                    <span>{isSyncingLiveSheet || syncStatus?.loading ? 'Syncing...' : 'Sync from Sheet'}</span>
                  </button>
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Sheet</span>
                  </a>
                </div>
              </div>

              {/* Status Message from live sync */}
              {syncStatus?.error && (
                <div className="p-3 bg-red-950/70 border border-red-800/80 rounded-xl text-xs text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="font-bold shrink-0">Sync Notice:</span>
                    <span>{syncStatus.error}</span>
                  </div>
                  {!googleUser && onGoogleSignIn && (
                    <button
                      type="button"
                      onClick={onGoogleSignIn}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shrink-0 self-start sm:self-auto"
                    >
                      Sign in with Google
                    </button>
                  )}
                </div>
              )}
              {syncStatus?.successMessage && (
                <div className="p-3 bg-emerald-950/70 border border-emerald-800/80 rounded-xl text-xs text-emerald-200 flex items-start gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{syncStatus.successMessage}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                The master sheet contains tabs named by date (e.g. <code>September 5, 2026</code>). All event slots and capacities are dynamically imported directly from the spreadsheet and registration forms.
              </p>
            </div>

            {/* Direct Paste Importer: Copy rows from Google Sheets or Excel directly */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-amber-400" />
                    <span>Direct Paste / Offline Sheet Import</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Copy columns from your Google Sheet or Excel and paste them here to import immediately without needing public link permissions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDirectPasteBox(!showDirectPasteBox)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold"
                >
                  {showDirectPasteBox ? 'Hide Paste Box' : 'Open Paste Box'}
                </button>
              </div>

              {showDirectPasteBox && (
                <div className="space-y-2 pt-2 border-t border-slate-800 animate-fadeIn">
                  <textarea
                    rows={5}
                    value={pastedSheetText}
                    onChange={(e) => setPastedSheetText(e.target.value)}
                    placeholder="Paste rows here (e.g. Columns: Active, Area, Full Name, Nickname, Registration Form Link, Response Sheet)..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder:text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Format: Tab-separated or comma-separated rows. Header row is detected automatically.
                    </span>
                    <button
                      type="button"
                      disabled={!pastedSheetText.trim() || syncStatus?.loading}
                      onClick={async () => {
                        if (!onImportRawSheetData) return;
                        const ok = await onImportRawSheetData(pastedSheetText);
                        if (ok) {
                          setPastedSheetText('');
                          setShowDirectPasteBox(false);
                          setStatusMessage('Pasted rows imported successfully!');
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Import Pasted Rows</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Detected Tabs */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-white">Detected Tabs in Master Sheet:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {detectedTabs.map((tab) => (
                  <button
                    key={tab.name}
                    onClick={() => {
                      onSelectTab(tab.name);
                      setStatusMessage(`Selected tab "${tab.name}".`);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      activeTabName === tab.name
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md font-bold'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs truncate">{tab.name}</span>
                      {tab.isCurrentMonth && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Hourly Sync Info Box */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Automated Hourly Slot Counting</span>
              </div>
              <p>
                Every hour, the background system scans each Community Head&apos;s Google Forms response
                spreadsheet (Column G) to count the number of registered squads. When response rows
                reach 16, the Linktree button updates to <strong>16/16 FULL</strong> automatically!
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: Live Linktree Preview Side-by-Side */}
        {activeTab === 'preview' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amber-400" />
                  <span>Live Linktree Preview</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  This is the exact view seen by mobile and desktop visitors.
                </p>
              </div>
              <button
                onClick={onViewPublicLinktree}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Full View</span>
              </button>
            </div>

            <div className="flex justify-center p-2 sm:p-6 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="w-full max-w-md border-4 border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
                <LinktreeView
                  players={players}
                  selectedNicknames={selectedNicknames}
                  bgConfig={bgConfig}
                  onUpdateBgConfig={onUpdateBgConfig}
                  currentMonthName={currentMonthName}
                  currentYear={currentYear}
                  lastHourlySync={lastHourlySync}
                  nextSyncCountdown={nextSyncCountdown}
                  onOpenQR={onOpenQR}
                  onOpenAdminLogin={() => {}}
                  isStaffMode={true}
                  onSwitchToAdminDashboard={() => setActiveTab('directory')}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
