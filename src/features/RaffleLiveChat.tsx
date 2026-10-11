"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Send,
  Sparkles,
  UserCheck,
  ShieldAlert,
  Trash2,
  Crown,
  Ticket,
  Eye,
  MessageSquare,
  AlertCircle,
  ArrowDown,
  Smile,
  Lock,
} from "lucide-react";
import type { RaffleChatMessage } from "@/server/raffleChatStore";

interface RaffleLiveChatProps {
  raffleId?: string;
  myEntryName?: string;
  isOrganizer?: boolean;
  currentCandidateName?: string | null;
  claimRemainingSeconds?: number | null;
  className?: string;
  onCandidateSpotted?: (msg: RaffleChatMessage) => void;
  onNewMessage?: (msg: RaffleChatMessage) => void;
}

export function RaffleLiveChat({
  raffleId = "default",
  myEntryName,
  isOrganizer = false,
  currentCandidateName,
  claimRemainingSeconds,
  className = "",
  onCandidateSpotted,
  onNewMessage,
}: RaffleLiveChatProps) {
  const [messages, setMessages] = useState<RaffleChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const canComment = Boolean(isOrganizer || myEntryName);
  const [sending, setSending] = useState(false);
  const [spectatorNumber] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("ch_chat_spectator_num");
      if (saved) return Number(saved);
      const gen = Math.floor(100 + Math.random() * 900);
      sessionStorage.setItem("ch_chat_spectator_num", String(gen));
      return gen;
    }
    return 758;
  });
  const [hasNewMessagesBelow, setHasNewMessagesBelow] = useState(false);
  const [candidateClaimedMessage, setCandidateClaimedMessage] = useState<RaffleChatMessage | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const sseRef = useRef<EventSource | null>(null);

  const activeSenderName = isOrganizer
    ? "👑 Organizer"
    : myEntryName
      ? myEntryName
      : `Spectator #${spectatorNumber}`;

  const isCurrentPickSender = Boolean(
    currentCandidateName &&
    myEntryName &&
    myEntryName.trim().toLowerCase() === currentCandidateName.trim().toLowerCase()
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
        m.timestamp > Date.now() - 120000 // within last 2 minutes
    );
    if (found) {
      setCandidateClaimedMessage(found);
      if (onCandidateSpotted) onCandidateSpotted(found);
    }
  }, [messages, currentCandidateName, onCandidateSpotted]);

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

  // SSE setup for real-time live chat
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
          if (Array.isArray(parsed)) {
            setMessages(parsed);
            if (isNearBottomRef.current) scrollToBottom(true);
          }
        } catch {}
      });

      es.addEventListener("chat_message", (e: MessageEvent) => {
        try {
          if (!e.data) return;
          const newMsg: RaffleChatMessage = JSON.parse(e.data);
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev.slice(-99), newMsg];
          });

          if (isNearBottomRef.current) {
            setTimeout(() => scrollToBottom(), 50);
          } else {
            setHasNewMessagesBelow(true);
          }

          if (onNewMessage) {
            onNewMessage(newMsg);
          }
        } catch {}
      });
    } catch {
      // Fallback polling if SSE is blocked
    }

    // Polling backup every 2.5 seconds
    const interval = setInterval(async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/raffle/chat?raffleId=${encodeURIComponent(raffleId)}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.messages)) {
              setMessages((prev) => {
                if (data.messages.length > prev.length) {
                  const newItems = data.messages.slice(prev.length);
                  newItems.forEach((m: RaffleChatMessage) => onNewMessage?.(m));
                }
                if (data.messages.length !== prev.length || (data.messages[data.messages.length - 1]?.id !== prev[prev.length - 1]?.id)) {
                  if (isNearBottomRef.current) setTimeout(() => scrollToBottom(), 50);
                  return data.messages;
                }
                return prev;
              });
            }
          }
        } catch {}
      }
    }, 2500);

    return () => {
      clearInterval(interval);
      if (es) {
        es.close();
        sseRef.current = null;
      }
    };
  }, [raffleId, loadInitialMessages]);

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
          isEntrant: Boolean(myEntryName),
        }),
      });

      if (res.ok) {
        if (!customText) setInputText("");
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev.slice(-99), data.message];
          });
          setTimeout(() => scrollToBottom(), 40);
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

  // Preset quick reaction chips
  const candidatePresets = [
    "✋ Present po! Ako po 'to!",
    "🙋‍♂️ Nandito po ako!",
    "🏆 Maraming salamat po!",
  ];

  const generalPresets = [
    "Congrats! 🎉",
    "Sana all! 🏆",
    "Good luck! 🍀",
    "Thank you CH! ❤️",
    "Laban lang! 🔥",
  ];

  const presetsToDisplay = isCurrentPickSender ? candidatePresets : generalPresets;

  return (
    <div className={`raffle-live-chat-panel ${className}`}>
      {/* Chat Header */}
      <div className="raffle-chat-header">
        <div className="raffle-chat-header-title">
          <MessageSquare size={16} style={{ color: "#38bdf8" }} />
          <span>Live Chat</span>
          <span className="raffle-chat-live-pill">
            <span className="raffle-chat-live-pulse" /> LIVE
          </span>
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

      {/* Chat Messages List */}
      <div
        ref={scrollContainerRef}
        className="raffle-chat-messages"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="raffle-chat-empty">
            <Smile size={24} style={{ color: "#64748b", margin: "0 auto 6px" }} />
            <p>Welcome to the live draw chat!</p>
            <span>Say hello or cheer for your favorite Community Hero!</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe =
              myEntryName &&
              msg.senderName.trim().toLowerCase() === myEntryName.trim().toLowerCase();
            const isCandidate =
              msg.isCurrentPick ||
              (currentCandidateName &&
                msg.senderName.trim().toLowerCase() ===
                  currentCandidateName.trim().toLowerCase());

            return (
              <div
                key={msg.id}
                className={`raffle-chat-msg ${
                  isCandidate
                    ? "candidate-spotlight"
                    : msg.isOrganizer
                      ? "organizer-msg"
                      : isMe
                        ? "my-msg"
                        : ""
                }`}
              >
                <div className="raffle-chat-msg-header">
                  <strong className="raffle-chat-sender-name">
                    {msg.senderName}
                  </strong>

                  {/* Badge */}
                  {msg.isOrganizer ? (
                    <span className="raffle-chat-badge organizer">
                      <Crown size={10} />
                      <span>Host</span>
                    </span>
                  ) : isCandidate ? (
                    <span className="raffle-chat-badge candidate">
                      <UserCheck size={10} />
                      <span>Current Pick</span>
                    </span>
                  ) : msg.badge === "entrant" || (!msg.badge && !msg.isOrganizer) ? (
                    <span className="raffle-chat-badge entrant">
                      <Ticket size={10} />
                      <span>Entrant</span>
                    </span>
                  ) : (
                    <span className="raffle-chat-badge spectator">
                      <Eye size={10} />
                      <span>Spectator</span>
                    </span>
                  )}

                  <span className="raffle-chat-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="raffle-chat-bubble">
                  {isCandidate && (
                    <div className="raffle-chat-candidate-ping">
                      <Sparkles size={12} />
                      <span>ATTENDANCE REACTION</span>
                    </div>
                  )}
                  <p className="raffle-chat-text">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New messages toast */}
      {hasNewMessagesBelow && (
        <button
          type="button"
          className="raffle-chat-new-msg-toast"
          onClick={() => scrollToBottom()}
        >
          <ArrowDown size={13} />
          <span>New messages</span>
        </button>
      )}

      {/* Presets Row - Only available to registered participants & organizer */}
      {canComment && (
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
      )}

      {/* Bottom Action Area: Form or Spectator View-Only Card */}
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
        </div>
      ) : (
        <>
          {/* Identity Bar */}
          <div className="raffle-chat-identity-bar">
            {isOrganizer ? (
              <span className="raffle-chat-identity-tag host">
                <Crown size={12} />
                <span>Chatting as: <strong>Organizer (Host)</strong></span>
              </span>
            ) : (
              <span className="raffle-chat-identity-tag entrant">
                <Ticket size={12} />
                <span>Chatting as: <strong>{myEntryName}</strong> (Registered Entrant)</span>
              </span>
            )}
          </div>

          <form
            className="raffle-chat-input-bar"
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
                  ? "Confirm presence: 'Present po!'"
                  : "Type a live chat message..."
              }
              className="raffle-chat-input"
              maxLength={250}
              disabled={sending}
            />
            <button
              type="submit"
              className="raffle-chat-send-btn"
              disabled={sending || !inputText.trim()}
              title="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
