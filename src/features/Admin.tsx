"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Crown,
  Download,
  FileSpreadsheet,
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
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import type { AppState, CHPlayer } from "@/types";
import { parseCsvOrTsv, transformRowsToPlayers } from "@/utils/sheetDetector";
import { slotsLeft, statusLabels, tournamentStatus } from "@/lib/tournaments";
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

  useEffect(() => {
    api("/api/auth")
      .then(async (data) => {
        setConfigured(data.configured);
        if (data.adminEmail) setAdminEmail(data.adminEmail);
        if (data.authenticated) {
          setState(await api("/api/app-state"));
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
  function handleImageUpload(file: File, field: "logoUrl" | "bannerUrl") {
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setError("Please select an image file under 2.5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      update({ [field]: dataUrl });
      setMessage(
        `${field === "logoUrl" ? "Logo" : "Banner"} updated. Click "Publish changes" to save.`,
      );
    };
    reader.onerror = () => {
      setError("Failed to read the image file.");
    };
    reader.readAsDataURL(file);
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
  async function importSheet() {
    if (!state) return;
    await run("import", async () => {
      const data = await api(
        `/api/sheets/data?url=${encodeURIComponent(state.spreadsheetUrl || "")}&sheet=${encodeURIComponent(state.activeTabName || "")}`,
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
      const result = await auth.googleSignIn();
      setToken(result.accessToken);
      setGoogleEmail(result.user.email || "Google account");
      setMessage(
        "Google connected. You can now read sheets shared with this account.",
      );
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
          {error}
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
            <Link className="button outline small" href="/">
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
              <span className="modal-symbol">
                <ShieldCheck size={24} />
              </span>
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
                          {
                            state.players.filter(
                              (p) =>
                                p.active &&
                                (!state.selectedNicknames ||
                                  state.selectedNicknames.includes(p.chNickname)),
                            ).length
                          }
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
                              <tr key={p.id}>
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
                                <td>{p.area}</td>
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
                                  <input
                                    type="checkbox"
                                    aria-label={`Show ${p.chNickname} in public directory`}
                                    checked={
                                      p.active &&
                                      (!state.selectedNicknames ||
                                        state.selectedNicknames.includes(
                                          p.chNickname,
                                        ))
                                    }
                                    onChange={(e) => {
                                      const active = e.target.checked;
                                      update({
                                        players: state.players.map((item) =>
                                          item.id === p.id
                                            ? { ...item, active }
                                            : item,
                                        ),
                                        selectedNicknames: active
                                          ? [
                                              ...new Set([
                                                ...(state.selectedNicknames ||
                                                  state.players
                                                    .filter(
                                                      (item) => item.active,
                                                    )
                                                    .map(
                                                      (item) => item.chNickname,
                                                    )),
                                                p.chNickname,
                                              ]),
                                            ]
                                          : (
                                              state.selectedNicknames ||
                                              state.players.map(
                                                (item) => item.chNickname,
                                              )
                                            ).filter((n) => n !== p.chNickname),
                                      });
                                    }}
                                  />
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
                      <input
                        type="url"
                        value={state.spreadsheetUrl || ""}
                        placeholder="https://docs.google.com/spreadsheets/d/…"
                        onChange={(e) =>
                          update({ spreadsheetUrl: e.target.value })
                        }
                      />
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
                    <button className="button primary" onClick={importSheet}>
                      <Upload size={15} />
                      Preview sheet import
                    </button>
                    <button className="button outline" onClick={googleSignIn}>
                      {googleEmail
                        ? `Connected: ${googleEmail}`
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
                    <p className="info-note">
                      Use the visibility switch in Directory to control which
                      tournaments appear publicly. Existing registration and
                      social links are preserved when you edit a listing.
                    </p>
                  </section>
                )}
                {tab === "branding" && (
                  <section className="admin-panel" style={{ maxWidth: 960 }}>
                    <h2>Logo & Hero Banner</h2>
                    <p>
                      Personalize the Community Heroes tournament directory visuals. Upload your own image files or provide direct image links.
                    </p>
                    <div className="branding-grid">
                      {/* Logo Section */}
                      <div className="branding-card">
                        <div className="branding-card-header">
                          <ImageIcon size={18} />
                          <div>
                            <h3>Logo picture</h3>
                            <small>Displayed in the top navigation header and footer.</small>
                          </div>
                        </div>
                        <div className="branding-preview-box">
                          <div className="branding-logo-preview">
                            {state.logoUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={state.logoUrl}
                                alt="Logo preview"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "contain",
                                  borderRadius: 8,
                                }}
                              />
                            ) : (
                              <div style={{ textAlign: "center" }}>
                                <span className="brand-mark" style={{ transform: "none", margin: "0 auto" }}>
                                  <Crown size={24} strokeWidth={2.3} />
                                </span>
                                <span style={{ display: "block", fontSize: 10, marginTop: 4, color: "#94a3b8" }}>
                                  Default Crown
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="branding-preview-meta">
                            <strong>{state.logoUrl ? "Custom logo active" : "Default crown emblem"}</strong>
                            <p>Recommended: Square PNG, SVG, or WebP with transparent background (120×120px or higher).</p>
                          </div>
                        </div>
                        <div className="branding-inputs">
                          <label className="form-field" style={{ marginBottom: 12 }}>
                            Image URL
                            <input
                              value={state.logoUrl || ""}
                              onChange={(e) => update({ logoUrl: e.target.value })}
                              placeholder="https://example.com/logo.png"
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
                            {state.logoUrl && (
                              <button
                                type="button"
                                className="button outline small"
                                onClick={() => {
                                  update({ logoUrl: "" });
                                  setMessage("Logo restored to default Crown. Click 'Publish changes' to save.");
                                }}
                              >
                                <RotateCcw size={14} />
                                Reset to default
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
                            <h3>Hero Banner picture</h3>
                            <small>Top header banner for the Community Heroes public directory.</small>
                          </div>
                        </div>
                        <div className="branding-preview-box">
                          <div className="branding-banner-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={state.bannerUrl || "/images/hero-knight.png"}
                              alt="Hero banner preview"
                            />
                            <div className="ch-banner-shade" style={{ position: "absolute", inset: 0 }} />
                            <div className="branding-banner-preview-text">
                              <span className="eyebrow" style={{ fontSize: 7, letterSpacing: 1 }}>MLBB PH · COMMUNITY HEROES</span>
                              <strong style={{ fontSize: 13, display: "block", color: "#fff", marginTop: 2 }}>Choose your CH. Join the game.</strong>
                            </div>
                          </div>
                          <div className="branding-preview-meta">
                            <strong>{state.bannerUrl && state.bannerUrl !== "/images/hero-knight.png" ? "Custom banner active" : "Default hero banner"}</strong>
                            <p>Recommended: 1920×600px or 16:9 ratio, JPG, WebP, or PNG.</p>
                          </div>
                        </div>
                        <div className="branding-inputs">
                          <label className="form-field" style={{ marginBottom: 12 }}>
                            Image URL
                            <input
                              value={state.bannerUrl || ""}
                              onChange={(e) => update({ bannerUrl: e.target.value })}
                              placeholder="/images/hero-knight.png or https://example.com/banner.jpg"
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
                            {state.bannerUrl && state.bannerUrl !== "/images/hero-knight.png" && (
                              <button
                                type="button"
                                className="button outline small"
                                onClick={() => {
                                  update({ bannerUrl: "/images/hero-knight.png" });
                                  setMessage("Banner restored to default knight image. Click 'Publish changes' to save.");
                                }}
                              >
                                <RotateCcw size={14} />
                                Reset to default
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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
          <div className="modal-footer">
            <button
              className="button outline"
              onClick={() => setImported(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
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
                  "Import applied to your draft. Review the listings and publish when ready.",
                );
              }}
            >
              Apply to draft <CheckCircle2 size={15} />
            </button>
          </div>
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
