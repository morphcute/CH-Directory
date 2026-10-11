"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Send,
  Sparkles,
  UserCheck,
  Trash2,
  Crown,
  Ticket,
  Eye,
  MessageSquare,
  ArrowDown,
  Lock,
  Search,
  CheckCircle2,
  X,
  Radio,
  Smile,
} from "lucide-react";
import type { RaffleChatMessage } from "@/server/raffleChatStore";

interface RaffleLiveChatProps {
  raffleId?: string;
  myEntryName?: string;
  isOrganizer?: boolean;
  currentCandidateName?: string | null;
  claimRemainingSeconds?: number | null;
  className?: string;
  entries?: { id: string; fullName: string; prizeWon?: string | null }[];
  onCandidateSpotted?: (msg: RaffleChatMessage) => void;
  onNewMessage?: (msg: RaffleChatMessage) => void;
  onClaimEntry?: (entryName: string) => void;
}

// Generate deterministic avatar color based on name
function getAvatarGradient(name: string): string {
  const gradients = [
    "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    "linear-gradient(135deg, #ec4899, #be185d)",
    "linear-gradient(135deg, #06b6d4, #0e7490)",
    "linear-gradient(135deg, #10b981, #047857)",
    "linear-gradient(135deg, #f59e0b, #d97706)",
    "linear-gradient(135deg, #6366f1, #4338ca)",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

function getInitials(name: string): string {
  if (!name) return "CH";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function RaffleLiveChat({
  raffleId = "default",
  myEntryName: initialMyEntryName,
  isOrganizer = false,
  currentCandidateName,
  claimRemainingSeconds,
  className = "",
  entries = [],
  onCandidateSpotted,
  onNewMessage,
  onClaimEntry,
}: RaffleLiveChatProps) {
  // Entrant identity tracking (from prop or localStorage claim)
  const [activeEntryName, setActiveEntryName] = useState<string | undefined>(() => {
    if (initialMyEntryName) return initialMyEntryName;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ch_raffle_entrant_name");
      if (stored) return stored;
    }
    return undefined;
  });

  useEffect(() => {
    if (initialMyEntryName) {
      setActiveEntryName(initialMyEntryName);
    }
  }, [initialMyEntryName]);

  const [messages, setMessages] = useState<RaffleChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [hasNewMessagesBelow, setHasNewMessagesBelow] = useState(false);
  const [candidateClaimedMessage, setCandidateClaimedMessage] = useState<RaffleChatMessage | null>(null);

  // Connect Entry Modal State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectSearch, setConnectSearch] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [connectSuccess, setConnectSuccess] = useState("");

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const sseRef = useRef<EventSource | null>(null);

  const canComment = Boolean(isOrganizer || activeEntryName);

  const activeSenderName = isOrganizer
    ? "👑 Organizer"
    : activeEntryName
      ? activeEntryName
      : "Spectator";

  const isCurrentPickSender = Boolean(
    currentCandidateName &&
    activeEntryName &&
    activeEntryName.trim().toLowerCase() === currentCandidateName.trim().toLowerCase()
  );

  // Check if candidate has commented during the current attendance check
  useEffect(() => {
    if (!currentCandidateName) {
      setCandidateClaimedMessage(null);
      return;
    }
    const candLower = currentCandidateName.trim().toLowerCase();
    const found = messages.find(
      (m) =>
        (m.isCurrentPick || m.senderName.trim().toLowerCase() === candLower) &&
        m.timestamp > Date.now() - 120000
    );
    if (found) {
      setCandidateClaimedMessage(found);
      if (onCandidateSpotted) onCandidateSpotted(found);
    }
  }, [messages, currentCandidateName, onCandidateSpotted]);

  // Scroll helper
  const scrollToBottom = (instant = false) => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: instant ? "auto" : "smooth",
    });
    setHasNewMessagesBelow(false);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    isNearBottomRef.current = isAtBottom;
    if (isAtBottom) {
      setHasNewMessagesBelow(false);
    }
  };

  // Safe merge without flickering or disappearing
  const mergeIncomingMessages = useCallback(
    (incoming: RaffleChatMessage[]) => {
      if (!Array.isArray(incoming) || incoming.length === 0) return;
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes: RaffleChatMessage[] = [];
        for (const msg of incoming) {
          if (!existingIds.has(msg.id)) {
            existingIds.add(msg.id);
            newOnes.push(msg);
            onNewMessage?.(msg);
          }
        }
        if (newOnes.length === 0) return prev;
        const merged = [...prev, ...newOnes];
        merged.sort((a, b) => a.timestamp - b.timestamp);
        if (isNearBottomRef.current) {
          setTimeout(() => scrollToBottom(), 50);
        } else {
          setHasNewMessagesBelow(true);
        }
        return merged.slice(-100);
      });
    },
    [onNewMessage]
  );

  // Initial fetch of messages
  const loadInitialMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/raffle/chat?raffleId=${encodeURIComponent(raffleId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
          scrollToBottom(true);
        }
      }
    } catch {}
  }, [raffleId]);

  // 1-second real-time polling sync & SSE push streaming
  useEffect(() => {
    void loadInitialMessages();

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/raffle/live-stream");
      sseRef.current = es;

      es.addEventListener("chat_init", (e: MessageEvent) => {
        try {
          if (!e.data) return;
          const parsed = JSON.parse(e.data);
          if (Array.isArray(parsed) && parsed.length > 0) {
            mergeIncomingMessages(parsed);
          }
        } catch {}
      });

      es.addEventListener("chat_message", (e: MessageEvent) => {
        try {
          if (!e.data) return;
          const newMsg: RaffleChatMessage = JSON.parse(e.data);
          mergeIncomingMessages([newMsg]);
        } catch {}
      });
    } catch {}

    // Real-time polling backup every 1000ms (1.0 second) for guaranteed 1-second delivery across all devices
    const interval = setInterval(async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/raffle/chat?raffleId=${encodeURIComponent(raffleId)}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.messages)) {
              mergeIncomingMessages(data.messages);
            }
          }
        } catch {}
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (es) {
        es.close();
        sseRef.current = null;
      }
    };
  }, [raffleId, loadInitialMessages, mergeIncomingMessages]);

  // Sending messages in real-time
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/raffle/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffleId,
          text: textToSend,
          senderName: activeSenderName,
          senderDeviceId:
            typeof window !== "undefined"
              ? localStorage.getItem("ch_raffle_device_id") || undefined
              : undefined,
        }),
      });

      if (res.ok) {
        if (!customText) setInputText("");
        const data = await res.json();
        if (data.message) {
          mergeIncomingMessages([data.message]);
          setTimeout(() => scrollToBottom(), 30);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) {
          alert(errData.error);
        }
      }
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!isOrganizer) return;
    if (!confirm("Are you sure you want to clear the live chat room?")) return;
    try {
      await fetch("/api/raffle/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear",
          raffleId,
        }),
      });
      setMessages([]);
    } catch {}
  };

  // Connect device to registered entrant
  const handleConnectEntrant = async (entrantFullName: string) => {
    setConnecting(true);
    setConnectError("");
    setConnectSuccess("");
    try {
      let clientDeviceId =
        typeof window !== "undefined"
          ? localStorage.getItem("ch_raffle_device_id") || undefined
          : undefined;
      if (!clientDeviceId) {
        clientDeviceId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        if (typeof window !== "undefined") {
          localStorage.setItem("ch_raffle_device_id", clientDeviceId);
        }
      }

      const res = await fetch("/api/raffle/claim-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffleId,
          fullName: entrantFullName,
          deviceId: clientDeviceId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActiveEntryName(entrantFullName);
        if (typeof window !== "undefined") {
          localStorage.setItem("ch_raffle_entrant_name", entrantFullName);
        }
        setConnectSuccess(`Connected as ${entrantFullName}! You can now comment.`);
        onClaimEntry?.(entrantFullName);
        setTimeout(() => {
          setShowConnectModal(false);
          setConnectSuccess("");
        }, 1200);
      } else {
        setConnectError(data.error || "Could not link device.");
      }
    } catch (err: any) {
      setConnectError(err.message || "Network error linking device.");
    } finally {
      setConnecting(false);
    }
  };

  // Filtered entrants for the search modal
  const filteredEntrants = useMemo(() => {
    if (!connectSearch.trim()) return entries.slice(0, 30);
    const q = connectSearch.trim().toLowerCase();
    return entries.filter((e) => e.fullName.toLowerCase().includes(q));
  }, [entries, connectSearch]);

  // Quick reaction emojis
  const quickEmojis = ["✋", "🎉", "💎", "❤️", "🔥", "🤞", "🙌"];

  // Quick preset chips
  const candidatePresets = [
    "✋ Present po! Ako po 'to!",
    "🙋‍♂️ Nandito po ako!",
    "🏆 Maraming salamat po!",
  ];

  const generalPresets = [
    "✋ Present po!",
    "🎉 Congrats sa winner!",
    "💎 Sana ako next!",
    "🔥 Laban lang!",
    "❤️ Thank you CH!",
  ];

  const presetsToDisplay = isCurrentPickSender ? candidatePresets : generalPresets;

  return (
    <div className={`raffle-live-chat-panel ${className}`}>
      {/* Messenger-style Group Chat Header */}
      <div className="raffle-chat-header">
        <div className="raffle-chat-header-title">
          <div className="raffle-chat-header-icon-stack">
            <MessageSquare size={16} style={{ color: "#0084ff" }} />
            <span className="raffle-chat-online-dot" />
          </div>
          <div className="raffle-chat-header-text">
            <div className="raffle-chat-room-title">
              <span>Live Draw Group Chat</span>
              <span className="raffle-chat-live-badge">
                <Radio size={10} className="raffle-chat-live-pulse-icon" />
                <span>REAL-TIME</span>
              </span>
            </div>
            <span className="raffle-chat-room-sub">
              {entries.length > 0 ? `${entries.length} Entrants` : "Community Heroes Stream"} · Instant 1s Sync
            </span>
          </div>
        </div>

        <div className="raffle-chat-header-actions">
          {isOrganizer && (
            <button
              type="button"
              className="raffle-chat-clear-btn"
              onClick={handleClearChat}
              title="Clear all chat messages (Organizer only)"
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Attendance Spotlight Banner if a Candidate is Drawn */}
      {currentCandidateName && (
        <div
          className={`raffle-chat-candidate-banner ${
            candidateClaimedMessage ? "claimed" : "waiting"
          }`}
        >
          <div className="raffle-chat-candidate-banner-top">
            <UserCheck size={15} />
            <span className="raffle-chat-candidate-banner-title">
              {candidateClaimedMessage
                ? "ATTENDANCE CONFIRMED IN CHAT! 🎉"
                : "WAITING FOR ATTENDANCE CONFIRMATION"}
            </span>
          </div>

          <p className="raffle-chat-candidate-banner-desc">
            Candidate: <strong>{currentCandidateName}</strong>
            {claimRemainingSeconds !== null && !candidateClaimedMessage && (
              <span className="raffle-chat-claim-timer">
                {" "}
                · ⏱️ {claimRemainingSeconds}s remaining
              </span>
            )}
          </p>

          {candidateClaimedMessage && (
            <div className="raffle-chat-candidate-proof">
              💬 &ldquo;{candidateClaimedMessage.text}&rdquo; —{" "}
              <em>{candidateClaimedMessage.senderName}</em>
            </div>
          )}

          {isCurrentPickSender && !candidateClaimedMessage && (
            <button
              type="button"
              className="raffle-chat-claim-action-btn"
              onClick={() => handleSendMessage("✋ Present po! Ako po 'to!")}
              disabled={sending}
            >
              <Sparkles size={14} />
              <span>Click to Confirm Attendance: &quot;Present po!&quot;</span>
            </button>
          )}
        </div>
      )}

      {/* Messenger-style Group Chat Stream */}
      <div
        ref={scrollContainerRef}
        className="raffle-chat-messages"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="raffle-chat-empty">
            <Smile size={28} style={{ color: "#38bdf8", margin: "0 auto 8px" }} />
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#ffffff" }}>
              Welcome to the Live Stream Room!
            </p>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              Chats appear here in real-time. Registered participants can cheer &amp; confirm attendance!
            </span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = Boolean(
              (isOrganizer && msg.isOrganizer) ||
              (activeEntryName &&
                msg.senderName.trim().toLowerCase() === activeEntryName.trim().toLowerCase())
            );

            const isCandidate = Boolean(
              msg.isCurrentPick ||
              (currentCandidateName &&
                msg.senderName.trim().toLowerCase() ===
                  currentCandidateName.trim().toLowerCase())
            );

            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <div
                key={msg.id}
                className={`raffle-chat-msg-row ${isMe ? "outgoing" : "incoming"}`}
              >
                {/* Incoming Message Avatar */}
                {!isMe && (
                  <div
                    className={`raffle-chat-avatar ${
                      msg.isOrganizer
                        ? "host"
                        : isCandidate
                          ? "candidate"
                          : "entrant"
                    }`}
                    style={
                      !msg.isOrganizer && !isCandidate
                        ? { background: getAvatarGradient(msg.senderName) }
                        : undefined
                    }
                    title={msg.senderName}
                  >
                    {msg.isOrganizer ? (
                      <Crown size={14} style={{ color: "#000000" }} />
                    ) : isCandidate ? (
                      <UserCheck size={14} style={{ color: "#ffffff" }} />
                    ) : (
                      <span>{getInitials(msg.senderName)}</span>
                    )}
                  </div>
                )}

                {/* Message Content Container */}
                <div className="raffle-chat-msg-content-wrapper">
                  {/* Sender Name & Role Badges (Above Bubble for Incoming) */}
                  {!isMe && (
                    <div className="raffle-chat-sender-meta">
                      <span className="raffle-chat-sender-name">
                        {msg.senderName}
                      </span>

                      {msg.isOrganizer ? (
                        <span className="raffle-chat-badge organizer">
                          <Crown size={9} />
                          <span>Host</span>
                        </span>
                      ) : isCandidate ? (
                        <span className="raffle-chat-badge candidate">
                          <UserCheck size={9} />
                          <span>Current Pick</span>
                        </span>
                      ) : (
                        <span className="raffle-chat-badge entrant">
                          <Ticket size={9} />
                          <span>Entrant</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Messenger Bubble */}
                  <div
                    className={`raffle-chat-bubble ${
                      isMe
                        ? "bubble-me"
                        : isCandidate
                          ? "bubble-candidate"
                          : msg.isOrganizer
                            ? "bubble-host"
                            : "bubble-other"
                    }`}
                  >
                    {isCandidate && (
                      <div className="raffle-chat-candidate-ping">
                        <Sparkles size={11} />
                        <span>ATTENDANCE REACTION</span>
                      </div>
                    )}
                    <p className="raffle-chat-bubble-text">{msg.text}</p>
                  </div>

                  {/* Timestamp below bubble */}
                  <span className={`raffle-chat-msg-time ${isMe ? "me" : ""}`}>
                    {timeStr}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating toast if new messages arrived while scrolled up */}
      {hasNewMessagesBelow && (
        <button
          type="button"
          className="raffle-chat-new-msg-toast"
          onClick={() => scrollToBottom()}
        >
          <ArrowDown size={13} />
          <span>New messages below</span>
        </button>
      )}

      {/* Presets & Emoji Bar (Available to Registered Entrants & Host) */}
      {canComment && (
        <div className="raffle-chat-reactions-wrapper">
          {/* Quick Emoji Toolbar */}
          <div className="raffle-chat-quick-emojis">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="raffle-chat-emoji-btn"
                onClick={() => setInputText((prev) => (prev ? `${prev} ${emoji}` : emoji))}
                title={`Add ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Quick Preset Chips */}
          <div className="raffle-chat-presets-bar">
            {presetsToDisplay.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                className={`raffle-chat-preset-chip ${
                  isCurrentPickSender ? "urgent-candidate" : ""
                }`}
                onClick={() => handleSendMessage(preset)}
                disabled={sending}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Action Area: Messenger Input Bar OR Spectator Claim Card */}
      {!canComment ? (
        <div className="raffle-chat-spectator-locked-box">
          <div className="raffle-chat-spectator-status-row">
            <span className="raffle-chat-spectator-badge">
              <Eye size={13} style={{ color: "#94a3b8" }} />
              <span>Viewing as: <strong>Spectator</strong></span>
            </span>
            <span className="raffle-chat-spectator-pill">View-Only</span>
          </div>

          <div className="raffle-chat-spectator-notice">
            <Lock size={14} className="raffle-chat-spectator-lock-icon" />
            <span>Spectators cannot comment. Only registered participants can chat.</span>
          </div>

          {/* Connect / Link Device Button for Registered Entrants */}
          <div className="raffle-chat-claim-cta-card">
            <div className="raffle-chat-claim-cta-info">
              <Ticket size={14} style={{ color: "#38bdf8" }} />
              <span>Are you registered in this raffle?</span>
            </div>
            <button
              type="button"
              className="raffle-chat-connect-device-btn"
              onClick={() => {
                setShowConnectModal(true);
                setConnectError("");
                setConnectSuccess("");
              }}
            >
              <UserCheck size={13} />
              <span>Connect Your Registered Entry</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="raffle-chat-bottom-messenger-bar">
          {/* Sender Identity Indicator */}
          <div className="raffle-chat-identity-pill">
            {isOrganizer ? (
              <span className="raffle-chat-identity-tag host">
                <Crown size={11} />
                <span><strong>Organizer (Host)</strong></span>
              </span>
            ) : (
              <span className="raffle-chat-identity-tag entrant">
                <Ticket size={11} />
                <span>Chatting as: <strong>{activeEntryName}</strong></span>
              </span>
            )}
          </div>

          {/* Messenger Pill Input Field */}
          <form
            className="raffle-chat-messenger-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isCurrentPickSender
                  ? "Attendance check: Type 'Present po!'..."
                  : "Message live group chat..."
              }
              className="raffle-chat-messenger-input"
              maxLength={250}
              disabled={sending}
            />

            <button
              type="submit"
              className={`raffle-chat-messenger-send-btn ${
                inputText.trim() ? "active" : ""
              }`}
              disabled={sending || !inputText.trim()}
              title="Send message (Enter)"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      {/* CONNECT / CLAIM DEVICE MODAL */}
      {showConnectModal && (
        <div className="raffle-connect-modal-backdrop">
          <div className="raffle-connect-modal-dialog">
            <div className="raffle-connect-modal-header">
              <div className="raffle-connect-modal-title">
                <UserCheck size={17} style={{ color: "#38bdf8" }} />
                <span>Connect Your Registered Entry</span>
              </div>
              <button
                type="button"
                className="raffle-connect-modal-close"
                onClick={() => setShowConnectModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <p className="raffle-connect-modal-desc">
              Browsing from a new phone, tablet, or browser? Select your registered name from the verified participants list to link this device and unlock live chat immediately.
            </p>

            {connectError && (
              <div className="raffle-connect-alert error">{connectError}</div>
            )}
            {connectSuccess && (
              <div className="raffle-connect-alert success">
                <CheckCircle2 size={14} />
                <span>{connectSuccess}</span>
              </div>
            )}

            {/* Search Input */}
            <div className="raffle-connect-search-box">
              <Search size={14} style={{ color: "#94a3b8" }} />
              <input
                type="text"
                value={connectSearch}
                onChange={(e) => setConnectSearch(e.target.value)}
                placeholder="Search your registered name..."
                className="raffle-connect-search-input"
                autoFocus
              />
            </div>

            {/* List of Eligible Entrants */}
            <div className="raffle-connect-entrants-list">
              {filteredEntrants.length === 0 ? (
                <div className="raffle-connect-empty">
                  No registered participant matching &quot;{connectSearch}&quot;.
                </div>
              ) : (
                filteredEntrants.map((entry) => (
                  <div key={entry.id} className="raffle-connect-entry-item">
                    <div className="raffle-connect-entry-info">
                      <div
                        className="raffle-connect-entry-avatar"
                        style={{ background: getAvatarGradient(entry.fullName) }}
                      >
                        {getInitials(entry.fullName)}
                      </div>
                      <span className="raffle-connect-entry-name">
                        {entry.fullName}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="raffle-connect-select-btn"
                      onClick={() => handleConnectEntrant(entry.fullName)}
                      disabled={connecting}
                    >
                      {connecting ? "Connecting..." : "Connect As Me"}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="raffle-connect-modal-footer">
              <span className="raffle-connect-security-note">
                🔒 Strictly verified against official tournament entries roster.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
