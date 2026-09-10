import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LinktreeView } from './components/LinktreeView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { QRCodeModal } from './components/QRCodeModal';
import { StaffAuthModal } from './components/StaffAuthModal';
import { CHPlayer, HeaderBackgroundConfig } from './types';
import {
  DEFAULT_SHEET_TITLE,
  INITIAL_TABS,
  INITIAL_SEPTEMBER_PLAYERS,
} from './data/initialData';
import { DEFAULT_CH_AVATAR } from './data/defaultAvatar';
import {
  analyzeTabs,
  extractSpreadsheetId,
  MONTH_NAMES,
  parseGvizResponse,
  transformRowsToPlayers,
  fetchGoogleSheetData,
  parseCsvOrTsv,
  fetchResponseSheetTeamCount,
  fetchGoogleSheetsApiTabs,
  fetchGoogleSheetsApiRows,
  fetchAppStateFromServer,
} from './utils/sheetDetector';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logoutGoogle } from './lib/googleAuth';

export default function App() {
  // Current real date
  const [currentDate] = useState<Date>(new Date());

  // Check if current URL triggers admin mode access
  const checkIsAdminUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.has('admin') ||
      params.has('staff') ||
      window.location.hash.toLowerCase().includes('admin') ||
      window.location.hash.toLowerCase().includes('staff') ||
      window.location.pathname.toLowerCase().endsWith('/admin')
    );
  };

  // Staff / Admin Authentication State (strictly default to FALSE for public users)
  const [isStaffMode, setIsStaffMode] = useState<boolean>(() => {
    if (checkIsAdminUrl()) {
      return sessionStorage.getItem('ch_staff_session') === 'true';
    }
    return false;
  });
  const [isStaffAuthOpen, setIsStaffAuthOpen] = useState<boolean>(false);

  // Default view is ALWAYS the public linktree tournament portal
  const [adminViewMode, setAdminViewMode] = useState<'dashboard' | 'linktree'>(() => {
    if (checkIsAdminUrl() && sessionStorage.getItem('ch_staff_session') === 'true') {
      return 'dashboard';
    }
    return 'linktree';
  });

  // Ensure clean public state on cold start (remove any stale staff flag), or open auth if admin URL
  useEffect(() => {
    const handleUrlCheck = () => {
      const isAdminRequested = checkIsAdminUrl();
      if (!isAdminRequested) {
        localStorage.removeItem('ch_staff_mode');
        sessionStorage.removeItem('ch_staff_session');
      } else if (!isStaffMode) {
        setIsStaffAuthOpen(true);
      } else {
        setAdminViewMode('dashboard');
      }
    };

    handleUrlCheck();
    window.addEventListener('hashchange', handleUrlCheck);
    return () => window.removeEventListener('hashchange', handleUrlCheck);
  }, [isStaffMode]);

  // Global secret hotkey for organizers: Ctrl + Shift + A or Alt + A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) ||
        (e.altKey && (e.key === 'A' || e.key === 'a'))
      ) {
        e.preventDefault();
        if (isStaffMode) {
          setAdminViewMode((prev) => (prev === 'dashboard' ? 'linktree' : 'dashboard'));
        } else {
          setIsStaffAuthOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStaffMode]);

  // Selected Nicknames visible on Linktree
  const [adminSelectedNicknames, setAdminSelectedNicknames] = useState<string[]>(() => {
    const saved = localStorage.getItem('ch_admin_selected_nicknames');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_SEPTEMBER_PLAYERS.map((p) => p.chNickname);
  });

  // Save selected nicknames to local storage
  useEffect(() => {
    localStorage.setItem('ch_admin_selected_nicknames', JSON.stringify(adminSelectedNicknames));
  }, [adminSelectedNicknames]);

  // Background Header Config
  const [bgConfig, setBgConfig] = useState<HeaderBackgroundConfig>(() => {
    const defaults: HeaderBackgroundConfig = {
      type: 'preset',
      presetId: 'official-ch-banner',
      title: 'MLBB PH - Community Heroes',
      subtitle: 'Official Tournament Portal',
      description: 'MLBB PH - Community Heroes, leading MLBB community events for the Filipinos.',
      facebookPageUrl: 'https://www.facebook.com/MLBBPHCommunityHeroes',
      followersText: '286K followers • 5 following',
      categoryText: 'Interest',
      avatarType: 'custom',
      avatarCustomUrl: DEFAULT_CH_AVATAR,
      overlayDarkness: 0.15,
      bannerHeight: 'compact',
      bannerFit: 'cover',
    };

    const saved = localStorage.getItem('ch_header_bg_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaults,
          ...parsed,
          facebookPageUrl: parsed.facebookPageUrl || defaults.facebookPageUrl,
          title: parsed.title === 'MLBB COMMUNITY HEROES' ? defaults.title : (parsed.title || defaults.title),
          followersText: parsed.followersText || defaults.followersText,
          categoryText: parsed.categoryText || defaults.categoryText,
          avatarCustomUrl: parsed.avatarCustomUrl || defaults.avatarCustomUrl,
          bannerHeight: parsed.bannerHeight || 'compact',
        };
      } catch (e) {}
    }
    return defaults;
  });

  const handleUpdateBgConfig = (newConfig: HeaderBackgroundConfig) => {
    setBgConfig(newConfig);
    localStorage.setItem('ch_header_bg_config', JSON.stringify(newConfig));
  };

  // Sheet Source State
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(
    'https://docs.google.com/spreadsheets/d/1HUANmtnLjlGiNjyiYs4Dgp5rmm_71oH2qFuXMeZXkZw/edit?pli=1&gid=0#gid=0'
  );
  const [rawTabsList, setRawTabsList] = useState<string[]>(INITIAL_TABS);
  const [activeTabName, setActiveTabName] = useState<string>('September 5, 2026');

  // Google OAuth / Firebase Auth State (Editor access for restricted sheets)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Players Data with localStorage persistence
  const [allPlayers, setAllPlayers] = useState<CHPlayer[]>(() => {
    const saved = localStorage.getItem('ch_players_directory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    return INITIAL_SEPTEMBER_PLAYERS;
  });

  // Save allPlayers to local storage
  useEffect(() => {
    localStorage.setItem('ch_players_directory', JSON.stringify(allPlayers));
  }, [allPlayers]);

  // Initial sync with server state
  useEffect(() => {
    fetchAppStateFromServer().then((serverState) => {
      if (serverState && Array.isArray(serverState.players) && serverState.players.length > 0) {
        setAllPlayers(serverState.players);
        if (serverState.selectedNicknames && Array.isArray(serverState.selectedNicknames)) {
          setAdminSelectedNicknames(serverState.selectedNicknames);
        }
        if (serverState.bannerSettings) {
          setBgConfig((prev) => ({ ...prev, ...serverState.bannerSettings }));
        }
      }
    });
  }, []);

  // Hourly Auto-Detection State
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [lastHourlySync, setLastHourlySync] = useState<string>('09:00 AM PHT');
  const [nextSyncSeconds, setNextSyncSeconds] = useState<number>(3600);

  // Modals
  const [qrPlayer, setQrPlayer] = useState<CHPlayer | null>(null);

  // Hourly Countdown Timer & Auto-Trigger
  useEffect(() => {
    const interval = setInterval(() => {
      setNextSyncSeconds((prev) => {
        if (prev <= 1) {
          handleRunHourlyDetection();
          return 3600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Analyze tabs based on current date
  const { tabs: analyzedTabs } = useMemo(() => {
    return analyzeTabs(rawTabsList, currentDate);
  }, [rawTabsList, currentDate]);

  const currentMonthName = MONTH_NAMES[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  // Sheet Sync Status State
  const [sheetSyncStatus, setSheetSyncStatus] = useState<{
    loading: boolean;
    error: string | null;
    successMessage: string | null;
  }>({ loading: false, error: null, successMessage: null });

  // Google Sign-In and Sign-Out Handlers
  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    setSheetSyncStatus({ loading: true, error: null, successMessage: null });
    try {
      const res = await googleSignIn();
      if (res && res.accessToken) {
        setGoogleUser(res.user);
        setGoogleAccessToken(res.accessToken);
        // Automatically sync spreadsheet using the newly authorized editor token!
        await handleSyncSpreadsheet(spreadsheetUrl, activeTabName, res.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setSheetSyncStatus({
        loading: false,
        error:
          err.message ||
          'Google Sign-in was cancelled or encountered an error. Please try again.',
        successMessage: null,
      });
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setGoogleAccessToken(null);
    setSheetSyncStatus({
      loading: false,
      error: null,
      successMessage: 'Signed out of Google account.',
    });
  };

  // Hourly Auto-Detection Trigger (Dynamic slot counts from response sheets)
  const handleRunHourlyDetection = useCallback(async () => {
    setIsDetecting(true);
    try {
      // Check response sheets for all currently loaded players in parallel
      const updatedPlayers = await Promise.all(
        allPlayers.map(async (player) => {
          if (player.tournamentResponseSheet) {
            try {
              const count = await fetchResponseSheetTeamCount(
                player.tournamentResponseSheet,
                googleAccessToken
              );
              if (count !== null) {
                return {
                  ...player,
                  teamsRegistered: count,
                  lastDetectedAt:
                    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
                    ' PHT',
                };
              }
            } catch {
              // Graceful fallback to existing player data if network is restricted
            }
          }
          return player;
        })
      );

      setAllPlayers(updatedPlayers);
      const now = new Date();
      const timeStr =
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' PHT';
      setLastHourlySync(timeStr);
      setNextSyncSeconds(3600);
    } catch (err) {
      console.error('Hourly sync error:', err);
    } finally {
      setIsDetecting(false);
    }
  }, [allPlayers, googleAccessToken]);

  // Sync Master Google Spreadsheet URL (Supports Editor OAuth Token for Restricted Sheets)
  const handleSyncSpreadsheet = async (
    targetUrl: string,
    targetTab?: string,
    overrideToken?: string
  ): Promise<boolean> => {
    setSheetSyncStatus({ loading: true, error: null, successMessage: null });
    const tokenToUse = overrideToken || googleAccessToken;

    try {
      const activeTabToUse = targetTab || activeTabName;
      let rows: any[][] = [];

      // 1. If signed in with Google, use official Google Sheets API v4
      if (tokenToUse) {
        try {
          // Detect real tabs from private sheet
          const tabs = await fetchGoogleSheetsApiTabs(targetUrl, tokenToUse);
          if (tabs && tabs.length > 0) {
            setRawTabsList(tabs.map((t) => t.name));
          }

          // Fetch sheet rows
          rows = await fetchGoogleSheetsApiRows(targetUrl, activeTabToUse, tokenToUse);
        } catch (apiErr: any) {
          console.warn('Sheets API v4 error with token, trying fallback...', apiErr);
        }
      }

      // 2. If not fetched yet, fallback to proxy/GViz/CSV
      if (!rows || rows.length === 0) {
        const result = await fetchGoogleSheetData(targetUrl, activeTabToUse);
        if (!result || !result.rows || result.rows.length === 0) {
          throw new Error('No rows found in this spreadsheet tab.');
        }
        rows = result.rows;
      }

      const importedPlayers = transformRowsToPlayers(rows);
      if (importedPlayers.length === 0) {
        throw new Error('No Community Head rows found. Ensure the sheet has Area, Nickname, and Registration Form links.');
      }

      // Check response sheets for live team counts
      const playersWithCounts = await Promise.all(
        importedPlayers.map(async (player) => {
          if (player.tournamentResponseSheet) {
            try {
              const count = await fetchResponseSheetTeamCount(
                player.tournamentResponseSheet,
                tokenToUse
              );
              if (count !== null) {
                return { ...player, teamsRegistered: count };
              }
            } catch {}
          }
          return player;
        })
      );

      setAllPlayers(playersWithCounts);

      // Auto-select active CH nicknames so they appear on the Linktree
      const activeNicknames = playersWithCounts
        .filter((p) => p.active)
        .map((p) => p.chNickname);
      setAdminSelectedNicknames(
        activeNicknames.length > 0
          ? activeNicknames
          : playersWithCounts.map((p) => p.chNickname)
      );

      const now = new Date();
      const timeStr =
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' PHT';
      setLastHourlySync(timeStr);
      setNextSyncSeconds(3600);

      setSheetSyncStatus({
        loading: false,
        error: null,
        successMessage: `Successfully imported ${playersWithCounts.length} Community Heads from spreadsheet (${activeTabToUse})!`,
      });
      return true;
    } catch (err: any) {
      setSheetSyncStatus({
        loading: false,
        error:
          err.message ||
          'Failed to load Google Sheet. Please sign in with your editor Google Account above, or use the Direct Paste box.',
        successMessage: null,
      });
      return false;
    }
  };

  // Direct Raw Paste / TSV Import (e.g. copying from Google Sheets or Excel and pasting directly)
  const handleImportRawSheetData = async (rawPastedText: string): Promise<boolean> => {
    setSheetSyncStatus({ loading: true, error: null, successMessage: null });
    try {
      const rows = parseCsvOrTsv(rawPastedText);
      if (rows.length === 0) {
        throw new Error('Pasted content is empty.');
      }
      const importedPlayers = transformRowsToPlayers(rows);
      if (importedPlayers.length === 0) {
        throw new Error('Could not parse tournament rows from pasted text. Please check the columns.');
      }

      setAllPlayers(importedPlayers);
      const activeNicknames = importedPlayers
        .filter((p) => p.active)
        .map((p) => p.chNickname);
      setAdminSelectedNicknames(
        activeNicknames.length > 0
          ? activeNicknames
          : importedPlayers.map((p) => p.chNickname)
      );

      setSheetSyncStatus({
        loading: false,
        error: null,
        successMessage: `Successfully imported ${importedPlayers.length} Community Heads from pasted data!`,
      });
      return true;
    } catch (err: any) {
      setSheetSyncStatus({
        loading: false,
        error: err.message || 'Failed to parse pasted data.',
        successMessage: null,
      });
      return false;
    }
  };

  // CH Nickname Management Handlers
  const handleToggleNickname = (nickname: string) => {
    setAdminSelectedNicknames((prev) =>
      prev.includes(nickname) ? prev.filter((n) => n !== nickname) : [...prev, nickname]
    );
  };

  const handleSelectAllNicknames = (select: boolean) => {
    if (select) {
      setAdminSelectedNicknames(allPlayers.map((p) => p.chNickname));
    } else {
      setAdminSelectedNicknames([]);
    }
  };

  const handleSelectActiveOnly = () => {
    setAdminSelectedNicknames(
      allPlayers.filter((p) => p.active).map((p) => p.chNickname)
    );
  };

  const handleUpdatePlayerCapacity = (
    playerId: string,
    teamsRegistered: number,
    maxTeams: number
  ) => {
    setAllPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, teamsRegistered, maxTeams } : p))
    );
  };

  const handleAddPlayer = (newPlayerData: Omit<CHPlayer, 'id'>) => {
    const newId = `ch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newPlayer: CHPlayer = {
      ...newPlayerData,
      id: newId,
    };
    setAllPlayers((prev) => [newPlayer, ...prev]);
    // Automatically select the new nickname so it displays immediately on the Linktree
    setAdminSelectedNicknames((prev) => {
      if (!prev.includes(newPlayer.chNickname)) {
        return [...prev, newPlayer.chNickname];
      }
      return prev;
    });
  };

  const handleUpdatePlayer = (updatedPlayer: CHPlayer) => {
    setAllPlayers((prev) =>
      prev.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p))
    );
    setAdminSelectedNicknames((prev) => {
      if (!prev.includes(updatedPlayer.chNickname)) {
        return [...prev, updatedPlayer.chNickname];
      }
      return prev;
    });
  };

  const handleDeletePlayer = (playerId: string) => {
    const playerToDelete = allPlayers.find((p) => p.id === playerId);
    setAllPlayers((prev) => prev.filter((p) => p.id !== playerId));
    if (playerToDelete) {
      setAdminSelectedNicknames((prev) =>
        prev.filter((n) => n !== playerToDelete.chNickname)
      );
    }
  };

  const handleBulkAddNicknames = (nicknames: string[]) => {
    const existingNicknames = new Set(allPlayers.map((p) => p.chNickname.toLowerCase()));
    const newPlayers: CHPlayer[] = [];
    const nicknamesToAdd: string[] = [];

    nicknames.forEach((rawNick, idx) => {
      const cleanNick = rawNick.trim();
      if (!cleanNick) return;
      if (!existingNicknames.has(cleanNick.toLowerCase())) {
        existingNicknames.add(cleanNick.toLowerCase());
        nicknamesToAdd.push(cleanNick);
        newPlayers.push({
          id: `ch-bulk-${Date.now()}-${idx}`,
          active: true,
          area: 'General',
          fullName: cleanNick,
          chNickname: cleanNick,
          registrationFormLink: `https://forms.gle/${cleanNick.toLowerCase()}-tournament`,
          tournamentPostingLink: `https://forms.gle/${cleanNick.toLowerCase()}-tournament`,
          tournamentResponseSheet: '',
          teamsRegistered: 10,
          maxTeams: 16,
          lastDetectedAt:
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' PHT',
        });
      } else {
        nicknamesToAdd.push(cleanNick);
      }
    });

    if (newPlayers.length > 0) {
      setAllPlayers((prev) => [...prev, ...newPlayers]);
    }
    setAdminSelectedNicknames((prev) => {
      const updated = new Set([...prev, ...nicknamesToAdd]);
      return Array.from(updated);
    });
  };

  const handleSetDisplayOnlyNickname = (nickname: string) => {
    setAdminSelectedNicknames([nickname]);
  };

  const handleStaffLoginSuccess = () => {
    setIsStaffMode(true);
    setAdminViewMode('dashboard');
    sessionStorage.setItem('ch_staff_session', 'true');
  };

  const handleStaffLogout = () => {
    setIsStaffMode(false);
    sessionStorage.removeItem('ch_staff_session');
    localStorage.removeItem('ch_staff_mode');
    setAdminViewMode('linktree');
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] text-slate-100 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden w-full max-w-full no-scrollbar">
      {/* 
        CONDITIONAL ARCHITECTURE:
        1. When isStaffMode is true AND adminViewMode is 'dashboard':
           -> Dedicated Admin Console / Management Workspace
        2. When isStaffMode is false OR adminViewMode is 'linktree':
           -> The authentic Linktree Directory for players & public visitors
      */}
      {isStaffMode && adminViewMode === 'dashboard' ? (
        <AdminDashboardView
          players={allPlayers}
          selectedNicknames={adminSelectedNicknames}
          onToggleNickname={handleToggleNickname}
          onSelectAllNicknames={handleSelectAllNicknames}
          onSelectActiveOnly={handleSelectActiveOnly}
          onAddPlayer={handleAddPlayer}
          onUpdatePlayer={handleUpdatePlayer}
          onDeletePlayer={handleDeletePlayer}
          onBulkAddNicknames={handleBulkAddNicknames}
          onUpdatePlayerCapacity={handleUpdatePlayerCapacity}
          onRunHourlyDetection={handleRunHourlyDetection}
          isDetecting={isDetecting}
          lastHourlySync={lastHourlySync}
          nextSyncCountdown={formatCountdown(nextSyncSeconds)}
          bgConfig={bgConfig}
          onUpdateBgConfig={handleUpdateBgConfig}
          spreadsheetUrl={spreadsheetUrl}
          onUpdateSpreadsheetUrl={setSpreadsheetUrl}
          onSyncSpreadsheet={handleSyncSpreadsheet}
          onImportRawSheetData={handleImportRawSheetData}
          syncStatus={sheetSyncStatus}
          detectedTabs={analyzedTabs}
          activeTabName={activeTabName}
          onSelectTab={setActiveTabName}
          onViewPublicLinktree={() => setAdminViewMode('linktree')}
          onExitStaffMode={handleStaffLogout}
          currentMonthName={currentMonthName}
          currentYear={currentYear}
          onOpenQR={(player) => setQrPlayer(player)}
          onSetDisplayOnlyNickname={handleSetDisplayOnlyNickname}
          googleUser={googleUser}
          isGoogleSigningIn={isGoogleSigningIn}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleSignOut={handleGoogleSignOut}
        />
      ) : (
        <LinktreeView
          players={allPlayers}
          selectedNicknames={adminSelectedNicknames}
          bgConfig={bgConfig}
          onUpdateBgConfig={handleUpdateBgConfig}
          currentMonthName={currentMonthName}
          currentYear={currentYear}
          lastHourlySync={lastHourlySync}
          nextSyncCountdown={formatCountdown(nextSyncSeconds)}
          onOpenQR={(player) => setQrPlayer(player)}
          onOpenAdminLogin={() => setIsStaffAuthOpen(true)}
          isStaffMode={isStaffMode}
          onSwitchToAdminDashboard={() => setAdminViewMode('dashboard')}
          onExitStaffMode={handleStaffLogout}
          onSelectAllNicknames={handleSelectAllNicknames}
        />
      )}

      {/* QR Code Modal */}
      {qrPlayer && (
        <QRCodeModal
          player={qrPlayer}
          onClose={() => setQrPlayer(null)}
        />
      )}

      {/* Staff Authentication Passkey Modal */}
      {isStaffAuthOpen && (
        <StaffAuthModal
          isOpen={isStaffAuthOpen}
          onClose={() => {
            setIsStaffAuthOpen(false);
            if (window.location.search || window.location.hash) {
              window.history.replaceState({}, '', window.location.pathname);
            }
          }}
          onLoginSuccess={handleStaffLoginSuccess}
        />
      )}
    </div>
  );
}
