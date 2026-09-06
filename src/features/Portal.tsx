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
} from "@/lib/tournaments";
import { Brand } from "./shared";
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
    <>
      <header className="site-header simple-header">
        <div className="header-inner">
          <Brand logoUrl={state.logoUrl} />
        </div>
      </header>
      <main id="main-content" className="simple-directory">
        <section className="ch-banner" aria-labelledby="directory-title">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.bannerUrl || "/images/hero-knight.png"}
            alt="Community Heroes Tournament Banner"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <div className="ch-banner-shade" />
          <div className="ch-banner-copy">
            <span className="eyebrow">MLBB PH · COMMUNITY HEROES</span>
            <h1 id="directory-title">
              Choose your CH.
              <br />
              Join the game.
            </h1>
            <p>Select your Community Hero below to register your team.</p>
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
              <p>Registration closes when all team slots are filled.</p>
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
                const status = tournamentStatus(p);
                const full = status === "full";
                const allowed = canRegister(p);
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
                      <div>
                        <h3>{p.chNickname}</h3>
                        <span>
                          <MapPin size={13} />
                          {p.area}
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
    </>
  );
}
