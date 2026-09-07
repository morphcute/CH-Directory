"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Eye,
  Gift,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Search,
} from "lucide-react";
import type { AppState, CHPlayer } from "@/types";
import {
  canRegister,
  listedPlayers,
  slotsLeft,
  tournamentStatus,
  registeredTeamsCount,
  isTabDatePassed,
} from "@/lib/tournaments";
import { Brand } from "./shared";
import { cleanAreaString } from "@/utils/sheetDetector";
import { CHCardModal } from "./CHCardModal";

export function Portal({ initialState }: { initialState: AppState }) {
  const [state, setState] = useState(initialState);
  const [pageViews, setPageViews] = useState<number>(state.pageViews || 0);
  const [selectedPlayer, setSelectedPlayer] = useState<CHPlayer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed">("open");
  const [searchQuery, setSearchQuery] = useState("");

  const players = listedPlayers(state);
  const datePassed = isTabDatePassed(state.activeTabName);
  const month = (state.activeTabName || "September 5, 2026").replace(
    /\s+\d{1,2},/,
    "",
  );
  const openCount = players.filter((p) => {
    const s = tournamentStatus(p, state.activeTabName);
    return s === "open" || s === "closing";
  }).length;

  const closedCount = players.filter((p) => {
    const s = tournamentStatus(p, state.activeTabName);
    return s === "full" || s === "closed";
  }).length;

  const filteredPlayers = players.filter((p) => {
    const s = tournamentStatus(p, state.activeTabName);
    const isOpen = s === "open" || s === "closing";
    if (statusFilter === "open" && !isOpen) return false;
    if (statusFilter === "closed" && isOpen) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNick = (p.chNickname || "").toLowerCase().includes(q);
      const matchArea = (p.area || "").toLowerCase().includes(q);
      const matchName = (p.fullName || "").toLowerCase().includes(q);
      return matchNick || matchArea || matchName;
    }
    return true;
  });

  async function refresh() {
    try {
      const response = await fetch("/api/app-state", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setState(await response.json());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const sync = async () => {
      try {
        const response = await fetch("/api/app-state", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        setState(await response.json());
        setOffline(false);
      } catch {
        if (!controller.signal.aborted) setOffline(true);
      }
    };
    const timer = setInterval(sync, 60_000);
    window.addEventListener("focus", sync);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", sync);
    };
  }, []);

  // Track page view with cooldown deduplication (does not inflate count on rapid refresh)
  useEffect(() => {
    let isMounted = true;
    const trackView = async () => {
      try {
        const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown
        const now = Date.now();
        const lastRecorded = localStorage.getItem("ch_pv_time");
        const isCooledDown =
          lastRecorded && now - Number(lastRecorded) < COOLDOWN_MS;

        if (isCooledDown) {
          // If refreshed within 30 min, do NOT increment! Just get the latest count
          const res = await fetch("/api/page-view", { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            if (isMounted && typeof data.pageViews === "number") {
              setPageViews(data.pageViews);
            }
          }
          return;
        }

        // Beyond cooldown: record new view
        const res = await fetch("/api/page-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem("ch_pv_time", String(now));
          if (isMounted && typeof data.pageViews === "number") {
            setPageViews(data.pageViews);
          }
        }
      } catch {
        // Silently ignore network failures
      }
    };

    trackView();
    return () => {
      isMounted = false;
    };
  }, []);

  async function register(id: string) {
    setBusy(id);
    setError("");
    try {
      // Check the published record again before exposing its registration link.
      const response = await fetch(
        `/api/register?id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) {
        await refresh();
        throw new Error(data.error || "Registration is unavailable.");
      }
      window.location.assign(data.url);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not check availability. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
      <main id="main-content" className="simple-directory">
        {/* Facebook-style Profile Card with Cover Banner */}
        <section className="ch-fb-card" aria-label="Community Heroes Official Profile">
          {/* Cover Photo Banner */}
          <div className="ch-fb-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                state.bannerUrl ||
                state.bannerSettings?.customUrl ||
                "/images/mlbb-ch-banner.png"
              }
              alt="Community Heroes Tournament Banner"
              className="ch-fb-cover-img"
            />
            <div className="ch-fb-cover-shade" />

            {/* Top-right date pill */}
            <div className="ch-fb-badge top-right">
              <CalendarDays size={12} />
              <span>{month}</span>
            </div>
          </div>

          {/* Centered Profile Content (Facebook Style) */}
          <div className="ch-fb-profile-content">
            <div className="ch-fb-avatar-center">
              <div className="ch-fb-avatar-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    state.logoUrl ||
                    state.bannerSettings?.avatarCustomUrl ||
                    "/images/mlbb-ch-avatar.png"
                  }
                  alt="MLBB PH - Community Heroes Profile"
                  className="ch-fb-avatar-img"
                />
              </div>
              <span className="ch-fb-active-dot" title="Active Now" />
            </div>

            <div className="ch-fb-name-row">
              <h1 className="ch-fb-name">
                {state.bannerSettings?.title || "MLBB PH - Community Heroes"}
                <span className="verified-badge" title="Verified Page">
                  <svg className="verified-badge-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </h1>

              <a
                href={
                  state.bannerSettings?.facebookPageUrl ||
                  "https://www.facebook.com/MLBBPHCommunityHeroes"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="btn-follow-fb"
                title="Follow MLBB PH Community Heroes on Facebook"
              >
                <svg className="btn-fb-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span>Follow on FB</span>
              </a>
            </div>

            {/* Page Views & Community Raffle Pill inside Card */}
            <div className="ch-fb-ribbon">
              <Link
                href="/raffle"
                className="ch-ribbon-raffle"
                title="Join Official Community Raffle"
              >
                <Gift size={13} style={{ color: "#facc15" }} />
                <span>Community Raffle</span>
              </Link>
              <span className="ch-ribbon-views" title="Total directory page views">
                <Eye size={13} />
                <span>{pageViews.toLocaleString()} views</span>
              </span>
            </div>
          </div>
        </section>

        <section
          className="ch-directory-section"
          aria-labelledby="ch-list-title"
        >
          <div className="ch-list-heading">
            <div>
              <h2 id="ch-list-title">
                Community Heroes <span>{players.length}</span>
              </h2>
              <p>
                Registration closes when all team slots are filled.
              </p>
            </div>
          </div>
          {error && (
            <div className="feedback error" role="alert">
              {error}
            </div>
          )}
          {offline && (
            <p className="feedback" role="status">
              Showing the last loaded list. Availability is checked again before
              registration.
            </p>
          )}

          {/* Status Filter Tabs & Quick Search */}
          <div className="ch-filter-bar">
            <div className="ch-filter-tabs" role="tablist" aria-label="Tournament status filter">
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "open"}
                className={`ch-filter-tab ${statusFilter === "open" ? "active" : ""}`}
                onClick={() => setStatusFilter("open")}
              >
                {openCount > 0 && <span className="ch-pulse-dot" />}
                Open Slots
                <span className={`ch-filter-count ${openCount > 0 ? "open" : ""}`}>{openCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === "closed"}
                className={`ch-filter-tab ${statusFilter === "closed" ? "active" : ""}`}
                onClick={() => setStatusFilter("closed")}
              >
                Full / Closed
                <span className="ch-filter-count closed">{closedCount}</span>
              </button>
            </div>

            <div className="ch-search-wrap">
              <Search size={14} className="ch-search-icon" />
              <input
                type="text"
                placeholder="Search hero or area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ch-search-input"
                aria-label="Search tournaments by hero nickname or area"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="ch-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {filteredPlayers.length ? (
            <ul className="ch-list">
              {filteredPlayers.map((p) => {
                const regCount = registeredTeamsCount(p);
                const status = tournamentStatus(p, state.activeTabName);
                const full = status === "full";
                const allowed = canRegister(p, state.activeTabName);
                return (
                  <li
                    key={p.id}
                    className={`ch-row ${full ? "ch-full" : ""}`}
                    data-ch={p.chNickname}
                    onClick={() => setSelectedPlayer(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedPlayer(p);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-haspopup="dialog"
                    aria-label={`View ${p.chNickname}'s tournament card`}
                  >
                    <div className="ch-identity">
                      <span className="hero-avatar" aria-hidden="true">
                        {p.chNickname.slice(0, 2).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", whiteSpace: "nowrap" }}>
                          <h3 style={{ whiteSpace: "nowrap", margin: 0 }}>{p.chNickname}</h3>
                          {p.facebookProfileUrl && (
                            <a
                              href={p.facebookProfileUrl.replace(/\.mlbb\/?$/i, "")}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="ch-row-fb-link"
                              style={{ flexShrink: 0, display: "inline-flex", alignItems: "center" }}
                              title={`Open ${p.chNickname}'s Facebook profile`}
                            >
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="#1877F2">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                              </svg>
                            </a>
                          )}
                        </div>
                        <span>
                          <MapPin size={13} />
                          {cleanAreaString(p.area)}
                        </span>
                      </div>
                    </div>
                    <div className="ch-capacity">
                      <div>
                        <span>
                          <strong>{regCount}</strong> / {p.maxTeams}{" "}
                          teams
                        </span>
                        <span className={full ? "ch-full-label" : ""}>
                          {full
                            ? "Full slots"
                            : status === "closed"
                              ? "Closed"
                              : `${slotsLeft(p)} slots left`}
                        </span>
                      </div>
                      <div
                        className="capacity-track"
                        role="progressbar"
                        aria-label={`${p.chNickname} team capacity`}
                        aria-valuenow={Math.min(regCount, p.maxTeams)}
                        aria-valuemin={0}
                        aria-valuemax={p.maxTeams}
                      >
                        <span
                          style={{
                            width: `${Math.min(100, (regCount / p.maxTeams) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <button
                      className={`button ${allowed ? "primary" : "outline"} ch-register`}
                      disabled={!allowed || busy !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        register(p.id);
                      }}
                      aria-label={`${allowed ? "Register with" : full ? "Full slots for" : "Registration unavailable for"} ${p.chNickname}`}
                    >
                      {busy === p.id ? (
                        <>
                          <LoaderCircle size={15} className="busy-spinner" />
                          Checking…
                        </>
                      ) : allowed ? (
                        <>
                          Register <ArrowUpRight size={16} />
                        </>
                      ) : (
                        <>
                          <LockKeyhole size={14} />
                          {full
                            ? "Full slots"
                            : status === "closed"
                              ? "Closed"
                              : "Unavailable"}
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="ch-empty-state">
              <div className="ch-empty-icon">
                {statusFilter === "open" ? <LockKeyhole size={24} /> : <Search size={24} />}
              </div>
              <h3>
                {statusFilter === "open"
                  ? datePassed
                    ? "This month's tournament already ended, see you next month!"
                    : "No Open Tournament Slots"
                  : searchQuery
                    ? `No matches for "${searchQuery}"`
                    : "No Tournaments Found"}
              </h3>
              <p>
                {statusFilter === "open"
                  ? datePassed
                    ? "All registrations are currently closed. Registration will reopen next month."
                    : "All current Community Heroes tournament slots are fully booked or closed."
                  : searchQuery
                    ? "Try searching for a different hero nickname or city."
                    : "There are currently no tournaments matching this filter."}
              </p>
              <button
                type="button"
                className="button outline"
                onClick={() => {
                  setStatusFilter(statusFilter === "open" ? "closed" : "open");
                  setSearchQuery("");
                }}
              >
                {statusFilter === "open"
                  ? `View Full / Closed Tournaments (${closedCount})`
                  : `View Open Slots (${openCount})`}
              </button>
            </div>
          )}
        </section>
        {selectedPlayer && (
          <CHCardModal
            player={
              players.find((p) => p.id === selectedPlayer.id) || selectedPlayer
            }
            activeTabName={state.activeTabName}
            prlCutoff={state.prlCutoff}
            onClose={() => setSelectedPlayer(null)}
            onRegister={register}
            busy={busy}
          />
        )}
        <footer className="ch-footer">
          <div>MLBB PH · Community Heroes</div>
          <span>Team counts reflect the latest published lineup.</span>
          <span className="ch-footer-views" title="Total directory views">
            <Eye size={12} /> {pageViews.toLocaleString()} views
          </span>
        </footer>
      </main>
  );
}
