import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  AlertCircle,
  Clock,
  Radio,
  SlidersHorizontal,
  Camera,
  Settings2,
  LogIn,
  Shield,
  ShieldCheck,
  X,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { CHPlayer, HeaderBackgroundConfig } from '../types';
import { HEADER_PRESETS } from '../data/headerPresets';
import { DEFAULT_CH_AVATAR } from '../data/defaultAvatar';
import { HeaderBannerModal } from './HeaderBannerModal';
import { compressImageFile } from '../utils/imageUtils';
import { CHProfileModal } from './CHProfileModal';
import { TournamentRow } from './TournamentRow';

interface LinktreeViewProps {
  players: CHPlayer[];
  selectedNicknames: string[];
  bgConfig: HeaderBackgroundConfig;
  onUpdateBgConfig: (newConfig: HeaderBackgroundConfig) => void;
  currentMonthName: string;
  currentYear: number;
  lastHourlySync: string;
  nextSyncCountdown: string;
  onOpenQR: (player: CHPlayer) => void;
  onOpenAdminLogin: () => void;
  isStaffMode: boolean;
  onSwitchToAdminDashboard: () => void;
  onExitStaffMode?: () => void;
  onSelectAllNicknames?: (select: boolean) => void;
}

export const LinktreeView: React.FC<LinktreeViewProps> = ({
  players,
  selectedNicknames,
  bgConfig,
  onUpdateBgConfig,
  currentMonthName,
  currentYear,
  lastHourlySync,
  onOpenQR,
  onOpenAdminLogin,
  isStaffMode,
  onSwitchToAdminDashboard,
  onExitStaffMode,
  onSelectAllNicknames,
}) => {
  const [selectedProfilePlayer, setSelectedProfilePlayer] = useState<CHPlayer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [showOpenOnly, setShowOpenOnly] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const directBannerInputRef = useRef<HTMLInputElement | null>(null);
  const directAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const secretClickCountRef = useRef(0);
  const secretClickTimeoutRef = useRef<number | null>(null);

  const handleFooterSecretClick = () => {
    secretClickCountRef.current += 1;
    if (secretClickTimeoutRef.current) {
      window.clearTimeout(secretClickTimeoutRef.current);
    }
    if (secretClickCountRef.current >= 5) {
      secretClickCountRef.current = 0;
      onOpenAdminLogin();
      return;
    }
    secretClickTimeoutRef.current = window.setTimeout(() => {
      secretClickCountRef.current = 0;
    }, 2000);
  };

  const handleDirectAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const result = await compressImageFile(file, 400, 400, 0.88);
      onUpdateBgConfig({
        ...bgConfig,
        avatarType: 'custom',
        avatarCustomUrl: result.dataUrl,
        avatarFileName: result.originalName,
      });
    } catch (err) {
      console.error('Failed to upload avatar', err);
    } finally {
      setIsUploadingAvatar(false);
      if (directAvatarInputRef.current) {
        directAvatarInputRef.current.value = '';
      }
    }
  };

  // Filter players selected to be visible on Linktree (handles single CH selection & case-insensitivity)
  const linktreePlayers = useMemo(() => {
    if (!selectedNicknames || selectedNicknames.length === 0) {
      return players;
    }
    const cleanSelected = new Set(selectedNicknames.map((n) => n.trim().toLowerCase()));
    return players.filter((p) => cleanSelected.has(p.chNickname.trim().toLowerCase()));
  }, [players, selectedNicknames]);

  // Extract unique areas/cities for the city filter dropdown
  const areas = useMemo(() => {
    const list = Array.from(
      new Set(players.map((p) => p.area?.trim()).filter(Boolean) as string[])
    );
    return ['ALL', ...list.sort()];
  }, [players]);

  // Filtered list for display based on search query, city dropdown, and open filter
  const filteredPlayers = useMemo(() => {
    return linktreePlayers.filter((player) => {
      if (selectedArea !== 'ALL' && player.area?.toLowerCase() !== selectedArea.toLowerCase()) {
        return false;
      }
      if (showOpenOnly && (player.teamsRegistered || 0) >= (player.maxTeams || 16)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nickMatch = player.chNickname.toLowerCase().includes(q);
        const nameMatch = player.fullName?.toLowerCase().includes(q);
        const areaMatch = player.area?.toLowerCase().includes(q);
        if (!nickMatch && !nameMatch && !areaMatch) return false;
      }
      return true;
    });
  }, [linktreePlayers, selectedArea, showOpenOnly, searchQuery]);

  // Stats
  const fullCount = useMemo(
    () => linktreePlayers.filter((p) => (p.teamsRegistered || 0) >= (p.maxTeams || 16)).length,
    [linktreePlayers]
  );
  const openCount = linktreePlayers.length - fullCount;

  // Banner image URL
  const bannerImageUrl = useMemo(() => {
    if (bgConfig.type === 'custom') {
      if (bgConfig.uploadedBannerDataUrl) return bgConfig.uploadedBannerDataUrl;
      if (bgConfig.customUrl) return bgConfig.customUrl;
    }
    const preset =
      HEADER_PRESETS.find((p) => p.id === bgConfig.presetId) || HEADER_PRESETS[0];
    return preset.imageUrl;
  }, [bgConfig]);

  const handleDirectBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    try {
      const result = await compressImageFile(file, 1920, 960, 0.88);
      onUpdateBgConfig({
        ...bgConfig,
        type: 'custom',
        uploadedBannerDataUrl: result.dataUrl,
        bannerFileName: result.originalName,
      });
    } catch (err) {
      console.error('Failed to upload banner', err);
    } finally {
      setIsUploadingBanner(false);
      if (directBannerInputRef.current) {
        directBannerInputRef.current.value = '';
      }
    }
  };

  const bannerHeightClass = useMemo(() => {
    if (bgConfig.bannerHeight === 'compact') return 'h-16 sm:h-24 md:h-32';
    if (bgConfig.bannerHeight === 'tall') return 'h-24 sm:h-36 md:h-44';
    return 'h-20 sm:h-32 md:h-36';
  }, [bgConfig.bannerHeight]);

  const avatarSrc = useMemo(() => {
    if (bgConfig.avatarType === 'custom' && bgConfig.avatarCustomUrl) {
      return bgConfig.avatarCustomUrl;
    }
    return DEFAULT_CH_AVATAR;
  }, [bgConfig]);

  return (
    <div className="relative min-h-screen w-full bg-[#0a0d16] text-slate-100 flex flex-col font-sans overflow-x-hidden">
      {/* 3D Glassmorphic Ambient Refraction Orbs */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-b from-amber-500/12 via-yellow-500/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 -left-32 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-20 -right-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Hidden file inputs for staff mode uploads */}
      <input
        type="file"
        ref={directBannerInputRef}
        onChange={handleDirectBannerUpload}
        accept="image/*"
        className="hidden"
        tabIndex={-1}
      />
      <input
        type="file"
        ref={directAvatarInputRef}
        onChange={handleDirectAvatarUpload}
        accept="image/*"
        className="hidden"
        tabIndex={-1}
      />

      {/* Staff Mode Floating Action Banner */}
      {isStaffMode && (
        <aside aria-label="Staff Mode Controls" className="w-full bg-slate-900/95 border-b border-amber-500/40 px-3 sm:px-6 py-2.5 shadow-md sticky top-0 z-40 backdrop-blur-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-400">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Staff preview mode active</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSwitchToAdminDashboard}
                className="btn-3d-gold px-3.5 py-1.5 rounded-xl text-slate-950 text-xs font-black cursor-pointer"
              >
                Dashboard
              </button>
              {onExitStaffMode && (
                <button
                  type="button"
                  onClick={onExitStaffMode}
                  className="btn-3d-glass px-2.5 py-1.5 rounded-xl text-slate-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Main Single-Scroll Column */}
      <main className="w-full max-w-3xl mx-auto px-2 sm:px-4 md:px-6 py-2.5 sm:py-5 flex flex-col items-center min-w-0">
        {/* Tournament Page Header: Compact 3D Glass Surface */}
        <section aria-label="Tournament Page Header" className="w-full glass-3d rounded-xl sm:rounded-2xl border border-white/12 shadow-xl overflow-hidden mb-2.5 sm:mb-4">
          {/* Cover Photo Banner */}
          <div className={`relative w-full ${bannerHeightClass} bg-slate-950 overflow-hidden group`}>
            <img
              src={bannerImageUrl}
              alt="Community Heroes Tournament Cover"
              className={`w-full h-full transition-transform duration-500 ${
                bgConfig.bannerFit === 'contain'
                  ? 'object-contain bg-slate-950'
                  : 'object-cover object-center'
              }`}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80';
              }}
            />
            {bgConfig.overlayDarkness && bgConfig.overlayDarkness > 0 ? (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: `rgba(0, 0, 0, ${bgConfig.overlayDarkness})`,
                }}
              />
            ) : null}

            {/* Date Tag in 3D glass pill */}
            <div className="absolute top-2 left-2 btn-3d-glass text-amber-300 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>
                {currentMonthName} {currentYear}
              </span>
            </div>

            {/* Top Right Live Sync & Sign In */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
              <div className="btn-3d-glass text-emerald-400 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                <span className="hidden xs:inline">Live sync</span>
              </div>
              {!isStaffMode ? (
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="btn-3d-glass text-slate-200 hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm cursor-pointer h-7 sm:h-8"
                  title="Sign In for Administrator Access"
                  aria-label="Staff sign in"
                >
                  <LogIn className="w-3 h-3 text-amber-400" />
                  <span>Sign in</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSwitchToAdminDashboard}
                  className="btn-3d-gold text-slate-950 text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm cursor-pointer h-7 sm:h-8"
                  title="Open Admin Management Console"
                >
                  <Shield className="w-3 h-3 text-slate-950" />
                  <span>Admin panel</span>
                </button>
              )}
            </div>

            {/* Staff Photo Controls */}
            {isStaffMode && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10">
                <button
                  type="button"
                  onClick={() => directBannerInputRef.current?.click()}
                  disabled={isUploadingBanner}
                  className="px-2 py-1 rounded-lg bg-slate-950/85 hover:bg-slate-900 text-white border border-white/20 text-[11px] font-bold transition-all backdrop-blur-md shadow-sm flex items-center gap-1 cursor-pointer h-7"
                  title="Upload cover photo"
                >
                  <Camera className="w-3 h-3 text-white" />
                  <span>{isUploadingBanner ? 'Uploading...' : 'Cover'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(true)}
                  className="p-1 rounded-lg bg-slate-950/85 hover:bg-slate-900 text-slate-200 border border-white/20 text-xs transition-all backdrop-blur-md shadow-sm flex items-center justify-center cursor-pointer h-7 w-7"
                  title="Branding Settings"
                  aria-label="Branding Settings"
                >
                  <Settings2 className="w-3.5 h-3.5 text-amber-400" />
                </button>
              </div>
            )}
          </div>

          {/* Profile Bar below cover - Streamlined & Compact */}
          <div className="px-3 sm:px-5 pt-0 pb-2.5 sm:pb-3.5">
            <div className="flex items-end justify-between gap-2.5 -mt-6 sm:-mt-8">
              {/* Left: Avatar + Details in compact row */}
              <div className="flex items-end gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full p-0.5 bg-[#101626] border-2 sm:border-3 border-[#101626] shadow-lg overflow-hidden relative">
                    <img
                      src={avatarSrc}
                      alt="Page Profile"
                      className="w-full h-full object-cover rounded-full bg-slate-900"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_CH_AVATAR;
                      }}
                    />
                  </div>
                  <span
                    className="absolute bottom-0.5 right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-400 border-2 border-[#101626] shadow-[0_0_6px_#34d399]"
                    title="Active Now"
                  />
                  {isStaffMode && (
                    <button
                      type="button"
                      onClick={() => directAvatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute bottom-0 left-0 p-1 rounded-full bg-slate-900/90 hover:bg-blue-600 text-white border-2 border-[#101626] shadow-sm transition-colors cursor-pointer"
                      title="Change profile picture"
                      aria-label="Change profile picture"
                    >
                      <Camera className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Text details */}
                <div className="min-w-0 flex-1 pb-0.5">
                  <div className="flex items-center gap-1 flex-wrap">
                    <h1 className="text-sm sm:text-lg font-black text-white tracking-tight leading-tight truncate">
                      {bgConfig.title || 'MLBB PH - Community Heroes'}
                    </h1>
                    <span className="inline-flex items-center justify-center text-[#1877F2] shrink-0" title="Verified Page">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                    </span>
                  </div>

                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate mt-0.5">
                    Official MLBB Tournament Directory
                  </p>
                </div>
              </div>

              {/* Right: Normal-sized Designed Follow Button (PRL Automated Style) */}
              <div className="shrink-0 pb-0.5">
                <a
                  href={bgConfig.facebookPageUrl || 'https://www.facebook.com/MLBBPHCommunityHeroes'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-3d-blue h-8 sm:h-8.5 px-2.5 sm:px-3.5 rounded-lg text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm no-underline select-none"
                  title="Follow MLBB PH Community Heroes on Facebook"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="hidden xs:inline">Follow on FB</span>
                  <span className="xs:hidden">Follow</span>
                </a>
              </div>
            </div>

            {/* Status Divider Ribbon - Compact Single Line */}
            <div className="mt-2 pt-1.5 sm:pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1 text-[10px] sm:text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{openCount} Open</span>
                </span>
                {fullCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-400 font-medium text-[10px] sm:text-[11px]">
                    {fullCount} Full
                  </span>
                )}
              </div>
              <div className="text-slate-400 text-[10px] sm:text-[11px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Synced {lastHourlySync}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Single CH Display Only Banner if filtered */}
        {linktreePlayers.length === 1 && players.length > 1 && (
          <div className="w-full mb-4 p-4 rounded-2xl glass-3d border border-amber-400/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-400 text-slate-950 shrink-0 shadow-sm">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                  Featured community head portal
                </span>
                <p className="text-xs sm:text-sm font-extrabold text-white">
                  Showing tournament registration for{' '}
                  <span className="text-amber-300 underline underline-offset-2">
                    {linktreePlayers[0].chNickname}
                  </span>{' '}
                  ({linktreePlayers[0].area})
                </p>
              </div>
            </div>
            {onSelectAllNicknames && (
              <button
                type="button"
                onClick={() => onSelectAllNicknames(true)}
                className="btn-3d-glass min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-amber-300 shrink-0 cursor-pointer"
              >
                View all community heads ({players.length})
              </button>
            )}
          </div>
        )}

        {/* Search input and City filter dropdown above the list: Compact 3D Glass Panels */}
        <section aria-label="Tournament Search and Filters" className="w-full space-y-2 mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search community head or city..."
                className="w-full h-9 sm:h-10 pl-9 pr-8 py-1.5 glass-inset-panel rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400 transition-all shadow-inner"
                aria-label="Search community heads by nickname or city"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search query"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* City / Area Filter Dropdown + Open Only Toggle Side-by-Side */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex-1 sm:w-44">
                <MapPin className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full h-9 sm:h-10 pl-8 pr-7 py-1.5 glass-inset-panel rounded-xl text-xs sm:text-sm text-slate-200 font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400 transition-all appearance-none cursor-pointer"
                  aria-label="Filter by city or province"
                >
                  <option value="ALL" className="bg-[#0f1320] text-white">All Cities ({players.length})</option>
                  {areas
                    .filter((a) => a !== 'ALL')
                    .map((area) => (
                      <option key={area} value={area} className="bg-[#0f1320] text-white">
                        {area}
                      </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>

              {/* Open Slots Only Toggle */}
              <button
                type="button"
                onClick={() => setShowOpenOnly(!showOpenOnly)}
                className={`h-9 sm:h-10 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                  showOpenOnly
                    ? 'btn-3d-gold text-slate-950 shadow-sm'
                    : 'btn-3d-glass text-slate-200 hover:text-white'
                }`}
                aria-pressed={showOpenOnly}
                aria-label="Filter to open tournament slots only"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Open only</span>
              </button>
            </div>
          </div>
        </section>

        {/* Screen 1: The List View of Tournament Community Heads */}
        <section aria-label="Tournament Community Heads List" className="w-full space-y-1.5 sm:space-y-2">
          {filteredPlayers.length === 0 ? (
            <div className="w-full bg-[#111622] border border-slate-800 rounded-2xl p-8 text-center space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-400" />
              <p className="font-bold text-base text-white">No community heads found</p>
              <p className="text-xs sm:text-sm text-slate-300">
                Try clearing your search query or selecting &ldquo;All Cities&rdquo;.
              </p>
              {(searchQuery || selectedArea !== 'ALL' || showOpenOnly) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedArea('ALL');
                    setShowOpenOnly(false);
                  }}
                  className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-bold text-amber-300 border border-slate-700 transition-colors"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <TournamentRow
                key={player.id}
                player={player}
                onOpenProfile={(p) => setSelectedProfilePlayer(p)}
                onOpenQR={(p) => onOpenQR(p)}
              />
            ))
          )}
        </section>

        {/* Footer */}
        <footer className="w-full mt-8 pt-6 border-t border-slate-800/80 text-center space-y-3">
          <p className="text-xs text-slate-400">
            Mobile Legends: Bang Bang Community Heroes Official Tournament Portal
          </p>

          <div className="flex items-center justify-center gap-3 text-xs font-medium text-slate-400">
            <a
              href="https://m.mobilelegends.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-400 transition-colors"
            >
              MLBB Official
            </a>
            <span>•</span>
            <a
              href={bgConfig.facebookPageUrl || 'https://www.facebook.com/MLBBPHCommunityHeroes'}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-400 transition-colors"
            >
              Community Facebook
            </a>
          </div>

          {isStaffMode && (
            <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={onSwitchToAdminDashboard}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 cursor-pointer py-1.5 px-3.5 rounded-xl bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 transition-colors min-h-[44px]"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Open Admin Management Console</span>
              </button>
              {onExitStaffMode && (
                <button
                  type="button"
                  onClick={onExitStaffMode}
                  className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer py-1.5 px-3 rounded-xl hover:bg-slate-900 transition-colors min-h-[44px]"
                >
                  <X className="w-4 h-4" />
                  <span>Exit Staff Mode</span>
                </button>
              )}
            </div>
          )}

          {/* 5-click easter egg for organizers to unlock staff console */}
          <div className="pt-2">
            <p
              onClick={handleFooterSecretClick}
              className="text-xs text-slate-400 select-none cursor-default hover:text-slate-300 transition-colors"
            >
              © {currentYear} Mobile Legends: Bang Bang • Community Heroes PH
            </p>
          </div>
        </footer>
      </main>

      {/* Header Banner & Customization Modal */}
      {isBannerModalOpen && (
        <HeaderBannerModal
          isOpen={isBannerModalOpen}
          onClose={() => setIsBannerModalOpen(false)}
          bgConfig={bgConfig}
          onUpdateBgConfig={onUpdateBgConfig}
          currentMonthName={currentMonthName}
          currentYear={currentYear}
        />
      )}

      {/* Screen 2: The Detail Modal per Head */}
      {selectedProfilePlayer && (
        <CHProfileModal
          player={selectedProfilePlayer}
          isOpen={!!selectedProfilePlayer}
          onClose={() => setSelectedProfilePlayer(null)}
          onOpenQR={(p) => {
            setSelectedProfilePlayer(null);
            onOpenQR(p);
          }}
        />
      )}
    </div>
  );
};
