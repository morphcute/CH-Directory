"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Download,
  Eye,
  FileSpreadsheet,
  Gift,
  Image as ImageIcon,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Shuffle,
  Trash2,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import type { AppState, CHPlayer, RaffleData, RaffleArchiveSummary, RafflePrizeItem } from "@/types";
import { normalizePrizeItems } from "@/types";
import { MlbbDiamondIcon } from "./MlbbDiamondIcon";
import { parseCsvOrTsv, transformRowsToPlayers, cleanAreaString } from "@/utils/sheetDetector";
import { compressImageFile } from "@/utils/imageUtils";
import { slotsLeft, statusLabels, tournamentStatus, isTabDatePassed } from "@/lib/tournaments";
import { Brand, Footer, Modal } from "./shared";

const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.36 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.26C.46 8.17 0 9.99 0 12s.46 3.83 1.26 5.42l4.02-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The request could not be completed.");
  return data;
}
const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [adminEmail, setAdminEmail] = useState("lester.chquezonprovince@gmail.com");
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState("directory");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<CHPlayer | null>(null);
  const [paste, setPaste] = useState("");
  const [token, setToken] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [imported, setImported] = useState<CHPlayer[] | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  // Raffle Management State
  const [raffleData, setRaffleData] = useState<RaffleData | null>(null);
  const [raffleLoading, setRaffleLoading] = useState(false);
  const [raffleSaving, setRaffleSaving] = useState(false);
  const [raffleForm, setRaffleForm] = useState<{
    title: string;
    category: string;
    description: string;
    cutoffDate: string;
    prizes: RafflePrizeItem[];
    isActive: boolean;
  }>({
    title: "Community Heroes Grand Raffle",
    category: "Diamonds Giveaway",
    description:
      "Enter your Full Name below to join the official Community Heroes giveaway! Winners will be announced after the cut-off date.",
    cutoffDate: "",
    prizes: [
      { name: "100 Diamonds", winnerCount: 5 },
      { name: "Starlight Card", winnerCount: 1 },
    ],
    isActive: true,
  });
  const [newPrizeName, setNewPrizeName] = useState("");
  const [newPrizeCount, setNewPrizeCount] = useState<number>(1);
  const [selectedRandomPrize, setSelectedRandomPrize] = useState("");
  const [raffleQuery, setRaffleQuery] = useState("");
  const [adminRafflePage, setAdminRafflePage] = useState(1);
  const ADMIN_ENTRIES_PER_PAGE = 10;
  const [assignDropdownValue, setAssignDropdownValue] = useState<{ [entryId: string]: string }>({});
  const [archivedRaffles, setArchivedRaffles] = useState<RaffleArchiveSummary[]>([]);
  const [showCreateRaffleModal, setShowCreateRaffleModal] = useState(false);
  const [createRaffleForm, setCreateRaffleForm] = useState<{
    title: string;
    category: string;
    description: string;
    cutoffDate: string;
    prizes: RafflePrizeItem[];
    isActive: boolean;
  }>({
    title: "Community Heroes Grand Raffle",
    category: "Diamonds Giveaway",
    description:
      "Enter your Full Name below to join the official Community Heroes giveaway! Winners will be announced after the cut-off date.",
    cutoffDate: "",
    prizes: [
      { name: "100 Diamonds", winnerCount: 5 },
      { name: "Starlight Card", winnerCount: 1 },
    ],
    isActive: true,
  });
  const [createPrizeName, setCreatePrizeName] = useState("");
  const [createPrizeCount, setCreatePrizeCount] = useState<number>(1);
  const [editingArchive, setEditingArchive] = useState<RaffleArchiveSummary | null>(null);
  const [editingArchiveForm, setEditingArchiveForm] = useState<{ title: string; description: string }>({
    title: "",
    description: "",
  });
  const [manualEntryName, setManualEntryName] = useState("");

  function toLocalDatetimeInput(iso?: string) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  }

  async function loadRaffleAdmin() {
    setRaffleLoading(true);
    try {
      const res = await api("/api/raffle");
      setRaffleData(res);
      if (Array.isArray(res.archives)) {
        setArchivedRaffles(res.archives);
      }
      const normalized = normalizePrizeItems(res.prizes);
      setRaffleForm({
        title: res.title || "Community Heroes Grand Raffle",
        category: res.category || "Diamonds Giveaway",
        description: res.description || "",
        cutoffDate: res.cutoffDate || "",
        prizes: normalized.length > 0 ? normalized : [{ name: "100 Diamonds", winnerCount: 5 }],
        isActive: res.isActive !== undefined ? res.isActive : true,
      });
      if (normalized.length > 0) {
        setSelectedRandomPrize(normalized[0].name);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load raffle data");
    } finally {
      setRaffleLoading(false);
    }
  }

  async function handleArchiveCurrentRaffle() {
    if (!raffleData) return;
    const winnerCount = raffleData.entries?.filter((e) => Boolean(e.prizeWon)).length || 0;
    const confirmMsg =
      winnerCount > 0
        ? `This raffle currently has ${winnerCount} assigned winner(s). Are you sure you want to archive it? All entries and winners will be preserved in the public Past Winners Archive, and a new raffle will begin.`
        : "Archive this raffle? It will be moved to the Past Winners Archive and a new raffle will begin.";
    if (!window.confirm(confirmMsg)) return;

    setError("");
    setMessage("");
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "archive-and-new",
          raffleId: raffleData.id || "default",
          category: raffleForm.category,
        }),
      );
      if (res.raffle) {
        setRaffleData(res.raffle);
        const normalized = normalizePrizeItems(res.raffle.prizes);
        setRaffleForm({
          title: res.raffle.title || "Community Heroes Grand Raffle",
          category: res.raffle.category || "Diamonds Giveaway",
          description: res.raffle.description || "",
          cutoffDate: res.raffle.cutoffDate || "",
          prizes: normalized,
          isActive: res.raffle.isActive !== undefined ? res.raffle.isActive : true,
        });
        if (Array.isArray(res.archives)) {
          setArchivedRaffles(res.archives);
        }
        setMessage("Raffle has been archived! A fresh raffle is now active for your community.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to archive raffle");
    }
  }

  async function handleCreateNewRaffle(e: React.FormEvent) {
    e.preventDefault();
    if (!createRaffleForm.title.trim()) {
      setError("Please enter a title for the new raffle.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "create-raffle",
          title: createRaffleForm.title,
          category: createRaffleForm.category,
          description: createRaffleForm.description,
          cutoffDate: createRaffleForm.cutoffDate,
          prizes: createRaffleForm.prizes,
          isActive: createRaffleForm.isActive,
        }),
      );
      if (res.raffle) {
        setRaffleData(res.raffle);
        const normalized = normalizePrizeItems(res.raffle.prizes);
        setRaffleForm({
          title: res.raffle.title,
          category: res.raffle.category || "Diamonds Giveaway",
          description: res.raffle.description,
          cutoffDate: res.raffle.cutoffDate,
          prizes: normalized,
          isActive: res.raffle.isActive !== undefined ? res.raffle.isActive : true,
        });
        if (Array.isArray(res.archives)) setArchivedRaffles(res.archives);
        setShowCreateRaffleModal(false);
        setMessage("New raffle created successfully and active on /raffle!");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create new raffle");
    }
  }

  async function handleDeleteCurrentRaffle() {
    if (!raffleData) return;
    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${raffleData.title}" and its registered entries? This action cannot be undone.`,
      )
    )
      return;
    setError("");
    setMessage("");
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "delete-raffle",
          raffleId: raffleData.id,
        }),
      );
      if (res.raffle) {
        setRaffleData(res.raffle);
        const normalized = normalizePrizeItems(res.raffle.prizes);
        setRaffleForm({
          title: res.raffle.title,
          category: res.raffle.category || "Diamonds Giveaway",
          description: res.raffle.description,
          cutoffDate: res.raffle.cutoffDate || "",
          prizes: normalized,
          isActive: res.raffle.isActive !== undefined ? res.raffle.isActive : true,
        });
        if (Array.isArray(res.archives)) setArchivedRaffles(res.archives);
        setMessage("Raffle deleted. Switched to next raffle edition.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete raffle");
    }
  }

  async function handleDeleteArchive(archiveId: string, title: string) {
    if (!window.confirm(`Delete archived raffle "${title}"? It will be removed from the archive history permanently.`)) return;
    setError("");
    setMessage("");
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "delete-archive",
          archiveId,
        }),
      );
      if (Array.isArray(res.archives)) setArchivedRaffles(res.archives);
      setMessage(`Archived raffle "${title}" deleted.`);
    } catch (err: any) {
      setError(err.message || "Failed to delete archive");
    }
  }

  async function handleRestoreArchive(archiveId: string) {
    if (!window.confirm("Restore this archived raffle to active? It will replace the current active raffle on /raffle.")) return;
    setError("");
    setMessage("");
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "restore-archive",
          archiveId,
        }),
      );
      if (res.raffle) {
        setRaffleData(res.raffle);
        const normalized = normalizePrizeItems(res.raffle.prizes);
        setRaffleForm({
          title: res.raffle.title,
          category: res.raffle.category || "Diamonds Giveaway",
          description: res.raffle.description,
          cutoffDate: res.raffle.cutoffDate || "",
          prizes: normalized,
          isActive: res.raffle.isActive !== undefined ? res.raffle.isActive : true,
        });
        if (Array.isArray(res.archives)) setArchivedRaffles(res.archives);
        setMessage("Archived raffle restored to active!");
      }
    } catch (err: any) {
      setError(err.message || "Failed to restore archive");
    }
  }

  async function handleSaveEditArchive(e: React.FormEvent) {
    e.preventDefault();
    if (!editingArchive) return;
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "edit-archive",
          archiveId: editingArchive.id,
          title: editingArchiveForm.title,
          description: editingArchiveForm.description,
        }),
      );
      if (Array.isArray(res.archives)) setArchivedRaffles(res.archives);
      setEditingArchive(null);
      setMessage("Archived raffle updated successfully.");
    } catch (err: any) {
      setError(err.message || "Failed to update archived raffle");
    }
  }

  async function handleAddManualEntry(e: React.FormEvent) {
    e.preventDefault();
    const name = manualEntryName.trim();
    if (!name) return;
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "add-entry",
          raffleId: raffleData?.id || "default",
          fullName: name,
        }),
      );
      if (res.raffle) {
        setRaffleData(res.raffle);
        setManualEntryName("");
        setMessage(`Added "${name}" to raffle entries.`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to add entry");
    }
  }

  async function handleSaveRaffleSettings(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setRaffleSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "update-settings",
          raffleId: raffleData?.id,
          title: raffleForm.title,
          category: raffleForm.category,
          description: raffleForm.description,
          cutoffDate: raffleForm.cutoffDate,
          prizes: raffleForm.prizes,
          isActive: raffleForm.isActive,
        }),
      );
      if (res.raffle) {
        setRaffleData(res.raffle);
        const normalized = normalizePrizeItems(res.raffle.prizes);
        setRaffleForm({
          title: res.raffle.title,
          category: res.raffle.category || "Diamonds Giveaway",
          description: res.raffle.description,
          cutoffDate: res.raffle.cutoffDate || "",
          prizes: normalized,
          isActive: res.raffle.isActive !== undefined ? res.raffle.isActive : true,
        });
      }
      setMessage("Raffle settings saved and published to public /raffle page!");
    } catch (err: any) {
      setError(err.message || "Failed to update raffle settings");
    } finally {
      setRaffleSaving(false);
    }
  }

  async function handleAssignPrize(entryId: string, prizeWon: string | null) {
    setError("");
    setMessage("");
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "assign-winner",
          raffleId: raffleData?.id,
          entryId,
          prizeWon,
        }),
      );
      if (res.raffle) {
        setRaffleData(res.raffle);
        setMessage(prizeWon ? `Prize "${prizeWon}" assigned to participant!` : "Prize unassigned.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to assign winner");
    }
  }

  async function handleDeleteRaffleEntry(entryId: string, fullName: string) {
    if (!window.confirm(`Are you sure you want to remove "${fullName}" from the raffle entries?`)) return;
    setError("");
    setMessage("");
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "delete-entry",
          raffleId: raffleData?.id,
          entryId,
        }),
      );
      if (res.raffle) {
        setRaffleData(res.raffle);
        setMessage(`Removed "${fullName}" from raffle.`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete entry");
    }
  }

  async function handleClearAllRaffleEntries() {
    if (!window.confirm("⚠️ Are you sure you want to delete ALL registered raffle entries? This will completely clear the participant list and cannot be undone.")) return;
    setError("");
    setMessage("");
    try {
      const res = await api(
        "/api/raffle/admin",
        post({
          action: "clear-entries",
          raffleId: raffleData?.id,
        }),
      );
      if (res.raffle) {
        setRaffleData(res.raffle);
        setMessage("All raffle entries have been reset successfully.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to clear entries");
    }
  }

  async function handlePickRandomWinner(batchCount = 1) {
    if (!raffleData || !raffleData.entries || raffleData.entries.length === 0) {
      setError("No participants have registered in the raffle yet.");
      return;
    }
    const prize = selectedRandomPrize.trim();
    if (!prize) {
      setError("Please select or enter a prize to award to the random winner.");
      return;
    }
    const eligible = raffleData.entries.filter((e) => !e.prizeWon);
    if (eligible.length === 0) {
      setError("All registered participants have already won a prize!");
      return;
    }

    const drawCount = Math.min(batchCount, eligible.length);
    const shuffled = [...eligible].sort(() => 0.5 - Math.random());
    const winners = shuffled.slice(0, drawCount);

    setError("");
    setMessage(`Drawing ${drawCount} winner(s)…`);

    for (const w of winners) {
      await api(
        "/api/raffle/admin",
        post({
          action: "assign-winner",
          raffleId: raffleData.id,
          entryId: w.id,
          prizeWon: prize,
        }),
      );
    }

    const fresh = await api("/api/raffle");
    setRaffleData(fresh);
    if (drawCount === 1) {
      setMessage(`🎉 Winner Drawn: ${winners[0].fullName} won "${prize}"!`);
    } else {
      setMessage(`🎉 Successfully drew ${drawCount} winners for "${prize}": ${winners.map((w) => w.fullName).join(", ")}!`);
    }
  }

  useEffect(() => {
    api("/api/auth")
      .then(async (data) => {
        setConfigured(data.configured);
        if (data.adminEmail) setAdminEmail(data.adminEmail);
        if (data.authenticated) {
          const appState = await api("/api/app-state");
          setState(appState);
          if (appState.googleAccessToken) {
            setToken(appState.googleAccessToken);
          }
          if (
            appState.googleConnectedEmail ||
            appState.googleAccessToken ||
            appState.googleRefreshToken
          ) {
            setGoogleEmail(
              appState.googleConnectedEmail ||
                data.adminEmail ||
                "lester.chquezonprovince@gmail.com",
            );
          }
          setAuthenticated(true);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);
  useEffect(() => {
    if (!autoSync || !authenticated) return;
    const timer = setInterval(() => {
      if (!busy) void detect();
    }, 3_600_000);
    return () => clearInterval(timer);
  }, [autoSync, authenticated, state, busy]);

  useEffect(() => {
    if (tab === "raffle" && !raffleData && authenticated) {
      void loadRaffleAdmin();
    }
  }, [tab, authenticated, raffleData]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }
  function update(patch: Partial<AppState>) {
    setState((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }
  async function handleImageUpload(file: File, field: "logoUrl" | "bannerUrl") {
    if (!file) return;
    try {
      setBusy("upload");
      setError("");
      const compressed = await compressImageFile(
        file,
        field === "logoUrl" ? 400 : 1600,
        field === "logoUrl" ? 400 : 800,
        0.88,
      );
      update({ [field]: compressed.dataUrl });
      setMessage(
        `${field === "logoUrl" ? "Profile logo" : "Hero banner"} updated! Click "Publish changes" below to save to public directory.`,
      );
    } catch (err) {
      setError(
        (err as Error).message || "Failed to process and compress the image.",
      );
    } finally {
      setBusy("");
    }
  }
  async function googleAdminSignIn() {
    await run("google-login", async () => {
      const auth = await import("@/lib/googleAuth");
      const result = await auth.googleSignIn();
      const userEmail = (result.user.email || "").toLowerCase().trim();
      const targetAdmin = (adminEmail || "lester.chquezonprovince@gmail.com")
        .toLowerCase()
        .trim();

      if (userEmail !== targetAdmin) {
        await auth.logoutGoogle();
        throw new Error(
          `Access denied: ${result.user.email || "Unknown account"} is not authorized. Please sign in with ${targetAdmin}.`,
        );
      }

      await api(
        "/api/auth/google",
        post({ email: userEmail, accessToken: result.accessToken }),
      );
      setToken(result.accessToken);
      setGoogleEmail(result.user.email || targetAdmin);
      setState(await api("/api/app-state"));
      setAuthenticated(true);
      setMessage(`Welcome back, Lester! Google Sheets authorized.`);
    });
  }
  async function save() {
    if (!state) return;
    await run("save", async () => {
      const result = await api("/api/app-state", post(state));
      setState(result);
      setDirty(false);
      setMessage(
        "Your directory is published. Players will see the updated lineup.",
      );
    });
  }
  async function detect() {
    if (!state) return;
    await run("detect", async () => {
      const result = await api("/api/detect-tournament-status", {
        ...post({ players: state.players }),
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      update({ players: result.players });
      const errors = result.players.filter(
        (p: CHPlayer) =>
          p.formStatus === "error" ||
          (p.formStatusDetail &&
            p.formStatusDetail !== "Source checked successfully"),
      ).length;
      setMessage(
        `Source check complete. ${errors ? `${errors} source(s) need review; unverified counts were retained.` : "All sources checked."} Review the results, then publish changes.`,
      );
    });
  }
  async function syncNow() {
    await run("sync", async () => {
      const res = await api("/api/sync-now", post({}));
      const updatedState = await api("/api/app-state");
      setState(updatedState);
      setMessage(res.message || "Spreadsheet sources successfully synced.");
    });
  }
  async function detectTabs(urlToDetect?: string) {
    if (!state) return;
    const url = (urlToDetect || state.spreadsheetUrl || "").trim();
    if (!url) return;
    await run("detect-tabs", async () => {
      const data = await api(
        `/api/sheets/tabs?url=${encodeURIComponent(url)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (data.tabs && data.tabs.length > 0) {
        const patch: Partial<AppState> = {
          rawTabsList: data.tabs,
        };
        if (data.autoDetectedTab) {
          patch.activeTabName = data.autoDetectedTab;
        }
        update(patch);
        setMessage(
          `Detected ${data.tabs.length} tabs. Active month set to: "${data.autoDetectedTab || data.tabs[0]}"`,
        );
      } else {
        setMessage(
          "No sheet tabs detected. Check that the link is accessible or connect your Google account.",
        );
      }
    });
  }
  async function importSheet() {
    if (!state) return;
    await run("import", async () => {
      let targetTab = (state.activeTabName || "").trim();
      if (!targetTab && state.spreadsheetUrl) {
        try {
          const tabData = await api(
            `/api/sheets/tabs?url=${encodeURIComponent(state.spreadsheetUrl)}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} },
          );
          if (tabData.autoDetectedTab) {
            targetTab = tabData.autoDetectedTab;
            update({ activeTabName: targetTab, rawTabsList: tabData.tabs });
          }
        } catch {
          // fallback
        }
      }

      const data = await api(
        `/api/sheets/data?url=${encodeURIComponent(state.spreadsheetUrl || "")}&sheet=${encodeURIComponent(targetTab || "")}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      previewImport(data.rows);
    });
  }
  function previewImport(rows: unknown[][]) {
    const players = transformRowsToPlayers(rows);
    if (!players.length)
      throw new Error(
        "No tournament rows found. Expected columns: Active, Area, Full name, Nickname, Teams, Registration link, Response sheet.",
      );
    setImported(players);
  }
  async function googleSignIn() {
    await run("google", async () => {
      const auth = await import("@/lib/googleAuth");
      try {
        // 1. Attempt offline code authorization for permanent refresh token
        const code = await auth.requestGoogleOfflineCode();
        const res = await api("/api/sheets/connect-google", post({ code }));
        if (res.accessToken) setToken(res.accessToken);
        const email = res.email || "lester.chquezonprovince@gmail.com";
        setGoogleEmail(email);
        setMessage(
          `Google connected permanently (${email}). Background syncing stays active forever.`,
        );
        if (state?.spreadsheetUrl) {
          void detectTabs(state.spreadsheetUrl);
        }
        return;
      } catch (codeErr) {
        console.warn(
          "Offline code flow not available, falling back to popup token client...",
          codeErr,
        );
      }

      // 2. Fallback to standard token client
      const result = await auth.googleSignIn();
      setToken(result.accessToken);
      const email = result.user.email || "lester.chquezonprovince@gmail.com";
      setGoogleEmail(email);
      try {
        await api(
          "/api/sheets/connect-google",
          post({ accessToken: result.accessToken, email }),
        );
      } catch {}
      setMessage(
        `Google connected (${email}). Detecting spreadsheet tabs...`,
      );
      if (state?.spreadsheetUrl) {
        void detectTabs(state.spreadsheetUrl);
      }
    });
  }
  function exportData() {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "community-heroes-directory.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const feedback = (
    <>
      {error && (
        <div className="feedback error" role="alert">
          {error.includes("http") ? (
            <span>
              {error.split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
                part.startsWith("http") ? (
                  <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "#60a5fa",
                      textDecoration: "underline",
                      fontWeight: 600,
                      wordBreak: "break-all",
                    }}
                  >
                    {part}
                  </a>
                ) : (
                  part
                ),
              )}
            </span>
          ) : (
            error
          )}
        </div>
      )}
      {message && (
        <div className="feedback" role="status">
          {message}
        </div>
      )}
    </>
  );

  return (
    <>
      <main className="admin-shell" id="main-content">
        <header className="admin-header">
          <Brand logoUrl={state?.logoUrl} />
          <div>
            <Link
              className="button outline small"
              href="/"
              onClick={(e) => {
                if (
                  dirty &&
                  !window.confirm(
                    "You have unpublished changes (like unlisting heroes). Leave without publishing?",
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <ArrowLeft size={14} />
              Public directory
            </Link>
            {googleEmail && (
              <span className="admin-auth-badge" title="Google account authorized">
                <GoogleIcon size={14} />
                {googleEmail}
              </span>
            )}
            {authenticated && (
              <button
                className="icon-button"
                aria-label="Sign out"
                disabled={!!busy}
                onClick={() =>
                  run("logout", async () => {
                    if (
                      dirty &&
                      !window.confirm(
                        "You have unpublished changes. Sign out and discard them?",
                      )
                    )
                      return;
                    await api("/api/auth/logout", post({}));
                    const auth = await import("@/lib/googleAuth");
                    await auth.logoutGoogle();
                    setAuthenticated(false);
                    setState(null);
                    setDirty(false);
                    setToken("");
                    setGoogleEmail("");
                  })
                }
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>
        {checking ? (
          <div className="error-page" style={{ minHeight: "65vh" }}>
            <LoaderCircle className="busy-spinner" />
            <p>Opening the organizer workspace…</p>
          </div>
        ) : !authenticated ? (
          <div className="login-layout">
            <section className="login-intro">
              <span className="eyebrow">THE PEOPLE BEHIND THE PLAY</span>
              <h1>
                Build the stage.
                <br />
                Bring your
                <br />
                community.
              </h1>
              <p>
                A dedicated space for Community Heroes to manage local
                tournaments and keep every squad in the loop.
              </p>
            </section>
            <div className="login-form">
              <div className="login-avatar-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state?.logoUrl || "/images/mlbb-ch-avatar.png"}
                  alt="MLBB Community Heroes Logo"
                  className="login-avatar-img"
                />
              </div>
              <h2>Welcome back, Hero.</h2>
              <p>
                Sign in to your organizer workspace with Google OAuth to manage the directory, team capacity, and spreadsheet links.
              </p>

              {feedback}

              <button
                type="button"
                className="button primary full-width google-login-btn"
                disabled={!!busy}
                onClick={googleAdminSignIn}
              >
                {busy === "google-login" ? (
                  <>
                    <LoaderCircle size={18} className="busy-spinner" />
                    Connecting Google account…
                  </>
                ) : (
                  <>
                    <GoogleIcon size={18} />
                    Sign in with Google
                  </>
                )}
              </button>

              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button
                  type="button"
                  className="inline-link"
                  style={{ fontSize: "0.8rem", color: "#94a3b8" }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword
                    ? "Hide password option"
                    : "Sign in with password instead"}
                </button>
              </div>

              {showPassword && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run("login", async () => {
                      await api(
                        "/api/auth/login",
                        post({ password: passwordInput }),
                      );
                      const appState = await api("/api/app-state");
                      setState(appState);
                      if (appState.googleAccessToken) {
                        setToken(appState.googleAccessToken);
                      }
                      if (
                        appState.googleConnectedEmail ||
                        appState.googleAccessToken ||
                        appState.googleRefreshToken
                      ) {
                        setGoogleEmail(
                          appState.googleConnectedEmail ||
                            "lester.chquezonprovince@gmail.com",
                        );
                      }
                      setAuthenticated(true);
                    });
                  }}
                  style={{ marginTop: 14 }}
                >
                  <label className="form-field">
                    Password
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter administrator password"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    className="button outline full-width"
                    style={{ marginTop: 10 }}
                    disabled={!passwordInput || !!busy}
                  >
                    {busy === "login"
                      ? "Verifying password…"
                      : "Sign in with password"}
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          state && (
            <>
              <div className="admin-title">
                <div>
                  <span className="eyebrow">ORGANIZER WORKSPACE</span>
                  <h1>A great community starts here.</h1>
                  <p>
                    Manage your lineup. Keep your players informed. Make the
                    next match happen.
                  </p>
                </div>
                <button className="button outline" onClick={exportData}>
                  <Download size={15} />
                  Export directory
                </button>
              </div>
              <div className="admin-stats">
                <div>
                  <Trophy size={25} />
                  <strong>{state.players.length}</strong>
                  <span>Tournaments in directory</span>
                </div>
                <div>
                  <ShieldCheck size={25} />
                  <strong>
                    {state.players.filter((p) => p.active).length}
                  </strong>
                  <span>Active Community Heroes</span>
                </div>
                <div>
                  <Users size={25} />
                  <strong>
                    {state.players
                      .filter(
                        (p) =>
                          p.active &&
                          ["open", "closing"].includes(tournamentStatus(p)),
                      )
                      .reduce((n, p) => n + slotsLeft(p), 0)}
                  </strong>
                  <span>Available team slots</span>
                </div>
                <div>
                  <Eye size={25} />
                  <strong>{(state.pageViews || 0).toLocaleString()}</strong>
                  <span>Total Page Views</span>
                </div>
              </div>
              <nav className="admin-tabs" aria-label="Workspace sections">
                <button
                  className={tab === "directory" ? "active" : ""}
                  onClick={() => setTab("directory")}
                >
                  <LayoutDashboard size={15} />
                  Directory
                </button>
                <button
                  className={tab === "sources" ? "active" : ""}
                  onClick={() => setTab("sources")}
                >
                  <FileSpreadsheet size={15} />
                  Sheet & sources
                </button>
                <button
                  className={tab === "branding" ? "active" : ""}
                  onClick={() => setTab("branding")}
                >
                  <ImageIcon size={15} />
                  Logo & Banner
                </button>
                <button
                  className={tab === "settings" ? "active" : ""}
                  onClick={() => setTab("settings")}
                >
                  <Settings2 size={15} />
                  Lineup settings
                </button>
                <button
                  className={tab === "raffle" ? "active" : ""}
                  onClick={() => setTab("raffle")}
                >
                  <Gift size={15} />
                  Raffle
                </button>
              </nav>
              {feedback}
              <fieldset
                disabled={!!busy}
                style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
              >
                {tab === "directory" && (
                  <>
                    <div className="admin-toolbar">
                      <label className="search-field">
                        <Search size={17} />
                        <input
                          aria-label="Search organizers"
                          placeholder="Search heroes, names, or locations…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <button className="button outline" onClick={detect}>
                        <RefreshCw
                          size={15}
                          className={busy === "detect" ? "busy-spinner" : ""}
                        />
                        Check sources
                      </button>
                      <button
                        className="button primary"
                        onClick={() =>
                          setEditing({
                            id: crypto.randomUUID(),
                            active: true,
                            area: "",
                            fullName: "",
                            chNickname: "",
                            teamsRegistered: 0,
                            maxTeams: 16,
                            tournamentResponseSheet: "",
                            registrationFormLink: "",
                            tournamentPostingLink: "",
                          })
                        }
                      >
                        <Plus size={15} />
                        Add tournament
                      </button>
                    </div>
                    <div className="ch-bulk-bar">
                      <span>
                        <strong>
                          {state.players.filter((p) => p.active).length}
                        </strong>{" "}
                        of <strong>{state.players.length}</strong> Community Heroes listed on public directory
                      </span>
                      <div className="ch-bulk-buttons">
                        <button
                          type="button"
                          className="button outline small"
                          onClick={() => {
                            const allNicks = state.players.map((p) => p.chNickname);
                            update({
                              players: state.players.map((p) => ({ ...p, active: true })),
                              selectedNicknames: allNicks,
                            });
                          }}
                        >
                          Select all to list
                        </button>
                        <button
                          type="button"
                          className="button outline small"
                          onClick={() => {
                            update({
                              players: state.players.map((p) => ({ ...p, active: false })),
                              selectedNicknames: [],
                            });
                          }}
                        >
                          Deselect all
                        </button>
                      </div>
                    </div>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>CH NICKNAME</th>
                            <th>LOCATION</th>
                            <th>TEAM CAPACITY</th>
                            <th>STATUS</th>
                            <th>LIST ON PAGE</th>
                            <th>
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.players
                            .filter((p) =>
                              `${p.chNickname} ${p.area} ${p.fullName}`
                                .toLowerCase()
                                .includes(query.toLowerCase()),
                            )
                            .map((p) => (
                              <tr key={p.id} className={!p.active ? "admin-row-unlisted" : ""}>
                                <td>
                                  <div>
                                    <span className="hero-avatar">
                                      {p.chNickname
                                        .substring(0, 2)
                                        .toUpperCase()}
                                    </span>
                                    <span>
                                      <strong>{p.chNickname}</strong>
                                      <small>{p.fullName}</small>
                                    </span>
                                  </div>
                                </td>
                                <td>{cleanAreaString(p.area)}</td>
                                <td>
                                  <strong>
                                    {p.teamsRegistered}{" "}
                                    <small style={{ display: "inline" }}>
                                      / {p.maxTeams} teams
                                    </small>
                                  </strong>
                                </td>
                                <td>
                                  <span
                                    className={`status-label ${tournamentStatus(p)}`}
                                  >
                                    <span />
                                    {statusLabels[tournamentStatus(p)]}
                                  </span>
                                  {p.formStatusDetail &&
                                    p.formStatusDetail !==
                                      "Source checked successfully" && (
                                      <small title={p.formStatusDetail}>
                                        Source needs review
                                      </small>
                                    )}
                                </td>
                                <td>
                                  <label
                                    className="list-toggle-label"
                                    title={
                                      p.active
                                        ? `Click to remove ${p.chNickname} from public directory`
                                        : `Click to list ${p.chNickname} on public directory`
                                    }
                                  >
                                    <input
                                      type="checkbox"
                                      aria-label={`Show ${p.chNickname} in public directory`}
                                      checked={!!p.active}
                                      onChange={(e) => {
                                        const active = e.target.checked;
                                        const updated = state.players.map((item) =>
                                          item.id === p.id
                                            ? { ...item, active }
                                            : item,
                                        );
                                        update({
                                          players: updated,
                                          selectedNicknames: updated
                                            .filter((item) => item.active)
                                            .map((item) => item.chNickname),
                                        });
                                        setMessage(
                                          active
                                            ? `${p.chNickname} marked as Listed. Click "Publish changes" to show in public directory.`
                                            : `${p.chNickname} removed from listing. Click "Publish changes" to remove from public directory.`,
                                        );
                                      }}
                                    />
                                    <span
                                      className={`list-status-tag ${p.active ? "listed" : "unlisted"}`}
                                    >
                                      {p.active ? "Listed" : "Hidden"}
                                    </span>
                                  </label>
                                </td>
                                <td>
                                  <button
                                    onClick={() => setEditing({ ...p })}
                                    aria-label={`Edit ${p.chNickname}`}
                                  >
                                    <Pencil size={13} />
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {!state.players.some((p) =>
                        `${p.chNickname} ${p.area} ${p.fullName}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      ) && (
                        <div className="empty-state">
                          <h3>No heroes match this search.</h3>
                          <button
                            onClick={() => setQuery("")}
                            className="inline-link"
                          >
                            Clear search
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {tab === "sources" && (
                  <section className="admin-panel">
                    <h2>Master spreadsheet</h2>
                    <p>
                      Import your preparation sheet, or check registration forms
                      and response sheets for updated capacity. Imports stay in
                      preview until you publish them.
                    </p>
                    <label className="form-field">
                      Master spreadsheet link
                      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                        <input
                          type="url"
                          style={{ flex: 1 }}
                          value={state.spreadsheetUrl || ""}
                          placeholder="https://docs.google.com/spreadsheets/d/…"
                          onChange={(e) => {
                            const val = e.target.value;
                            update({ spreadsheetUrl: val });
                            if (val.includes("docs.google.com/spreadsheets/d/")) {
                              void detectTabs(val);
                            }
                          }}
                          onPaste={(e) => {
                            const pasted = e.clipboardData.getData("text");
                            if (pasted.includes("docs.google.com/spreadsheets/d/")) {
                              update({ spreadsheetUrl: pasted });
                              void detectTabs(pasted);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="button outline small"
                          style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
                          disabled={busy === "detect-tabs" || !state.spreadsheetUrl}
                          onClick={() => detectTabs()}
                          title="Scan and detect sheet tabs"
                        >
                          <RefreshCw size={14} className={busy === "detect-tabs" ? "busy-spinner" : ""} />
                          {busy === "detect-tabs" ? "Detecting tabs…" : "Detect tabs"}
                        </button>
                      </div>
                    </label>

                    <label className="form-field">
                      Sheet tab name
                      <input
                        value={state.activeTabName || ""}
                        onChange={(e) =>
                          update({ activeTabName: e.target.value })
                        }
                        placeholder="September 5, 2026"
                      />
                    </label>

                    {state.rawTabsList && state.rawTabsList.length > 0 && (
                      <div
                        style={{
                          marginTop: -6,
                          marginBottom: 16,
                          padding: "10px 14px",
                          background: "#161e2c",
                          borderRadius: "8px",
                          border: "1px solid #24334a",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.78rem",
                            color: "#94a3b8",
                            marginBottom: 8,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>
                            <strong>Detected tabs in sheet</strong> (click to select):
                          </span>
                          {state.activeTabName && (
                            <span style={{ color: "#facc15", fontWeight: 600 }}>
                              Active: {state.activeTabName}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {state.rawTabsList.map((tName) => {
                            const isSelected =
                              (state.activeTabName || "").trim() === tName.trim();
                            const isGuide =
                              /guide|instruction|rules|template|readme|uniformed/i.test(
                                tName,
                              );
                            return (
                              <button
                                key={tName}
                                type="button"
                                onClick={() => {
                                  update({ activeTabName: tName });
                                  setMessage(`Selected tab: "${tName}"`);
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  fontSize: "0.82rem",
                                  fontWeight: isSelected ? 700 : 500,
                                  border: isSelected
                                    ? "1.5px solid #facc15"
                                    : "1px solid #334155",
                                  background: isSelected
                                    ? "rgba(250, 204, 21, 0.16)"
                                    : "#0f172a",
                                  color: isSelected
                                    ? "#facc15"
                                    : isGuide
                                      ? "#94a3b8"
                                      : "#f8fafc",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {isSelected ? "✓ " : isGuide ? "ℹ " : "📅 "}
                                {tName}
                                {isGuide && (
                                  <span style={{ opacity: 0.6, fontSize: "0.68rem" }}>
                                    (Guide)
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button className="button primary" onClick={importSheet}>
                      <Upload size={15} />
                      Preview sheet import
                    </button>
                    <button
                      className="button outline"
                      onClick={googleSignIn}
                      title={
                        googleEmail
                          ? "Google is connected permanently for background syncing. Click to refresh or re-authorize."
                          : "Connect your Google account so the server can sync private sheets automatically."
                      }
                      style={{
                        borderColor: googleEmail ? "#10b981" : undefined,
                        color: googleEmail ? "#34d399" : undefined,
                      }}
                    >
                      <GoogleIcon size={16} />
                      {googleEmail
                        ? `✓ Connected: ${googleEmail} (Sync active)`
                        : "Connect Google for private sheets"}
                    </button>
                    <details>
                      <summary>Paste directly from a spreadsheet</summary>
                      <p className="info-note">
                        Copy columns A–G including the header: Active, Area,
                        Full name, Nickname, Teams, Registration link, Response
                        sheet.
                      </p>
                      <label className="form-field">
                        Spreadsheet data
                        <textarea
                          rows={7}
                          value={paste}
                          onChange={(e) => setPaste(e.target.value)}
                          placeholder="Paste your copied rows here…"
                        />
                      </label>
                      <button
                        className="button outline"
                        disabled={!paste.trim()}
                        onClick={() => {
                          setError("");
                          try {
                            previewImport(parseCsvOrTsv(paste));
                          } catch (err) {
                            setError((err as Error).message);
                          }
                        }}
                      >
                        Preview pasted data <ArrowUpRight size={15} />
                      </button>
                    </details>
                    <details open>
                      <summary>Capacity & Sheet Sync</summary>
                      <p className="info-note">
                        The server counts non-empty response rows and extracts team rosters directly from your response sheets.
                      </p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <button className="button primary" onClick={syncNow} disabled={!!busy}>
                          <RefreshCw size={15} className={busy === "sync" ? "busy-spinner" : ""} />
                          {busy === "sync" ? "Syncing sheets…" : "Sync & check all sheets now"}
                        </button>
                      </div>
                      <div
                        className="filter-hint"
                        style={{
                          maxWidth: "none",
                          marginTop: 10,
                          padding: "8px 12px",
                          background: "#161e2c",
                          borderRadius: 6,
                          border: "1px solid #24334a",
                          color: "#94a3b8",
                          fontSize: "12px",
                        }}
                      >
                        ✓ <strong style={{ color: "#facc15" }}>Automatic 1-hour background sync active:</strong> The server automatically syncs team counts and rosters from your Google Sheets every hour, even when you close this window or sign out.
                      </div>
                    </details>
                  </section>
                )}
                {tab === "settings" && (
                  <section className="admin-panel">
                    <h2>Set the next chapter.</h2>
                    <p>
                      The public directory displays the month from your selected
                      sheet tab. Changing the label doesn’t import a new lineup;
                      use Sheet & sources to preview the matching data.
                    </p>
                    <label className="form-field">
                      Current lineup / sheet tab
                      <input
                        value={state.activeTabName || ""}
                        onChange={(e) =>
                          update({ activeTabName: e.target.value })
                        }
                        list="sheet-tabs"
                        maxLength={150}
                      />
                      <datalist id="sheet-tabs">
                        {state.rawTabsList?.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </label>
                    {isTabDatePassed(state.activeTabName) && (
                      <div
                        style={{
                          marginTop: 10,
                          marginBottom: 14,
                          padding: "10px 14px",
                          background: "#2a1515",
                          border: "1px solid #7f1d1d",
                          borderRadius: 8,
                          color: "#fca5a5",
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        ⚠️ <strong>Tournament date passed:</strong> The date in &quot;{state.activeTabName}&quot; has already passed, so all public tournament registrations are automatically closed. When you select next month&apos;s tab and publish, registrations will reopen for that month.
                      </div>
                    )}
                    <p className="info-note">
                      Use the visibility switch in Directory to control which
                      tournaments appear publicly. Existing registration and
                      social links are preserved when you edit a listing.
                    </p>
                  </section>
                )}
                {tab === "branding" && (
                  <section className="admin-panel" style={{ maxWidth: 960 }}>
                    <h2>Profile Logo & Cover Banner</h2>
                    <p>
                      Personalize the Community Heroes public directory. Upload your own images, choose presets, or customize the profile title, bio, and Facebook links.
                    </p>
                    <div className="branding-grid">
                      {/* Logo Section */}
                      <div className="branding-card">
                        <div className="branding-card-header">
                          <ImageIcon size={18} />
                          <div>
                            <h3>Profile Picture / Avatar</h3>
                            <small>Circular profile picture displayed on the public Facebook-style card.</small>
                          </div>
                        </div>
                        <div className="branding-preview-box">
                          <div className="branding-logo-preview" style={{ borderRadius: "50%", overflow: "hidden", width: 72, height: 72 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={state.logoUrl || "/images/mlbb-ch-avatar.png"}
                              alt="Profile logo preview"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                borderRadius: "50%",
                              }}
                            />
                          </div>
                          <div className="branding-preview-meta">
                            <strong>{state.logoUrl ? "Custom logo active" : "CH Directory shield logo"}</strong>
                            <p>Recommended: Square PNG, WebP, or JPG (400×400px). Auto-compressed on upload.</p>
                          </div>
                        </div>
                        <div className="branding-inputs">
                          <label className="form-field" style={{ marginBottom: 12 }}>
                            Image URL
                            <input
                              value={state.logoUrl || ""}
                              onChange={(e) => update({ logoUrl: e.target.value })}
                              placeholder="/images/mlbb-ch-avatar.png or https://…"
                            />
                          </label>
                          <div className="branding-upload-bar">
                            <label className="button outline small" style={{ cursor: "pointer" }}>
                              <Upload size={14} />
                              Upload logo file
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(file, "logoUrl");
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              className="button outline small"
                              onClick={() => {
                                update({ logoUrl: "/images/mlbb-ch-avatar.png" });
                                setMessage("Profile logo set to CH Directory shield logo. Click 'Publish changes' to save.");
                              }}
                            >
                              CH Shield
                            </button>
                            {state.logoUrl && (
                              <button
                                type="button"
                                className="button outline small"
                                onClick={() => {
                                  update({ logoUrl: "" });
                                  setMessage("Logo restored to default CH Directory shield. Click 'Publish changes' to save.");
                                }}
                              >
                                <RotateCcw size={14} />
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Banner Section */}
                      <div className="branding-card">
                        <div className="branding-card-header">
                          <ImageIcon size={18} />
                          <div>
                            <h3>Profile Cover Banner</h3>
                            <small>Top cover photo displayed behind the profile picture.</small>
                          </div>
                        </div>
                        <div className="branding-preview-box">
                          <div className="branding-banner-preview" style={{ width: 140, height: 72 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={state.bannerUrl || "/images/mlbb-ch-banner.png"}
                              alt="Hero banner preview"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          </div>
                          <div className="branding-preview-meta">
                            <strong>{state.bannerUrl ? "Custom banner active" : "MLBB 10th Anniversary Banner"}</strong>
                            <p>Recommended: 16:9 ratio, JPG, WebP, or PNG (up to 1600px wide).</p>
                          </div>
                        </div>
                        <div className="branding-inputs">
                          <label className="form-field" style={{ marginBottom: 12 }}>
                            Image URL
                            <input
                              value={state.bannerUrl || ""}
                              onChange={(e) => update({ bannerUrl: e.target.value })}
                              placeholder="/images/mlbb-ch-banner.png or https://…"
                            />
                          </label>
                          <div className="branding-upload-bar">
                            <label className="button outline small" style={{ cursor: "pointer" }}>
                              <Upload size={14} />
                              Upload banner file
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(file, "bannerUrl");
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              className="button outline small"
                              onClick={() => {
                                update({ bannerUrl: "/images/mlbb-ch-banner.png" });
                                setMessage("Cover banner set to MLBB 10th Anniversary banner. Click 'Publish changes' to save.");
                              }}
                            >
                              MLBB 10th Banner
                            </button>
                            <button
                              type="button"
                              className="button outline small"
                              onClick={() => {
                                update({ bannerUrl: "/images/hero-knight.png" });
                                setMessage("Cover banner set to Gold Knight banner. Click 'Publish changes' to save.");
                              }}
                            >
                              Gold Knight
                            </button>
                            {state.bannerUrl && (
                              <button
                                type="button"
                                className="button outline small"
                                onClick={() => {
                                  update({ bannerUrl: "" });
                                  setMessage("Banner restored to default. Click 'Publish changes' to save.");
                                }}
                              >
                                <RotateCcw size={14} />
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Profile Details Section */}
                      <div className="branding-card" style={{ gridColumn: "1 / -1" }}>
                        <div className="branding-card-header">
                          <ShieldCheck size={18} />
                          <div>
                            <h3>Profile Identity & Follow Button</h3>
                            <small>Text details shown in the Facebook-style profile card.</small>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                          <label className="form-field">
                            Directory Page Title
                            <input
                              value={state.bannerSettings?.title ?? "MLBB PH - Community Heroes"}
                              onChange={(e) =>
                                update({
                                  bannerSettings: {
                                    ...(state.bannerSettings || { type: "preset", presetId: "official" }),
                                    title: e.target.value,
                                  },
                                })
                              }
                            />
                          </label>

                          <label className="form-field">
                            Facebook Page URL
                            <input
                              value={
                                state.bannerSettings?.facebookPageUrl ??
                                "https://www.facebook.com/MLBBPHCommunityHeroes"
                              }
                              onChange={(e) =>
                                update({
                                  bannerSettings: {
                                    ...(state.bannerSettings || { type: "preset", presetId: "official" }),
                                    facebookPageUrl: e.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
                {tab === "raffle" && (
                  <section className="admin-panel admin-raffle-panel">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                      <div>
                        <h2>Community Raffle & Giveaways</h2>
                        <p>
                          Configure official community giveaways, set cut-off deadlines, MLBB diamonds or Starlight prizes, and assign winners.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link
                          href="/raffle"
                          target="_blank"
                          className="button outline small"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <Eye size={14} />
                          <span>View Public /raffle Page</span>
                        </Link>
                        <button
                          type="button"
                          className="button outline small"
                          onClick={() => loadRaffleAdmin()}
                          disabled={raffleLoading}
                        >
                          <RefreshCw size={14} className={raffleLoading ? "busy-spinner" : ""} />
                          <span>Refresh</span>
                        </button>
                      </div>
                    </div>

                    {raffleLoading && !raffleData ? (
                      <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <LoaderCircle size={24} className="busy-spinner" />
                        <p style={{ marginTop: 8, color: "#94a3b8" }}>Loading raffle settings…</p>
                      </div>
                    ) : (
                      <>
                        {/* Top Raffle CRUD Bar */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 12,
                            marginBottom: 18,
                            padding: "12px 16px",
                            background: "#111724",
                            border: "1px solid #1e293b",
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ color: "#ffffff", fontSize: 14 }}>
                              Current Edition: {raffleData?.title || "Community Heroes Grand Raffle"}
                            </strong>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: raffleForm.isActive ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                color: raffleForm.isActive ? "#4ade80" : "#f87171",
                                border: `1px solid ${raffleForm.isActive ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                              }}
                            >
                              {raffleForm.isActive ? "Active on /raffle" : "Inactive / Hidden"}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="button primary small"
                              onClick={() => setShowCreateRaffleModal(true)}
                            >
                              <Plus size={14} />
                              <span>Create New Raffle</span>
                            </button>
                            <button
                              type="button"
                              className="button outline small"
                              onClick={handleArchiveCurrentRaffle}
                              title="Archive this raffle and move to Past Winners Archive"
                            >
                              <Archive size={14} />
                              <span>Archive Raffle</span>
                            </button>
                            <button
                              type="button"
                              className="button outline small"
                              onClick={handleDeleteCurrentRaffle}
                              style={{ color: "#f87171", borderColor: "#7f1d1d" }}
                              title="Permanently delete this raffle"
                            >
                              <Trash2 size={14} />
                              <span>Delete Raffle</span>
                            </button>
                          </div>
                        </div>

                        {/* Settings & Configuration Grid */}
                        <form onSubmit={handleSaveRaffleSettings} className="admin-raffle-card" style={{ marginBottom: 20 }}>
                          <div className="admin-raffle-card-header">
                            <Gift size={18} style={{ color: "#facc15" }} />
                            <div>
                              <h3>Raffle Title & Giveaway Settings</h3>
                              <small>Control title, rules, cut-off date & time, and giveaway prizes.</small>
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                            <label className="form-field">
                              Raffle Title
                              <input
                                required
                                value={raffleForm.title}
                                onChange={(e) =>
                                  setRaffleForm((prev) => ({ ...prev, title: e.target.value }))
                                }
                                placeholder="e.g. Community Heroes Grand Raffle"
                              />
                            </label>

                            <label className="form-field">
                              Giveaway Category
                              <input
                                value={raffleForm.category}
                                onChange={(e) =>
                                  setRaffleForm((prev) => ({ ...prev, category: e.target.value }))
                                }
                                placeholder="e.g. Diamonds Giveaway, Starlight…"
                                list="raffle-cat-presets"
                              />
                              <datalist id="raffle-cat-presets">
                                <option value="Diamonds Giveaway" />
                                <option value="Starlight Membership" />
                                <option value="Weekly Diamond Pass" />
                                <option value="Skin Giveaway" />
                                <option value="Tournament Bonus Prize" />
                              </datalist>
                            </label>

                            <label className="form-field">
                              Cut-off Date & Time (Registration Deadline)
                              <input
                                type="datetime-local"
                                value={toLocalDatetimeInput(raffleForm.cutoffDate)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setRaffleForm((prev) => ({
                                    ...prev,
                                    cutoffDate: val ? new Date(val).toISOString() : "",
                                  }));
                                }}
                              />
                            </label>
                          </div>

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "-6px 0 14px" }}>
                            <span style={{ fontSize: 11.5, color: "#94a3b8", alignSelf: "center", marginRight: 4 }}>
                              Quick Deadlines:
                            </span>
                            <button
                              type="button"
                              className="button outline small"
                              style={{ padding: "3px 8px", fontSize: 11 }}
                              onClick={() => {
                                const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                                setRaffleForm((p) => ({ ...p, cutoffDate: d.toISOString() }));
                              }}
                            >
                              +3 Days
                            </button>
                            <button
                              type="button"
                              className="button outline small"
                              style={{ padding: "3px 8px", fontSize: 11 }}
                              onClick={() => {
                                const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                                setRaffleForm((p) => ({ ...p, cutoffDate: d.toISOString() }));
                              }}
                            >
                              +7 Days (1 Week)
                            </button>
                            <button
                              type="button"
                              className="button outline small"
                              style={{ padding: "3px 8px", fontSize: 11 }}
                              onClick={() => {
                                const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
                                setRaffleForm((p) => ({ ...p, cutoffDate: d.toISOString() }));
                              }}
                            >
                              +14 Days (2 Weeks)
                            </button>
                            {raffleForm.cutoffDate && (
                              <button
                                type="button"
                                className="button outline small"
                                style={{ padding: "3px 8px", fontSize: 11, color: "#f87171" }}
                                onClick={() => setRaffleForm((p) => ({ ...p, cutoffDate: "" }))}
                              >
                                Clear deadline
                              </button>
                            )}
                          </div>

                          <label className="form-field" style={{ marginBottom: 14 }}>
                            Description & Giveaway Details
                            <textarea
                              rows={2}
                              value={raffleForm.description}
                              onChange={(e) =>
                                setRaffleForm((prev) => ({ ...prev, description: e.target.value }))
                              }
                              placeholder="Enter your Full Name below to join the official Community Heroes giveaway!"
                            />
                          </label>

                          {/* Prizes List Config with Winner Quotas */}
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                              <label style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1" }}>
                                Prize Pool & Winner Allocations ({raffleForm.prizes.length} {raffleForm.prizes.length === 1 ? "Prize" : "Prizes"} · {raffleForm.prizes.reduce((acc, p) => acc + p.winnerCount, 0)} Total Winners)
                              </label>
                              <span style={{ fontSize: 11.5, color: "#38bdf8" }}>
                                Assign how many winners per prize (e.g. 100 Diamonds × 10 winners)
                              </span>
                            </div>

                            <div className="admin-raffle-prize-row" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <input
                                value={newPrizeName}
                                onChange={(e) => setNewPrizeName(e.target.value)}
                                placeholder="Prize name (e.g. 100 Diamonds, Starlight Card…)"
                                style={{
                                  background: "#0b1120",
                                  border: "1px solid #24334a",
                                  borderRadius: 6,
                                  color: "#ffffff",
                                  padding: "7px 12px",
                                  fontSize: 13,
                                  flex: "1 1 200px",
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const val = newPrizeName.trim();
                                    if (val) {
                                      setRaffleForm((prev) => ({
                                        ...prev,
                                        prizes: [...prev.prizes, { name: val, winnerCount: Math.max(1, newPrizeCount) }],
                                      }));
                                      setNewPrizeName("");
                                      setNewPrizeCount(1);
                                    }
                                  }
                                }}
                              />

                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <label style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>Winners:</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={newPrizeCount}
                                  onChange={(e) => setNewPrizeCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                  style={{
                                    width: 65,
                                    background: "#0b1120",
                                    border: "1px solid #24334a",
                                    borderRadius: 6,
                                    color: "#ffffff",
                                    padding: "7px 8px",
                                    fontSize: 13,
                                    textAlign: "center",
                                  }}
                                />
                              </div>

                              <button
                                type="button"
                                className="button outline small"
                                onClick={() => {
                                  const val = newPrizeName.trim();
                                  if (val) {
                                    setRaffleForm((prev) => ({
                                      ...prev,
                                      prizes: [...prev.prizes, { name: val, winnerCount: Math.max(1, newPrizeCount) }],
                                    }));
                                    setNewPrizeName("");
                                    setNewPrizeCount(1);
                                  }
                                }}
                              >
                                <Plus size={14} />
                                <span>Add Prize Tier</span>
                              </button>
                            </div>

                            {/* Preset Buttons with Winner Quotas */}
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                              <span style={{ fontSize: 11.5, color: "#94a3b8", alignSelf: "center", marginRight: 4 }}>
                                Quick Presets:
                              </span>
                              {[
                                { name: "100 Diamonds", count: 10 },
                                { name: "100 Diamonds", count: 5 },
                                { name: "250 Diamonds", count: 3 },
                                { name: "Starlight Card", count: 1 },
                                { name: "Weekly Diamond Pass", count: 5 },
                              ].map((preset, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="button outline small"
                                  style={{ padding: "3px 8px", fontSize: 11 }}
                                  onClick={() =>
                                    setRaffleForm((prev) => {
                                      const existingIdx = prev.prizes.findIndex(
                                        (p) => p.name.toLowerCase() === preset.name.toLowerCase(),
                                      );
                                      if (existingIdx !== -1) {
                                        const updated = [...prev.prizes];
                                        updated[existingIdx] = { ...updated[existingIdx], winnerCount: preset.count };
                                        return { ...prev, prizes: updated };
                                      }
                                      return {
                                        ...prev,
                                        prizes: [...prev.prizes, { name: preset.name, winnerCount: preset.count }],
                                      };
                                    })
                                  }
                                >
                                  + {preset.name} ({preset.count}x)
                                </button>
                              ))}
                            </div>

                            {/* Current Prizes Tags with Winner Counter Stepper */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                              {raffleForm.prizes.map((p, idx) => (
                                <div
                                  key={p.id || idx}
                                  style={{
                                    background: "#0b1120",
                                    border: "1px solid #1e293b",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <span style={{ color: "#ffffff", fontSize: 12.5, fontWeight: 600 }}>{p.name}</span>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      background: "rgba(56,189,248,0.12)",
                                      border: "1px solid rgba(56,189,248,0.25)",
                                      borderRadius: 4,
                                      padding: "1px 6px",
                                    }}
                                  >
                                    <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700 }}>Winners:</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={500}
                                      value={p.winnerCount}
                                      onChange={(e) => {
                                        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                        setRaffleForm((prev) => {
                                          const copy = [...prev.prizes];
                                          copy[idx] = { ...copy[idx], winnerCount: val };
                                          return { ...prev, prizes: copy };
                                        });
                                      }}
                                      style={{
                                        width: 44,
                                        background: "transparent",
                                        border: "none",
                                        color: "#38bdf8",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        textAlign: "center",
                                        padding: 0,
                                      }}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    title={`Remove ${p.name}`}
                                    onClick={() =>
                                      setRaffleForm((prev) => ({
                                        ...prev,
                                        prizes: prev.prizes.filter((_, i) => i !== idx),
                                      }))
                                    }
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#94a3b8",
                                      cursor: "pointer",
                                      fontSize: 15,
                                      padding: "0 2px",
                                      lineHeight: 1,
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <label className="checkbox-field" style={{ marginBottom: 16 }}>
                            <input
                              type="checkbox"
                              checked={raffleForm.isActive}
                              onChange={(e) =>
                                setRaffleForm((prev) => ({ ...prev, isActive: e.target.checked }))
                              }
                            />
                            <span>Active (Allow public participants to join on /raffle)</span>
                          </label>

                          <button
                            type="submit"
                            className="button primary"
                            disabled={raffleSaving}
                          >
                            {raffleSaving ? (
                              <>
                                <LoaderCircle size={15} className="busy-spinner" />
                                <span>Saving raffle settings…</span>
                              </>
                            ) : (
                              <>
                                <Save size={15} />
                                <span>Save Raffle Settings</span>
                              </>
                            )}
                          </button>
                        </form>

                        {/* Entrants & Winner Assignment Section */}
                        <div className="admin-raffle-card">
                          {raffleData?.entries && raffleData.entries.some((e) => Boolean(e.prizeWon)) && (
                            <div
                              style={{
                                background: "rgba(250, 204, 21, 0.08)",
                                border: "1px solid rgba(250, 204, 21, 0.3)",
                                borderRadius: 8,
                                padding: "14px 16px",
                                marginBottom: 16,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: 12,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <Trophy size={20} style={{ color: "#facc15", flexShrink: 0 }} />
                                <div>
                                  <strong style={{ display: "block", color: "#ffffff", fontSize: 13.5 }}>
                                    Raffle has assigned winners!
                                  </strong>
                                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                                    Ready for the next round? Archive this raffle to preserve results in the public Past Winners Archive and launch a fresh edition.
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="button primary small"
                                onClick={handleArchiveCurrentRaffle}
                                style={{ whiteSpace: "nowrap" }}
                              >
                                <Archive size={14} />
                                <span>Archive & Start New Raffle</span>
                              </button>
                            </div>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                            <div className="admin-raffle-card-header" style={{ margin: 0 }}>
                              <Trophy size={18} style={{ color: "#facc15" }} />
                              <div>
                                <h3>Registered Participants ({raffleData?.entries?.length || 0})</h3>
                                <small>
                                  {raffleData?.entries?.filter((e) => Boolean(e.prizeWon)).length || 0} assigned winners · 1 entry per device
                                </small>
                              </div>
                            </div>

                            {/* Search bar */}
                            <div className="raffle-search-box" style={{ padding: "4px 10px" }}>
                              <Search size={13} />
                              <input
                                placeholder="Search participant…"
                                value={raffleQuery}
                                onChange={(e) => {
                                  setRaffleQuery(e.target.value);
                                  setAdminRafflePage(1);
                                }}
                                style={{ minWidth: 150, fontSize: 12 }}
                              />
                            </div>
                          </div>

                          {/* Quick Manual Participant Entry Form */}
                          <form
                            onSubmit={handleAddManualEntry}
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              flexWrap: "wrap",
                              marginBottom: 14,
                              padding: "8px 12px",
                              background: "#0b1120",
                              border: "1px solid #1e293b",
                              borderRadius: 8,
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1" }}>
                              Manual Entry:
                            </span>
                            <input
                              type="text"
                              placeholder="Full Name (e.g. John Doe)"
                              value={manualEntryName}
                              onChange={(e) => setManualEntryName(e.target.value)}
                              style={{
                                background: "#111724",
                                border: "1px solid #334155",
                                borderRadius: 6,
                                color: "#ffffff",
                                padding: "5px 10px",
                                fontSize: 12,
                                minWidth: 200,
                              }}
                            />
                            <button
                              type="submit"
                              className="button outline small"
                              disabled={!manualEntryName.trim()}
                              style={{ padding: "4px 10px", fontSize: 12 }}
                            >
                              <Plus size={13} />
                              <span>Add Participant</span>
                            </button>
                          </form>

                          {/* Quick Pick Random Winner helper */}
                          {(() => {
                            const normalizedPrizes = raffleForm.prizes;
                            const currentPrizeObj = normalizedPrizes.find(
                              (p) => p.name.toLowerCase() === selectedRandomPrize.toLowerCase(),
                            ) || (normalizedPrizes[0] || { name: selectedRandomPrize, winnerCount: 1 });

                            const awardedForPrize = (raffleData?.entries || []).filter(
                              (e) => (e.prizeWon || "").toLowerCase() === currentPrizeObj.name.toLowerCase(),
                            ).length;
                            const remainingForPrize = Math.max(0, currentPrizeObj.winnerCount - awardedForPrize);
                            const eligibleEntrants = (raffleData?.entries || []).filter((e) => !e.prizeWon);

                            return (
                              <div className="admin-raffle-random-box">
                                <div className="admin-raffle-random-left">
                                  <Shuffle size={18} style={{ color: "#facc15" }} />
                                  <div>
                                    <strong style={{ display: "block", fontSize: 13, color: "#ffffff" }}>
                                      Pick Random Winner Draw
                                    </strong>
                                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                                      Select prize tier to draw. Quota: {awardedForPrize}/{currentPrizeObj.winnerCount} awarded ({remainingForPrize} remaining).
                                    </span>
                                  </div>
                                </div>

                                <div className="admin-raffle-random-actions" style={{ flexWrap: "wrap" }}>
                                  <select
                                    value={selectedRandomPrize}
                                    onChange={(e) => setSelectedRandomPrize(e.target.value)}
                                    style={{
                                      background: "#0b1120",
                                      border: "1px solid #334155",
                                      color: "#ffffff",
                                      padding: "6px 10px",
                                      borderRadius: 6,
                                      fontSize: 12,
                                    }}
                                  >
                                    {normalizedPrizes.map((pz, idx) => {
                                      const won = (raffleData?.entries || []).filter(
                                        (e) => (e.prizeWon || "").toLowerCase() === pz.name.toLowerCase(),
                                      ).length;
                                      const rem = Math.max(0, pz.winnerCount - won);
                                      return (
                                        <option key={idx} value={pz.name}>
                                          {pz.name} ({won}/{pz.winnerCount} awarded · {rem} left)
                                        </option>
                                      );
                                    })}
                                    <option value="Custom Prize">Custom Prize…</option>
                                  </select>

                                  {selectedRandomPrize === "Custom Prize" && (
                                    <input
                                      type="text"
                                      placeholder="Type prize name"
                                      onChange={(e) => setSelectedRandomPrize(e.target.value)}
                                      style={{
                                        background: "#0b1120",
                                        border: "1px solid #334155",
                                        color: "#ffffff",
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        width: 130,
                                      }}
                                    />
                                  )}

                                  <button
                                    type="button"
                                    className="button primary small"
                                    onClick={() => handlePickRandomWinner(1)}
                                    disabled={!eligibleEntrants.length || remainingForPrize === 0}
                                    title="Draw 1 random winner"
                                  >
                                    <Shuffle size={14} />
                                    <span>🎲 Draw 1 Winner</span>
                                  </button>

                                  {remainingForPrize > 1 && (
                                    <button
                                      type="button"
                                      className="button outline small"
                                      style={{ borderColor: "#0284c7", color: "#38bdf8" }}
                                      onClick={() => handlePickRandomWinner(remainingForPrize)}
                                      disabled={!eligibleEntrants.length}
                                      title={`Draw all ${remainingForPrize} remaining winners for this prize tier`}
                                    >
                                      <Shuffle size={14} />
                                      <span>Draw All Remaining ({remainingForPrize})</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Entrants Table */}
                          {(!raffleData?.entries || raffleData.entries.length === 0) ? (
                            <div style={{ textAlign: "center", padding: "30px 16px", color: "#94a3b8", fontSize: 13 }}>
                              No users have registered for the raffle yet. Share your /raffle link to collect entries!
                            </div>
                          ) : (
                            <div className="admin-table-wrap">
                              <table className="admin-raffle-entries-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: 45 }}>#</th>
                                    <th>FULL NAME</th>
                                    <th>REGISTERED</th>
                                    <th>ASSIGNED PRIZE</th>
                                    <th style={{ textAlign: "right", width: 80 }}>ACTION</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const filtered = (raffleData.entries || []).filter(
                                      (e) =>
                                        !raffleQuery.trim() ||
                                        e.fullName.toLowerCase().includes(raffleQuery.toLowerCase().trim()),
                                    );
                                    const totalAdminPages = Math.max(1, Math.ceil(filtered.length / ADMIN_ENTRIES_PER_PAGE));
                                    const safeAdminPage = Math.min(Math.max(1, adminRafflePage), totalAdminPages);
                                    const adminStartIndex = (safeAdminPage - 1) * ADMIN_ENTRIES_PER_PAGE;
                                    const pageItems = filtered.slice(adminStartIndex, adminStartIndex + ADMIN_ENTRIES_PER_PAGE);

                                    return pageItems.map((entry, idx) => {
                                      const hasPrize = Boolean(entry.prizeWon);
                                      const currentVal = assignDropdownValue[entry.id] || "";
                                      return (
                                        <tr key={entry.id || idx}>
                                          <td style={{ color: "#64748b", fontWeight: 700 }}>#{adminStartIndex + idx + 1}</td>
                                          <td>
                                            <strong style={{ color: "#ffffff", fontSize: 13.5 }}>
                                              {entry.fullName}
                                            </strong>
                                            {hasPrize && (
                                              <span
                                                style={{
                                                  marginLeft: 8,
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  gap: 3,
                                                  fontSize: 10,
                                                  fontWeight: 700,
                                                  background: "rgba(250, 204, 21, 0.15)",
                                                  color: "#facc15",
                                                  border: "1px solid rgba(250, 204, 21, 0.3)",
                                                  padding: "1px 6px",
                                                  borderRadius: 4,
                                                }}
                                              >
                                                WINNER
                                              </span>
                                            )}
                                          </td>
                                          <td style={{ fontSize: 11.5, color: "#94a3b8" }}>
                                            {entry.createdAt
                                              ? new Date(entry.createdAt).toLocaleDateString("en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                                  hour: "numeric",
                                                  minute: "2-digit",
                                                })
                                              : "—"}
                                          </td>
                                          <td>
                                            {hasPrize ? (
                                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span
                                                  style={{
                                                    color: "#38bdf8",
                                                    fontWeight: 700,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 5,
                                                  }}
                                                >
                                                  <Crown size={14} style={{ color: "#facc15" }} />
                                                  {entry.prizeWon}
                                                </span>
                                                <button
                                                  type="button"
                                                  className="button outline small"
                                                  style={{ padding: "2px 6px", fontSize: 10, color: "#f87171" }}
                                                  onClick={() => handleAssignPrize(entry.id, null)}
                                                  title="Remove prize"
                                                >
                                                  Clear
                                                </button>
                                              </div>
                                            ) : (
                                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <select
                                                  value={currentVal}
                                                  onChange={(e) => {
                                                    const val = e.target.value;
                                                    setAssignDropdownValue((p) => ({ ...p, [entry.id]: val }));
                                                    if (val) {
                                                      void handleAssignPrize(entry.id, val);
                                                      setAssignDropdownValue((p) => ({ ...p, [entry.id]: "" }));
                                                    }
                                                  }}
                                                  style={{
                                                    background: "#0b1120",
                                                    border: "1px solid #334155",
                                                    color: "#cbd5e1",
                                                    padding: "4px 8px",
                                                    borderRadius: 6,
                                                    fontSize: 11.5,
                                                  }}
                                                >
                                                  <option value="">Assign Prize…</option>
                                                  {raffleForm.prizes.map((p, i) => {
                                                    const wonCount = (raffleData?.entries || []).filter(
                                                      (e) => (e.prizeWon || "").toLowerCase() === p.name.toLowerCase(),
                                                    ).length;
                                                    const isFull = wonCount >= p.winnerCount;
                                                    return (
                                                      <option key={i} value={p.name}>
                                                        {p.name} ({wonCount}/{p.winnerCount} {isFull ? "· Full" : "awarded"})
                                                      </option>
                                                    );
                                                  })}
                                                </select>
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ textAlign: "right" }}>
                                            <button
                                              type="button"
                                              className="icon-button"
                                              style={{ color: "#ef4444", padding: 4 }}
                                              onClick={() => handleDeleteRaffleEntry(entry.id, entry.fullName)}
                                              title={`Delete ${entry.fullName}'s entry`}
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>

                              {(() => {
                                const filtered = (raffleData.entries || []).filter(
                                  (e) =>
                                    !raffleQuery.trim() ||
                                    e.fullName.toLowerCase().includes(raffleQuery.toLowerCase().trim()),
                                );
                                const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_ENTRIES_PER_PAGE));
                                const safePage = Math.min(Math.max(1, adminRafflePage), totalPages);
                                const adminStartIndex = (safePage - 1) * ADMIN_ENTRIES_PER_PAGE;
                                if (totalPages <= 1) return null;

                                return (
                                  <div className="raffle-pagination-footer" style={{ padding: "10px 14px", margin: 0 }}>
                                    <span className="raffle-pagination-info">
                                      Showing <strong>{adminStartIndex + 1}–{Math.min(adminStartIndex + ADMIN_ENTRIES_PER_PAGE, filtered.length)}</strong> of <strong>{filtered.length}</strong> entries
                                    </span>

                                    <div className="raffle-pagination-controls">
                                      <button
                                        type="button"
                                        className="raffle-page-btn"
                                        disabled={safePage === 1}
                                        onClick={() => setAdminRafflePage((p) => Math.max(1, p - 1))}
                                        title="Previous page"
                                      >
                                        <ChevronLeft size={14} />
                                        <span>Prev</span>
                                      </button>

                                      <span style={{ fontSize: 12, color: "#94a3b8", padding: "0 6px" }}>
                                        Page {safePage} of {totalPages}
                                      </span>

                                      <button
                                        type="button"
                                        className="raffle-page-btn"
                                        disabled={safePage === totalPages}
                                        onClick={() => setAdminRafflePage((p) => Math.min(totalPages, p + 1))}
                                        title="Next page"
                                      >
                                        <span>Next</span>
                                        <ChevronRight size={14} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                            <button
                              type="button"
                              className="button outline small"
                              onClick={handleArchiveCurrentRaffle}
                              style={{ borderColor: "#334155" }}
                            >
                              <Archive size={13} />
                              <span>Archive Current Raffle & Start New Edition</span>
                            </button>

                            {raffleData?.entries && raffleData.entries.length > 0 && (
                              <button
                                type="button"
                                className="button outline small"
                                style={{ color: "#f87171", borderColor: "#7f1d1d" }}
                                onClick={handleClearAllRaffleEntries}
                              >
                                <Trash2 size={13} />
                                <span>Reset / Clear All Entries</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Archived Raffles History */}
                        {archivedRaffles && archivedRaffles.length > 0 && (
                          <div className="admin-raffle-card" style={{ marginTop: 20 }}>
                            <div className="admin-raffle-card-header">
                              <Archive size={18} style={{ color: "#38bdf8" }} />
                              <div>
                                <h3>Archived Raffles History ({archivedRaffles.length})</h3>
                                <small>Past completed raffles preserved in database and visible in public archive</small>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              {archivedRaffles.map((arch, idx) => (
                                <div
                                  key={arch.id || idx}
                                  style={{
                                    background: "#0b1120",
                                    border: "1px solid #1e293b",
                                    borderRadius: 8,
                                    padding: "12px 16px",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                    <div>
                                      <strong style={{ color: "#ffffff", fontSize: 14 }}>{arch.title}</strong>
                                      <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
                                        Cut-off: {arch.cutoffDate ? new Date(arch.cutoffDate).toLocaleDateString() : "—"} · {arch.entriesCount} participants
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                      <span style={{ fontSize: 11.5, color: "#facc15", fontWeight: 700, background: "rgba(250, 204, 21, 0.1)", padding: "3px 8px", borderRadius: 4 }}>
                                        {arch.winners?.length || 0} Winner{arch.winners?.length !== 1 ? "s" : ""}
                                      </span>
                                      <button
                                        type="button"
                                        className="button outline small"
                                        style={{ padding: "3px 8px", fontSize: 11.5 }}
                                        onClick={() => {
                                          setEditingArchive(arch);
                                          setEditingArchiveForm({
                                            title: arch.title,
                                            description: arch.description || "",
                                          });
                                        }}
                                        title="Edit archive title & description"
                                      >
                                        <Pencil size={11} />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="button outline small"
                                        style={{ padding: "3px 8px", fontSize: 11.5, color: "#38bdf8", borderColor: "#0369a1" }}
                                        onClick={() => handleRestoreArchive(arch.id)}
                                        title="Restore this raffle back to active edition"
                                      >
                                        <RotateCcw size={11} />
                                        <span>Restore</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="icon-button"
                                        style={{ color: "#ef4444", padding: 4 }}
                                        onClick={() => handleDeleteArchive(arch.id, arch.title)}
                                        title={`Delete archive "${arch.title}"`}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                  {arch.winners && arch.winners.length > 0 && (
                                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {arch.winners.map((w, wIdx) => (
                                        <span
                                          key={w.id || wIdx}
                                          style={{
                                            fontSize: 11,
                                            background: "#1e293b",
                                            color: "#e2e8f0",
                                            padding: "3px 8px",
                                            borderRadius: 4,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4,
                                          }}
                                        >
                                          <Trophy size={11} style={{ color: "#facc15" }} />
                                          <strong>{w.fullName}</strong>
                                          <span style={{ color: "#38bdf8" }}>({w.prizeWon})</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}
              </fieldset>
              <div className="admin-save-bar">
                <span aria-live="polite">
                  {busy
                    ? `${busy === "detect" ? "Checking registration sources" : "Working"}…`
                    : dirty
                      ? "You have unpublished changes."
                      : "Your directory is up to date."}
                </span>
                <div>
                  {dirty && (
                    <button
                      className="button outline small"
                      disabled={!!busy}
                      onClick={() =>
                        run("reset", async () => {
                          setState(await api("/api/app-state"));
                          setDirty(false);
                          setMessage("Unpublished changes discarded.");
                        })
                      }
                    >
                      Discard
                    </button>
                  )}
                  <button
                    className="button primary"
                    disabled={!dirty || !!busy}
                    onClick={save}
                  >
                    {busy === "save" ? (
                      <LoaderCircle size={15} className="busy-spinner" />
                    ) : (
                      <Save size={15} />
                    )}
                    Publish changes
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </main>
      <Footer logoUrl={state?.logoUrl} />
      {editing && state && (
        <EditTournament
          player={editing}
          onClose={() => setEditing(null)}
          onSave={(player) => {
            const existing = state.players.find((p) => p.id === player.id);
            const selected = new Set(
              state.selectedNicknames ||
                state.players.filter((p) => p.active).map((p) => p.chNickname),
            );
            if (existing) selected.delete(existing.chNickname);
            if (player.active) selected.add(player.chNickname);
            update({
              players: existing
                ? state.players.map((p) => (p.id === player.id ? player : p))
                : [...state.players, player],
              selectedNicknames: [...selected],
            });
            setEditing(null);
          }}
        />
      )}
      {imported && state && (
        <Modal
          title="Preview sheet import"
          wide
          onClose={() => setImported(null)}
        >
          <h2>A new lineup, ready to review.</h2>
          <p className="modal-lead">
            {imported.length} tournaments found. Applying this import replaces
            the current draft directory. The public lineup changes only after
            you publish.
          </p>
          <div
            className="admin-table-wrap"
            style={{ maxHeight: 300, margin: "20px 0" }}
          >
            <table className="admin-table" style={{ minWidth: 400 }}>
              <thead>
                <tr>
                  <th>HERO</th>
                  <th>AREA</th>
                  <th>TEAMS</th>
                  <th>ACTIVE</th>
                </tr>
              </thead>
              <tbody>
                {imported.map((p) => (
                  <tr key={p.id}>
                    <td>{p.chNickname}</td>
                    <td>{p.area}</td>
                    <td>
                      {p.teamsRegistered}/{p.maxTeams}
                    </td>
                    <td>{p.active ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-footer" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              className="button outline"
              onClick={() => setImported(null)}
            >
              Cancel
            </button>
            <button
              className="button outline"
              onClick={() => {
                update({
                  players: imported,
                  selectedNicknames: imported
                    .filter((p) => p.active)
                    .map((p) => p.chNickname),
                  rawTabsList: [
                    ...new Set([
                      ...(state.rawTabsList || []),
                      state.activeTabName || "",
                    ]),
                  ].filter(Boolean),
                });
                setImported(null);
                setTab("directory");
                setMessage(
                  "Import saved as draft. You can review the listings and click 'Publish changes' whenever ready.",
                );
              }}
            >
              Save as draft <CheckCircle2 size={15} />
            </button>
            <button
              className="button primary"
              disabled={!!busy}
              onClick={async () => {
                await run("publish-import", async () => {
                  const nextState: AppState = {
                    ...state,
                    players: imported,
                    selectedNicknames: imported
                      .filter((p) => p.active)
                      .map((p) => p.chNickname),
                    rawTabsList: [
                      ...new Set([
                        ...(state.rawTabsList || []),
                        state.activeTabName || "",
                      ]),
                    ].filter(Boolean),
                  };
                  const saved = await api("/api/app-state", post(nextState));
                  setState(saved);
                  setDirty(false);
                  setImported(null);
                  setTab("directory");
                  setMessage(
                    `Saved to database and published! ${imported.filter((p) => p.active).length} Community Heroes are now live in the directory.`,
                  );
                  // Fire background sync to inspect response sheets and update rosters
                  void api("/api/sync-now", post({})).then(async () => {
                    try {
                      const fresh = await api("/api/app-state");
                      setState(fresh);
                    } catch {}
                  });
                });
              }}
            >
              <Upload size={15} />
              {busy === "publish-import" ? "Saving to database…" : "Publish to directory now"}
            </button>
          </div>
        </Modal>
      )}

      {showCreateRaffleModal && (
        <Modal title="Create New Raffle Edition" onClose={() => setShowCreateRaffleModal(false)}>
          <h2>Launch a new community giveaway</h2>
          <p className="modal-lead">
            Set up the prize pool, deadline, and title for this new raffle edition.
          </p>
          <form onSubmit={handleCreateNewRaffle} style={{ marginTop: 20 }}>
            <div className="form-grid">
              <label className="form-field">
                Raffle Title
                <input
                  required
                  value={createRaffleForm.title}
                  onChange={(e) =>
                    setCreateRaffleForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="e.g. Community Heroes Weekly Starlight Giveaway"
                />
              </label>
              <label className="form-field">
                Giveaway Category
                <input
                  value={createRaffleForm.category}
                  onChange={(e) =>
                    setCreateRaffleForm((p) => ({ ...p, category: e.target.value }))
                  }
                  placeholder="e.g. Diamonds Giveaway, Starlight…"
                  list="create-raffle-cat-presets"
                />
                <datalist id="create-raffle-cat-presets">
                  <option value="Diamonds Giveaway" />
                  <option value="Starlight Membership" />
                  <option value="Weekly Diamond Pass" />
                  <option value="Skin Giveaway" />
                  <option value="Tournament Bonus Prize" />
                </datalist>
              </label>
              <label className="form-field span-two">
                Cut-off Date & Time (Registration Deadline)
                <input
                  type="datetime-local"
                  value={toLocalDatetimeInput(createRaffleForm.cutoffDate)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCreateRaffleForm((p) => ({
                      ...p,
                      cutoffDate: val ? new Date(val).toISOString() : "",
                    }));
                  }}
                />
              </label>
              <label className="form-field span-two">
                Description & Details
                <textarea
                  rows={2}
                  value={createRaffleForm.description}
                  onChange={(e) =>
                    setCreateRaffleForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Official giveaway for MLBB players. Enter your Full Name below to participate!"
                />
              </label>
            </div>

            {/* Quick Prizes Config with Winner Quotas */}
            <div style={{ margin: "14px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1" }}>
                  Prizes & Winner Quotas ({createRaffleForm.prizes.length} {createRaffleForm.prizes.length === 1 ? "Prize" : "Prizes"} · {createRaffleForm.prizes.reduce((acc, p) => acc + p.winnerCount, 0)} Total Winners)
                </label>
                <span style={{ fontSize: 11, color: "#38bdf8" }}>
                  Set winners per prize tier
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Prize name (e.g. 100 Diamonds)"
                  value={createPrizeName}
                  onChange={(e) => setCreatePrizeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = createPrizeName.trim();
                      if (val) {
                        setCreateRaffleForm((p) => ({
                          ...p,
                          prizes: [...p.prizes, { name: val, winnerCount: Math.max(1, createPrizeCount) }],
                        }));
                        setCreatePrizeName("");
                        setCreatePrizeCount(1);
                      }
                    }
                  }}
                  style={{
                    background: "#0b1120",
                    border: "1px solid #334155",
                    borderRadius: 6,
                    color: "#ffffff",
                    padding: "6px 10px",
                    fontSize: 12,
                    flex: "1 1 180px",
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <label style={{ fontSize: 11.5, color: "#94a3b8", whiteSpace: "nowrap" }}>Winners:</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={createPrizeCount}
                    onChange={(e) => setCreatePrizeCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{
                      width: 60,
                      background: "#0b1120",
                      border: "1px solid #334155",
                      borderRadius: 6,
                      color: "#ffffff",
                      padding: "6px 8px",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="button outline small"
                  onClick={() => {
                    const val = createPrizeName.trim();
                    if (val) {
                      setCreateRaffleForm((p) => ({
                        ...p,
                        prizes: [...p.prizes, { name: val, winnerCount: Math.max(1, createPrizeCount) }],
                      }));
                      setCreatePrizeName("");
                      setCreatePrizeCount(1);
                    }
                  }}
                >
                  <Plus size={13} />
                  <span>Add Prize Tier</span>
                </button>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {[
                  { name: "100 Diamonds", count: 10 },
                  { name: "100 Diamonds", count: 5 },
                  { name: "250 Diamonds", count: 3 },
                  { name: "Starlight Card", count: 1 },
                  { name: "Weekly Diamond Pass", count: 5 },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="button outline small"
                    style={{ padding: "3px 8px", fontSize: 11 }}
                    onClick={() =>
                      setCreateRaffleForm((p) => ({
                        ...p,
                        prizes: [...p.prizes, { name: preset.name, winnerCount: preset.count }],
                      }))
                    }
                  >
                    + {preset.name} ({preset.count}x)
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {createRaffleForm.prizes.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    style={{
                      background: "#0b1120",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                      padding: "5px 8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ color: "#ffffff", fontSize: 12 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700, background: "rgba(56,189,248,0.15)", padding: "1px 6px", borderRadius: 4 }}>
                      × {p.winnerCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCreateRaffleForm((prev) => ({
                          ...prev,
                          prizes: prev.prizes.filter((_, i) => i !== idx),
                        }))
                      }
                      title={`Remove ${p.name}`}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: "0 2px",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <label className="checkbox-field" style={{ marginBottom: 18 }}>
              <input
                type="checkbox"
                checked={createRaffleForm.isActive}
                onChange={(e) =>
                  setCreateRaffleForm((p) => ({ ...p, isActive: e.target.checked }))
                }
              />
              <span>Active immediately (Accept entries on /raffle)</span>
            </label>

            <div className="modal-footer">
              <button
                type="button"
                className="button outline"
                onClick={() => setShowCreateRaffleModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="button primary">
                <Plus size={14} />
                <span>Create & Publish Raffle</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingArchive && (
        <Modal title="Edit Archived Raffle" onClose={() => setEditingArchive(null)}>
          <h2>Update Archive Details</h2>
          <p className="modal-lead">
            Update the title and description visible in the public Past Winners Archive.
          </p>
          <form onSubmit={handleSaveEditArchive} style={{ marginTop: 20 }}>
            <label className="form-field" style={{ marginBottom: 14 }}>
              Archived Raffle Title
              <input
                required
                value={editingArchiveForm.title}
                onChange={(e) =>
                  setEditingArchiveForm((p) => ({ ...p, title: e.target.value }))
                }
              />
            </label>
            <label className="form-field" style={{ marginBottom: 18 }}>
              Description / Notes
              <textarea
                rows={3}
                value={editingArchiveForm.description}
                onChange={(e) =>
                  setEditingArchiveForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </label>
            <div className="modal-footer">
              <button
                type="button"
                className="button outline"
                onClick={() => setEditingArchive(null)}
              >
                Cancel
              </button>
              <button type="submit" className="button primary">
                <Save size={14} />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function EditTournament({
  player,
  onSave,
  onClose,
}: {
  player: CHPlayer;
  onSave: (player: CHPlayer) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(player);
  const [error, setError] = useState("");
  const field = (key: keyof CHPlayer, value: string | number | boolean) =>
    setDraft((p) => ({ ...p, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { playerSchema } = await import("@/server/validation");
    const result = playerSchema.safeParse({
      ...draft,
      tournamentPostingLink: draft.registrationFormLink,
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    onSave(result.data);
  }
  return (
    <Modal title="Edit tournament" wide onClose={onClose}>
      <h2>Your tournament, in the spotlight.</h2>
      <p className="modal-lead">
        Keep the details clear so your next challengers know where to go.
      </p>
      <form onSubmit={submit} style={{ marginTop: 23 }}>
        <div className="form-grid">
          <label className="form-field">
            Community Hero nickname
            <input
              required
              maxLength={80}
              value={draft.chNickname}
              onChange={(e) => field("chNickname", e.target.value)}
            />
          </label>
          <label className="form-field">
            Full name
            <input
              required
              maxLength={200}
              value={draft.fullName}
              onChange={(e) => field("fullName", e.target.value)}
            />
          </label>
          <label className="form-field">
            City / province
            <input
              required
              maxLength={150}
              value={draft.area}
              onChange={(e) => field("area", e.target.value)}
            />
          </label>
          <label className="form-field">
            Registration status
            <select
              value={draft.formStatus || "open"}
              onChange={(e) => field("formStatus", e.target.value)}
            >
              <option value="open">Open</option>
              <option value="closed">Closed by organizer</option>
              <option value="full">Fully booked</option>
              <option value="error">Source needs review</option>
              <option value="checking">Awaiting source check</option>
            </select>
          </label>
          <label className="form-field">
            Teams registered
            <input
              type="number"
              min={0}
              max={10000}
              required
              value={draft.teamsRegistered}
              onChange={(e) => field("teamsRegistered", Number(e.target.value))}
            />
          </label>
          <label className="form-field">
            Maximum teams
            <input
              type="number"
              min={1}
              max={1024}
              required
              value={draft.maxTeams}
              onChange={(e) => field("maxTeams", Number(e.target.value))}
            />
          </label>
          <label className="form-field span-two">
            Registration form link
            <input
              type="url"
              value={draft.registrationFormLink}
              onChange={(e) => {
                field("registrationFormLink", e.target.value);
                field("resolvedFormUrl", "");
              }}
            />
          </label>
          <label className="form-field span-two">
            Response sheet link
            <input
              type="url"
              value={draft.tournamentResponseSheet}
              onChange={(e) => field("tournamentResponseSheet", e.target.value)}
            />
          </label>
          <label className="form-field span-two">
            Facebook profile link
            <input
              type="url"
              value={draft.facebookProfileUrl || ""}
              onChange={(e) => field("facebookProfileUrl", e.target.value)}
            />
          </label>
          <label className="form-field span-two">
            Tournament notes
            <textarea
              value={draft.remarks || ""}
              maxLength={3000}
              onChange={(e) => field("remarks", e.target.value)}
              placeholder="Add schedule details, rules, or a note for your players."
            />
          </label>
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={!!draft.isCalabarzon}
            onChange={(e) => field("isCalabarzon", e.target.checked)}
          />
          Located in CALABARZON
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => field("active", e.target.checked)}
          />
          Show in the public directory
        </label>
        {error && (
          <div className="feedback error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="button outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            Save to draft <CheckCircle2 size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
