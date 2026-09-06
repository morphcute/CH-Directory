"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  LoaderCircle,
  LockKeyhole,
  MapPin,
} from "lucide-react";
import type { AppState, CHPlayer } from "@/types";
import {
  canRegister,
  listedPlayers,
  slotsLeft,
  tournamentStatus,
  isTabDatePassed,
} from "@/lib/tournaments";
import { Brand } from "./shared";
import { cleanAreaString } from "@/utils/sheetDetector";
import { CHCardModal } from "./CHCardModal";

export function Portal({ initialState }: { initialState: AppState }) {
  const [state, setState] = useState(initialState);
  const [selectedPlayer, setSelectedPlayer] = useState<CHPlayer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const players = listedPlayers(state);
  const month = (state.activeTabName || "September 5, 2026").replace(
    /\s+\d{1,2},/,
    "",
  );
  const datePassed = isTabDatePassed(state.activeTabName);
  const openCount = datePassed
    ? 0
    : players.filter(
        (p) =>
          tournamentStatus(p, state.activeTabName) === "open" ||
          tournamentStatus(p, state.activeTabName) === "closing",
      ).length;
  const fullCount = datePassed
    ? 0
    : players.filter(
        (p) => tournamentStatus(p, state.activeTabName) === "full",
      ).length;
  const syncTime = state.lastHourlySync
    ? new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(state.lastHourlySync)) + " PHT"
    : "Recently";

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

            {/* Top-left date pill */}
            <div className="ch-fb-badge top-left">
              <CalendarDays size={12} />
              <span>{month}</span>
            </div>

            {/* Top-right live directory pill */}
            <div className="ch-fb-badge top-right">
              <span className="ch-pulse-dot" />
              <span>Live Directory</span>
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

            <div className="ch-fb-meta-center">
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
              </div>
              <p className="ch-fb-bio">
                {state.bannerSettings?.subtitle || "Official MLBB Tournament Directory"}
                <span className="ch-fb-dot">•</span>
                <span className="ch-fb-followers">
                  {state.bannerSettings?.followersText || "286K followers • 5 following"}
                </span>
              </p>
            </div>

            <div className="ch-fb-actions-center">
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

            {/* Status Ribbon inside Card */}
            <div className="ch-fb-ribbon">
              <div className="ch-ribbon-left">
                {datePassed ? (
                  <span className="ch-ribbon-badge full">
                    <LockKeyhole size={11} />
                    Registration Closed (Tournament Ended)
                  </span>
                ) : (
                  <>
                    <span className="ch-ribbon-badge open">
                      <span className="ch-pulse-dot" />
                      {openCount} Open
                    </span>
                    {fullCount > 0 && (
                      <span className="ch-ribbon-badge full">{fullCount} Full</span>
                    )}
                  </>
                )}
              </div>
              <div className="ch-ribbon-right">
                <span>Synced {syncTime}</span>
              </div>
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
                {datePassed
                  ? "This tournament cycle has concluded. Registration will reopen for next month."
                  : "Registration closes when all team slots are filled."}
              </p>
            </div>
            <span className="ch-cycle">
              <CalendarDays size={15} />
              {month}
            </span>
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
          {players.length ? (
            <ul className="ch-list">
              {players.map((p) => {
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
                          <strong>{p.teamsRegistered}</strong> / {p.maxTeams}{" "}
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
                        aria-valuenow={Math.min(p.teamsRegistered, p.maxTeams)}
                        aria-valuemin={0}
                        aria-valuemax={p.maxTeams}
                      >
                        <span
                          style={{
                            width: `${Math.min(100, (p.teamsRegistered / p.maxTeams) * 100)}%`,
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
            <div className="empty-state">
              <h3>No Community Heroes listed yet.</h3>
              <p>Please check back once the next lineup is published.</p>
            </div>
          )}
        </section>
        {selectedPlayer && (
          <CHCardModal
            player={
              players.find((p) => p.id === selectedPlayer.id) || selectedPlayer
            }
            activeTabName={state.activeTabName}
            onClose={() => setSelectedPlayer(null)}
            onRegister={register}
            busy={busy}
          />
        )}
        <footer className="ch-footer">
          MLBB PH · Community Heroes
          <span>Team counts reflect the latest published lineup.</span>
        </footer>
      </main>
  );
}
