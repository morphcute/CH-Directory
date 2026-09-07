"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Edit2,
  Gift,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldCheck,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { Footer } from "./shared";
import { MlbbDiamondIcon } from "./MlbbDiamondIcon";
import type { RaffleArchiveSummary } from "@/types";

interface RaffleEntryPublic {
  id: string;
  fullName: string;
  prizeWon?: string | null;
  createdAt: string;
}

interface RaffleResponse {
  id: string;
  title: string;
  description: string;
  cutoffDate: string;
  prizes: string[];
  isActive: boolean;
  isEnded: boolean;
  entriesCount: number;
  winners: { id: string; fullName: string; prizeWon: string }[];
  entries: RaffleEntryPublic[];
  myEntry: { id: string; fullName: string; prizeWon?: string | null } | null;
  archives?: RaffleArchiveSummary[];
}

export function RafflePage() {
  const [data, setData] = useState<RaffleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"latest" | "archive">("latest");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  async function loadRaffle() {
    try {
      const storedDevId = localStorage.getItem("ch_raffle_device_id");
      const url = storedDevId
        ? `/api/raffle?deviceId=${encodeURIComponent(storedDevId)}`
        : "/api/raffle";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load raffle data");
      const json: RaffleResponse = await res.json();
      setData(json);
      if (json.myEntry) {
        setEditName(json.myEntry.fullName);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRaffle();
  }, []);

  async function handleJoinOrUpdate(e: React.FormEvent, isUpdate = false) {
    e.preventDefault();
    const nameToSubmit = isUpdate ? editName.trim() : fullName.trim();
    if (!nameToSubmit) {
      setFeedback({ type: "error", text: "Please enter your full name." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const storedDevId = localStorage.getItem("ch_raffle_device_id");
      const res = await fetch("/api/raffle/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: nameToSubmit,
          deviceId: storedDevId || undefined,
        }),
      });
      const resJson = await res.json();

      if (!res.ok) {
        throw new Error(resJson.error || "Failed to submit entry.");
      }

      if (resJson.deviceId) {
        localStorage.setItem("ch_raffle_device_id", resJson.deviceId);
      }

      setFeedback({
        type: "success",
        text: isUpdate
          ? "Your name has been updated successfully."
          : "You have joined the raffle. Good luck!",
      });

      if (!isUpdate) {
        setFullName("");
      } else {
        setEditing(false);
      }

      await loadRaffle();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Could not submit entry." });
    } finally {
      setSubmitting(false);
    }
  }

  function formatDeadline(isoString?: string) {
    if (!isoString) return "To be announced";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  const filteredEntries = (data?.entries || []).filter((e) => {
    if (!searchQuery.trim()) return true;
    return e.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const archives = data?.archives || [];

  return (
    <main id="main-content" className="simple-directory">
      {/* Facebook-style Profile Header Card - 100% matched with Homepage */}
      <section className="ch-fb-card" aria-label="Community Heroes Raffle Profile">
        <div className="ch-fb-cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/mlbb-ch-banner.png"
            alt="Community Heroes Tournament Banner"
            className="ch-fb-cover-img"
          />
          <div className="ch-fb-cover-shade" />

          {/* Top-left back link */}
          <Link href="/" className="ch-fb-badge top-left">
            <ArrowLeft size={12} />
            <span>Tournament Directory</span>
          </Link>

          {/* Top-right date badge */}
          {data?.cutoffDate && (
            <div className="ch-fb-badge top-right">
              <CalendarDays size={12} />
              <span>{formatDeadline(data.cutoffDate)}</span>
            </div>
          )}
        </div>

        <div className="ch-fb-profile-content">
          <div className="ch-fb-avatar-center">
            <div className="ch-fb-avatar-box">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/mlbb-ch-avatar.png"
                alt="MLBB PH - Community Heroes Profile"
                className="ch-fb-avatar-img"
              />
            </div>
            <span className="ch-fb-active-dot" title="Active Now" />
          </div>

          <div className="ch-fb-name-row">
            <h1 className="ch-fb-name">
              MLBB PH - Community Heroes
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
              href="https://www.facebook.com/MLBBPHCommunityHeroes"
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

          {/* Informational ribbon */}
          <div className="ch-fb-ribbon">
            <span className="ch-ribbon-views">
              <Users size={13} />
              <span>{data?.entriesCount || 0} participants</span>
            </span>

            {data?.isEnded ? (
              <span className="ch-ribbon-views" style={{ color: "#f87171" }}>
                <LockKeyhole size={13} />
                <span>Entries closed</span>
              </span>
            ) : (
              <span className="ch-ribbon-views" style={{ color: "#4ade80" }}>
                <Clock size={13} />
                <span>Registration open</span>
              </span>
            )}

            <span className="ch-ribbon-views">
              <ShieldCheck size={13} />
              <span>1 entry per device</span>
            </span>
          </div>
        </div>
      </section>

      {/* Directory Section & Navigation Tabs */}
      <section className="ch-directory-section" aria-labelledby="raffle-section-heading">
        <div className="ch-list-heading">
          <div>
            <h2 id="raffle-section-heading">
              {activeTab === "latest" ? "Community Raffle" : "Past Winners Archive"}
            </h2>
            <p>
              {activeTab === "latest"
                ? data?.description || "Enter your full name to join the official Community Heroes raffle."
                : "Archive of past completed raffles and lucky community winners."}
            </p>
          </div>
        </div>

        {/* Filter Tabs matching Homepage style */}
        <div className="ch-filter-bar">
          <div className="ch-filter-tabs" role="tablist" aria-label="Raffle sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "latest"}
              className={`ch-filter-tab ${activeTab === "latest" ? "active" : ""}`}
              onClick={() => setActiveTab("latest")}
            >
              {!data?.isEnded && <span className="ch-pulse-dot" />}
              Latest Raffle
              <span className="ch-filter-count open">{data?.entriesCount || 0}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "archive"}
              className={`ch-filter-tab ${activeTab === "archive" ? "active" : ""}`}
              onClick={() => setActiveTab("archive")}
            >
              Past Winners Archive
              <span className="ch-filter-count closed">{archives.length}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className={`feedback ${feedback.type}`} role="alert" style={{ marginBottom: 16 }}>
            {feedback.text}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
            <LoaderCircle size={28} className="busy-spinner" style={{ margin: "0 auto 10px" }} />
            <p>Loading raffle information…</p>
          </div>
        ) : activeTab === "latest" ? (
          /* TAB 1: LATEST RAFFLE ONLY */
          !data ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
              <p>No active raffle at this moment. Please check back soon!</p>
              <Link href="/" className="button outline small" style={{ marginTop: 12 }}>
                Browse Tournaments
              </Link>
            </div>
          ) : (
            <div className="raffle-human-container">
              {/* Prize Pool Shelf */}
              {Array.isArray(data.prizes) && data.prizes.length > 0 && (
                <div className="raffle-human-card">
                  <div className="raffle-human-card-head">
                    <div className="raffle-human-card-title">
                      <Gift size={16} style={{ color: "#facc15" }} />
                      <strong>Giveaway Prizes ({data.prizes.length})</strong>
                    </div>
                    <span className="raffle-human-deadline">
                      Deadline: {formatDeadline(data.cutoffDate)}
                    </span>
                  </div>

                  <div className="raffle-human-prizes-grid">
                    {data.prizes.map((prize, idx) => {
                      const isStarlight = /starlight/i.test(prize);
                      const isDiamond = /diamond/i.test(prize);
                      return (
                        <div key={idx} className="raffle-human-prize-pill">
                          {isStarlight ? (
                            <Crown size={16} style={{ color: "#facc15" }} />
                          ) : isDiamond ? (
                            <MlbbDiamondIcon size={16} />
                          ) : (
                            <Gift size={16} style={{ color: "#38bdf8" }} />
                          )}
                          <span className="raffle-human-prize-name">{prize}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Official Winners (if winners already assigned in this latest raffle) */}
              {data.winners && data.winners.length > 0 && (
                <div className="raffle-human-card winners-box">
                  <div className="raffle-human-card-head">
                    <div className="raffle-human-card-title">
                      <Trophy size={16} style={{ color: "#facc15" }} />
                      <strong>Raffle Winners ({data.winners.length})</strong>
                    </div>
                    <span style={{ fontSize: 12, color: "#facc15", fontWeight: 600 }}>
                      Official Announcement
                    </span>
                  </div>

                  <div className="raffle-human-winners-grid">
                    {data.winners.map((winner, idx) => (
                      <div key={winner.id || idx} className="raffle-human-winner-row">
                        <span className="raffle-human-winner-rank">#{idx + 1}</span>
                        <div className="raffle-human-winner-info">
                          <strong>{winner.fullName}</strong>
                          <span className="raffle-human-winner-prize">
                            Won: {winner.prizeWon}
                          </span>
                        </div>
                        <Crown size={15} style={{ color: "#facc15" }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entry Pass Form / Status */}
              <div className="raffle-human-card">
                <div className="raffle-human-card-head">
                  <div className="raffle-human-card-title">
                    <User size={16} style={{ color: "#38bdf8" }} />
                    <strong>
                      {data.isEnded
                        ? "Registration Closed"
                        : data.myEntry
                          ? "Your Registered Entry"
                          : "Join the Raffle"}
                    </strong>
                  </div>
                  <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                    1 entry per device
                  </span>
                </div>

                {data.isEnded ? (
                  <div className="raffle-human-alert closed">
                    <LockKeyhole size={18} />
                    <div>
                      <strong>The registration cut-off has passed.</strong>
                      <p>Entries and edits are closed for this round. Winner announcement will follow.</p>
                    </div>
                  </div>
                ) : data.myEntry && !editing ? (
                  <div className="raffle-human-registered-view">
                    <div className="raffle-human-registered-left">
                      <div className="raffle-human-check">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <span className="raffle-human-registered-sub">Registered name</span>
                        <div className="raffle-human-registered-name">{data.myEntry.fullName}</div>
                        <p className="raffle-human-registered-note">
                          Your device is entered in the raffle. You can edit your name before the deadline.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="button outline small"
                      onClick={() => setEditing(true)}
                    >
                      <Edit2 size={13} />
                      <span>Edit Name</span>
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => handleJoinOrUpdate(e, Boolean(data.myEntry && editing))}
                    className="raffle-human-form"
                  >
                    <div className="raffle-human-input-group">
                      <label htmlFor="full-name-input">
                        Full Name / Player Name <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        id="full-name-input"
                        type="text"
                        placeholder="e.g. Juan Dela Cruz"
                        value={editing ? editName : fullName}
                        onChange={(e) =>
                          editing ? setEditName(e.target.value) : setFullName(e.target.value)
                        }
                        maxLength={100}
                        required
                        autoFocus={editing}
                        className="raffle-human-input"
                      />
                    </div>

                    <div className="raffle-human-btn-row">
                      <button
                        type="submit"
                        className="button primary"
                        disabled={submitting || (editing ? !editName.trim() : !fullName.trim())}
                      >
                        {submitting ? (
                          <>
                            <LoaderCircle size={15} className="busy-spinner" />
                            <span>Saving…</span>
                          </>
                        ) : editing ? (
                          <>
                            <Check size={15} />
                            <span>Save Updated Name</span>
                          </>
                        ) : (
                          <span>Join Raffle</span>
                        )}
                      </button>

                      {editing && (
                        <button
                          type="button"
                          className="button outline"
                          onClick={() => {
                            setEditing(false);
                            if (data?.myEntry) setEditName(data.myEntry.fullName);
                          }}
                        >
                          <X size={15} />
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>

                    <div className="raffle-human-hint">
                      <ShieldCheck size={14} style={{ color: "#34d399", flexShrink: 0 }} />
                      <span>
                        No account needed. We save your device so you can update your name anytime before the deadline.
                      </span>
                    </div>
                  </form>
                )}
              </div>

              {/* Registered Participants Roster */}
              <div className="raffle-human-card">
                <div className="raffle-human-card-head" style={{ flexWrap: "wrap", gap: 10 }}>
                  <div className="raffle-human-card-title">
                    <Users size={16} style={{ color: "#94a3b8" }} />
                    <strong>Registered Participants ({data.entriesCount})</strong>
                  </div>

                  {data.entriesCount > 3 && (
                    <div className="ch-search-wrap" style={{ maxWidth: 220, padding: "4px 10px" }}>
                      <Search size={13} className="ch-search-icon" />
                      <input
                        type="text"
                        placeholder="Search name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="ch-search-input"
                        style={{ fontSize: 12 }}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className="ch-search-clear"
                          onClick={() => setSearchQuery("")}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {filteredEntries.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "26px 16px", color: "#94a3b8", fontSize: 13 }}>
                    {searchQuery
                      ? `No participants found matching "${searchQuery}".`
                      : "No participants have entered yet. Be the first to join!"}
                  </div>
                ) : (
                  <ul className="ch-list" style={{ marginTop: 10 }}>
                    {filteredEntries.map((entry, idx) => {
                      const isMyEntry = data.myEntry && data.myEntry.id === entry.id;
                      const hasWon = Boolean(entry.prizeWon);
                      const initials = entry.fullName.trim().slice(0, 2).toUpperCase();
                      return (
                        <li
                          key={entry.id || idx}
                          className={`ch-row ${isMyEntry ? "raffle-my-row" : ""}`}
                          style={{ cursor: "default" }}
                        >
                          <div className="ch-identity">
                            <span className="hero-avatar" aria-hidden="true" style={{ width: 34, height: 34, fontSize: 12 }}>
                              {initials}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <h3 style={{ fontSize: 13.5, margin: 0, color: "#ffffff" }}>
                                  {entry.fullName}
                                </h3>
                                {isMyEntry && (
                                  <span className="raffle-you-badge">YOU</span>
                                )}
                                {hasWon && (
                                  <span className="raffle-winner-tag">
                                    <Crown size={11} />
                                    <span>Winner</span>
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                {entry.createdAt
                                  ? new Date(entry.createdAt).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "Registered"}
                              </span>
                            </div>
                          </div>

                          {hasWon ? (
                            <div className="raffle-row-prize-won">
                              <Trophy size={13} style={{ color: "#facc15" }} />
                              <span>{entry.prizeWon}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                              #{idx + 1}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )
        ) : (
          /* TAB 2: PAST WINNERS ARCHIVE */
          <div className="raffle-archive-container">
            {archives.length === 0 ? (
              <div className="raffle-human-card" style={{ textAlign: "center", padding: "40px 16px" }}>
                <Trophy size={32} style={{ color: "#64748b", margin: "0 auto 10px" }} />
                <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#ffffff" }}>
                  No Archived Raffles Yet
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  Once the current raffle concludes with winners and a new giveaway begins, past editions will be archived here.
                </p>
                <button
                  type="button"
                  className="button outline small"
                  style={{ marginTop: 14 }}
                  onClick={() => setActiveTab("latest")}
                >
                  View Latest Raffle
                </button>
              </div>
            ) : (
              <div className="raffle-archive-list">
                {archives.map((arch, idx) => (
                  <div key={arch.id || idx} className="raffle-human-card archive-card">
                    <div className="raffle-human-card-head">
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span className="raffle-archive-pill">Concluded Raffle</span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>
                            {formatDeadline(arch.cutoffDate)}
                          </span>
                        </div>
                        <h3 style={{ margin: "2px 0 6px", fontSize: 17, color: "#ffffff" }}>
                          {arch.title}
                        </h3>
                        {arch.description && (
                          <p style={{ margin: 0, fontSize: 12.5, color: "#94a3b8" }}>
                            {arch.description}
                          </p>
                        )}
                      </div>
                      <span className="raffle-archive-entrants-badge">
                        <Users size={13} />
                        <span>{arch.entriesCount} Entrants</span>
                      </span>
                    </div>

                    {/* Prizes that were offered */}
                    {arch.prizes && arch.prizes.length > 0 && (
                      <div className="raffle-archive-prizes-row">
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                          Prizes:
                        </span>
                        {arch.prizes.map((pz, pIdx) => (
                          <span key={pIdx} className="raffle-archive-prize-chip">
                            {pz}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Winners Showcase for this archived raffle */}
                    <div className="raffle-archive-winners-section">
                      <div className="raffle-archive-winners-title">
                        <Crown size={14} style={{ color: "#facc15" }} />
                        <span>Winners Hall of Fame ({arch.winners?.length || 0})</span>
                      </div>

                      {!arch.winners || arch.winners.length === 0 ? (
                        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#94a3b8" }}>
                          No winners were recorded for this edition.
                        </p>
                      ) : (
                        <div className="raffle-archive-winners-grid">
                          {arch.winners.map((win, wIdx) => (
                            <div key={win.id || wIdx} className="raffle-archive-winner-item">
                              <span className="raffle-archive-winner-rank">#{wIdx + 1}</span>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <strong style={{ display: "block", fontSize: 13, color: "#ffffff" }}>
                                  {win.fullName}
                                </strong>
                                <span style={{ fontSize: 11.5, color: "#38bdf8", fontWeight: 600 }}>
                                  {win.prizeWon}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
