"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  QrCode,
  Users,
} from "lucide-react";
import QRCode from "qrcode";
import type { CHPlayer } from "@/types";
import {
  canRegister,
  registrationUrl,
  slotsLeft,
  tournamentStatus,
} from "@/lib/tournaments";
import { Modal } from "./shared";

const FacebookIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

interface CHCardModalProps {
  player: CHPlayer;
  onClose: () => void;
  onRegister: (id: string) => void;
  busy: string | null;
}

export function CHCardModal({
  player,
  onClose,
  onRegister,
  busy,
}: CHCardModalProps) {
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedFB, setCopiedFB] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [teams, setTeams] = useState<string[]>(player.registeredTeams || []);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [copiedTeams, setCopiedTeams] = useState(false);
  const [teamsError, setTeamsError] = useState("");

  const registered = player.teamsRegistered || 0;
  const maxTeams = player.maxTeams || 16;
  const status = tournamentStatus(player);
  const full = status === "full" || registered >= maxTeams;
  const allowed = canRegister(player);
  const slots = slotsLeft(player);
  const initials = player.chNickname.slice(0, 2).toUpperCase();

  const fbUrl =
    player.facebookProfileUrl ||
    `https://www.facebook.com/${player.chNickname.toLowerCase().replace(/[^a-z0-9]/g, "")}.mlbb`;
  const regLink = registrationUrl(player);

  useEffect(() => {
    const link = regLink || fbUrl;
    if (link) {
      QRCode.toDataURL(link, {
        width: 240,
        margin: 1.5,
        color: { dark: "#0b0e14", light: "#ffffff" },
      })
        .then(setQrDataUrl)
        .catch(() => {});
    }
  }, [regLink, fbUrl]);

  async function toggleTeams() {
    if (!showTeams && teams.length === 0 && !loadingTeams) {
      setLoadingTeams(true);
      setTeamsError("");
      try {
        const res = await fetch(`/api/tournament-teams?playerId=${player.id}`);
        const data = await res.json();
        if (data.teams && Array.isArray(data.teams)) {
          setTeams(data.teams);
        } else if (data.error) {
          setTeamsError(data.error);
        }
      } catch {
        setTeamsError("Could not load team list.");
      } finally {
        setLoadingTeams(false);
      }
    }
    setShowTeams((prev) => !prev);
  }

  async function copyAllTeams() {
    if (!teams.length) return;
    const text = teams.map((t, i) => `${i + 1}. ${t}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTeams(true);
      setTimeout(() => setCopiedTeams(false), 2000);
    } catch {
      window.prompt("Copy team list:", text);
    }
  }

  async function copyFormLink() {
    if (!regLink) return;
    try {
      await navigator.clipboard.writeText(regLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      window.prompt("Copy registration link:", regLink);
    }
  }

  async function copyFBUrl() {
    try {
      await navigator.clipboard.writeText(fbUrl);
      setCopiedFB(true);
      setTimeout(() => setCopiedFB(false), 2000);
    } catch {
      window.prompt("Copy Facebook URL:", fbUrl);
    }
  }

  return (
    <Modal title={`${player.chNickname} — CH Card`} onClose={onClose}>
      <div className="ch-modal-card">
        {/* Header Identity */}
        <div className="ch-modal-header">
          <div className="ch-modal-avatar">{initials}</div>
          <div className="ch-modal-identity">
            <div className="ch-modal-title-row">
              <h2>{player.chNickname}</h2>
              {player.isCalabarzon && (
                <span className="ch-modal-calabarzon">CALABARZON</span>
              )}
            </div>
            <div className="ch-modal-meta">
              <span>
                <MapPin
                  size={13}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: 4,
                  }}
                />
                {player.area || "Philippines"}
              </span>
              {player.fullName && (
                <>
                  <span style={{ opacity: 0.35, margin: "0 4px" }}>•</span>
                  <span style={{ color: "#e2e8f0", fontWeight: 500 }}>
                    {player.fullName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 16-Slot Segmented Capacity Box */}
        <div className="ch-modal-capacity-box">
          <div className="ch-modal-capacity-head">
            <span>
              <strong>{registered}</strong> / {maxTeams} Teams Registered
            </span>
            <span
              style={{
                fontWeight: 650,
                fontSize: "12px",
                color: full
                  ? "#ef4444"
                  : status === "closing"
                    ? "#fb923c"
                    : "#facc15",
              }}
            >
              {full
                ? "Full slots (16/16)"
                : status === "closed"
                  ? "Closed"
                  : `${slots} slots left`}
            </span>
          </div>
          <div
            className="ch-modal-slots-grid"
            role="progressbar"
            aria-valuenow={Math.min(registered, maxTeams)}
            aria-valuemin={0}
            aria-valuemax={maxTeams}
            aria-label={`${player.chNickname} team slots capacity`}
          >
            {Array.from({ length: maxTeams }).map((_, idx) => {
              const isFilled = idx < registered;
              return (
                <div
                  key={idx}
                  className={`ch-slot-block ${
                    isFilled ? (full ? "filled-full" : "filled") : "empty"
                  }`}
                  title={`Slot #${idx + 1}: ${isFilled ? "Registered" : "Available"}`}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Teams Under this CH Section (Compact) */}
        <div className="ch-modal-teams-compact">
          <button
            type="button"
            className="ch-modal-teams-compact-btn"
            onClick={toggleTeams}
            aria-expanded={showTeams}
          >
            <div className="ch-modal-teams-compact-btn-left">
              <Users size={14} />
              <span>Registered Teams</span>
            </div>
            <div className="ch-modal-teams-compact-btn-right">
              <span>{showTeams ? "Hide list" : "View teams under this CH"}</span>
              <ChevronDown
                size={14}
                style={{
                  transform: showTeams ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
              />
            </div>
          </button>

          {showTeams && (
            <div className="ch-modal-teams-content">
              {loadingTeams ? (
                <div className="ch-modal-teams-loading">
                  <LoaderCircle size={15} className="busy-spinner" />
                  <span>Loading team list from response sheet…</span>
                </div>
              ) : teams.length > 0 ? (
                <>
                  <div className="ch-modal-teams-toolbar">
                    <span>
                      <strong>{teams.length}</strong> team{teams.length !== 1 ? "s" : ""} registered
                    </span>
                    <button
                      type="button"
                      className="button outline small"
                      style={{ padding: "3px 8px", fontSize: 10, minHeight: 24 }}
                      onClick={copyAllTeams}
                    >
                      {copiedTeams ? <Check size={11} style={{ color: "#facc15" }} /> : <Copy size={11} />}
                      {copiedTeams ? "Copied" : "Copy roster"}
                    </button>
                  </div>
                  <div className="ch-modal-teams-grid">
                    {teams.map((teamName, i) => (
                      <div key={i} className="ch-modal-team-row">
                        <span className="ch-modal-team-slot">#{i + 1}</span>
                        <span className="ch-modal-team-name">{teamName}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="ch-modal-teams-empty">
                  <Users size={15} style={{ opacity: 0.4 }} />
                  <p>{teamsError || "No team names found yet in the response sheet."}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Remarks / Tournament Notes */}
        {player.remarks && (
          <div className="ch-modal-remarks">
            <h4>Tournament Notes</h4>
            <p style={{ margin: 0 }}>{player.remarks}</p>
          </div>
        )}

        {/* Primary Actions */}
        <div className="ch-modal-actions">
          {allowed ? (
            <button
              type="button"
              className="button primary full-width"
              disabled={busy !== null}
              onClick={() => onRegister(player.id)}
            >
              {busy === player.id ? (
                <>
                  <LoaderCircle size={16} className="busy-spinner" />
                  Checking availability…
                </>
              ) : (
                <>
                  Register Team <ArrowUpRight size={16} />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="button outline full-width"
              disabled
              style={{
                cursor: "not-allowed",
                background: "#161d2a",
                borderColor: "#26354c",
                color: "#64748b",
              }}
            >
              <LockKeyhole size={16} />
              {full
                ? "Full slots (16/16) — Registration Closed"
                : status === "closed"
                  ? "Registration Closed by Organizer"
                  : "Registration Unavailable"}
            </button>
          )}

          <a
            href={fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button outline full-width"
            style={{ justifyContent: "center" }}
          >
            <FacebookIcon size={16} />
            Message on Facebook
            <ExternalLink size={14} style={{ opacity: 0.7 }} />
          </a>
        </div>

        {/* Quick Tools */}
        <div className="ch-modal-tools">
          <button
            type="button"
            className="button outline small"
            onClick={() => setShowQR(!showQR)}
            style={{ fontSize: "11px", padding: "8px 10px", gap: 6 }}
          >
            <QrCode size={14} />
            {showQR ? "Hide QR" : "QR Code"}
          </button>

          <button
            type="button"
            className="button outline small"
            disabled={!regLink}
            onClick={copyFormLink}
            style={{ fontSize: "11px", padding: "8px 10px", gap: 6 }}
          >
            {copiedLink ? (
              <>
                <Check size={14} style={{ color: "#facc15" }} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy Form
              </>
            )}
          </button>

          <button
            type="button"
            className="button outline small"
            onClick={copyFBUrl}
            style={{ fontSize: "11px", padding: "8px 10px", gap: 6 }}
          >
            {copiedFB ? (
              <>
                <Check size={14} style={{ color: "#facc15" }} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy FB
              </>
            )}
          </button>
        </div>

        {/* QR Code Inline View */}
        {showQR && (
          <div className="ch-modal-qr-preview">
            <span
              style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}
            >
              Scan with camera to open registration form:
            </span>
            {qrDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrDataUrl}
                alt={`QR Code for ${player.chNickname}`}
                width={180}
                height={180}
              />
            ) : (
              <span style={{ fontSize: "12px", color: "#888" }}>
                Generating QR code…
              </span>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
