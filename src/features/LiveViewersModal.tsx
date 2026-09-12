"use client";

import { useState } from "react";
import { Eye, Users, Crown, CheckCircle2, Search, X } from "lucide-react";
import type { LiveViewerInfo } from "./useRafflePresence";

interface LiveViewersModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewers: LiveViewerInfo[];
  viewerCount: number;
}

export function LiveViewersModal({
  isOpen,
  onClose,
  viewers,
  viewerCount,
}: LiveViewersModalProps) {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const displayCount = Math.max(viewerCount, viewers.length);
  const filtered = viewers.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="ch-modal-backdrop" onClick={onClose}>
      <div
        className="raffle-viewers-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="raffle-viewers-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="raffle-viewers-icon-badge">
              <Eye size={18} style={{ color: "#38bdf8" }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#ffffff", fontWeight: 800 }}>
                  Live Stream Viewers
                </h3>
                <span className="raffle-viewers-live-pill">
                  <span className="raffle-wheel-live-dot" />
                  {displayCount} Online
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#94a3b8" }}>
                Identified spectators and registered raffle participants
              </p>
            </div>
          </div>

          <button
            type="button"
            className="ch-modal-close"
            onClick={onClose}
            aria-label="Close viewers modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        {viewers.length > 5 && (
          <div style={{ padding: "0 18px 12px" }}>
            <div className="ch-search-wrap" style={{ padding: "6px 12px" }}>
              <Search size={14} className="ch-search-icon" />
              <input
                type="text"
                placeholder="Search viewers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ch-search-input"
                style={{ fontSize: 12.5 }}
              />
              {search && (
                <button
                  type="button"
                  className="ch-search-clear"
                  onClick={() => setSearch("")}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}

        {/* Viewers List */}
        <div className="raffle-viewers-list">
          {viewers.length === 0 ? (
            <div className="raffle-viewers-empty">
              <Users size={28} style={{ color: "#475569", margin: "0 auto 8px" }} />
              <strong style={{ display: "block", color: "#e2e8f0", fontSize: 13 }}>
                {displayCount} viewer(s) connected
              </strong>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
                Spectator names will update in real-time as users pulse presence.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="raffle-viewers-empty">
              <p style={{ margin: 0, fontSize: 12.5, color: "#94a3b8" }}>
                No viewers matching "{search}"
              </p>
            </div>
          ) : (
            filtered.map((viewer, idx) => {
              const initials = viewer.name.slice(0, 2).toUpperCase();
              return (
                <div key={viewer.id || idx} className="raffle-viewer-item">
                  <div className="raffle-viewer-avatar">
                    {viewer.isOrganizer ? (
                      <Crown size={15} style={{ color: "#facc15" }} />
                    ) : (
                      <span>{initials}</span>
                    )}
                    <span className="raffle-viewer-online-dot" />
                  </div>

                  <div className="raffle-viewer-meta">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <strong className="raffle-viewer-name">{viewer.name}</strong>
                      {viewer.isOrganizer && (
                        <span className="raffle-viewer-badge organizer">
                          <Crown size={10} /> Host
                        </span>
                      )}
                      {viewer.isParticipant && !viewer.isOrganizer && (
                        <span className="raffle-viewer-badge participant">
                          <CheckCircle2 size={10} /> Registered Entrant
                        </span>
                      )}
                      {!viewer.isOrganizer && !viewer.isParticipant && (
                        <span className="raffle-viewer-badge guest">
                          Spectator
                        </span>
                      )}
                    </div>
                    <span className="raffle-viewer-status">
                      Watching live stream right now
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="raffle-viewers-footer">
          <CheckCircle2 size={13} style={{ color: "#4ade80", flexShrink: 0 }} />
          <span>
            Users who enter the raffle on their browser/IP are automatically recognized by name.
          </span>
        </div>
      </div>
    </div>
  );
}
