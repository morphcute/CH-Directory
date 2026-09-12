"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Trophy,
  Volume2,
  VolumeX,
  Radio,
  Gift,
  Clock,
  UserCheck,
  CheckCircle,
  Eye,
} from "lucide-react";
import { type RafflePrizeItem } from "@/types";
import type { LiveSpinState } from "@/server/liveSpinStore";
import { useRafflePresence } from "./useRafflePresence";
import { renderDuckRace } from "./duckRaceCanvas";

interface PublicLiveWheelProps {
  entries: { id: string; fullName: string; prizeWon?: string | null }[];
  prizes?: (string | RafflePrizeItem)[];
  onRefresh?: () => void;
}

const PALETTE = [
  { bg: "#0284c7", text: "#ffffff" }, // Sky
  { bg: "#7c3aed", text: "#ffffff" }, // Purple
  { bg: "#059669", text: "#ffffff" }, // Emerald
  { bg: "#d97706", text: "#ffffff" }, // Amber
  { bg: "#e11d48", text: "#ffffff" }, // Rose
  { bg: "#0891b2", text: "#ffffff" }, // Cyan
  { bg: "#9333ea", text: "#ffffff" }, // Violet
  { bg: "#16a34a", text: "#ffffff" }, // Green
  { bg: "#ea580c", text: "#ffffff" }, // Orange
  { bg: "#c026d3", text: "#ffffff" }, // Fuchsia
];

export function PublicLiveWheel({ entries, prizes, onRefresh }: PublicLiveWheelProps) {
  const { viewerCount, setViewerCount } = useRafflePresence();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const duckCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [liveSpin, setLiveSpin] = useState<LiveSpinState | null>(null);
  const [duckLeaders, setDuckLeaders] = useState<{ name: string; rank: number }[]>([]);

  const drawMode = liveSpin?.drawMode || "wheel";
  const isLiveSpinning = Boolean(liveSpin && liveSpin.status === "spinning");

  const awardedWinners = entries.filter((e) => Boolean(e.prizeWon));
  const excludedIdsSet = new Set(liveSpin?.excludedIds || []);
  const eligibleEntrants = entries.filter((e) => !e.prizeWon && !excludedIdsSet.has(e.id));
  const displayEntrants =
    liveSpin?.entrants && liveSpin.entrants.length > 0
      ? liveSpin.entrants
      : eligibleEntrants.length > 0
        ? eligibleEntrants
        : entries;
  const [soundEnabled, setSoundEnabled] = useState(false); // muted by default for browser compliance
  const [celebratedWinner, setCelebratedWinner] = useState<{
    name: string;
    prize: string;
  } | null>(null);
  const [claimRemaining, setClaimRemaining] = useState<number | null>(null);

  const rotationRef = useRef<number>(0);
  const lastTickSliceRef = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const confettiFrameRef = useRef<number | null>(null);
  const celebratedEventsRef = useRef<Set<string>>(new Set());
  const refreshedAwardsRef = useRef<Set<string>>(new Set());
  const isFanfarePlayingRef = useRef<boolean>(false);

  // Synchronized claim countdown calculation
  useEffect(() => {
    if (!liveSpin?.claimDeadline || liveSpin.isAwarded) {
      setClaimRemaining(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((liveSpin.claimDeadline! - Date.now()) / 1000));
      setClaimRemaining(remaining);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [liveSpin?.claimDeadline, liveSpin?.isAwarded]);

  // Sync celebrated winner with liveSpin state - only celebrate ONCE per spin, never loop
  useEffect(() => {
    if (!liveSpin || liveSpin.status === "idle") {
      setCelebratedWinner(null);
      return;
    }

    if (liveSpin.status === "spinning") {
      setCelebratedWinner(null);
      return;
    }

    if (liveSpin.status === "landed") {
      setCelebratedWinner({
        name: liveSpin.winnerName,
        prize: liveSpin.prize,
      });

      const spinId = liveSpin.id;
      // Only celebrate if this spin completed within the last 5 seconds and has not been celebrated yet
      const justFinished =
        Boolean(liveSpin.startedAt) &&
        Date.now() - (liveSpin.startedAt + (liveSpin.durationMs || 5200)) < 5000;

      if (spinId && justFinished && !celebratedEventsRef.current.has(spinId)) {
        celebratedEventsRef.current.add(spinId);
        playWinFanfare();
        startConfetti();
      }

      if (liveSpin.isAwarded && !refreshedAwardsRef.current.has(liveSpin.id)) {
        refreshedAwardsRef.current.add(liveSpin.id);
        onRefresh?.();
      }
    }
  }, [liveSpin?.id, liveSpin?.status, liveSpin?.winnerName, liveSpin?.prize, liveSpin?.isAwarded]);

  // Audio context initialization
  function getAudioContext() {
    if (!audioCtxRef.current && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current?.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }

  function playTickSound() {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {}
  }

  function playWinFanfare() {
    if (!soundEnabled || isFanfarePlayingRef.current) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    isFanfarePlayingRef.current = true;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.14, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.3);
      });
      setTimeout(() => {
        isFanfarePlayingRef.current = false;
      }, 3500);
    } catch {
      isFanfarePlayingRef.current = false;
    }
  }

  // Draw wheel on canvas
  const drawWheel = (rotationAngle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.clearRect(0, 0, width, height);

    const sliceCount = Math.max(1, displayEntrants.length);
    const sliceAngle = (2 * Math.PI) / sliceCount;

    // Outer glow ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.4)";
    ctx.lineWidth = 14;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    // Slices
    for (let i = 0; i < sliceCount; i++) {
      const startAngle = rotationAngle + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const color = PALETTE[i % PALETTE.length];

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color.bg;
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color.text;

      const fontSize = sliceCount > 50 ? 10 : sliceCount > 30 ? 11 : sliceCount > 15 ? 12 : 14;
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;

      const entrantName = displayEntrants[i]?.fullName || (displayEntrants.length === 0 ? "Awaiting participants…" : `Participant #${i + 1}`);
      const maxTextWidth = radius - 60;
      let displayName = entrantName;
      if (ctx.measureText(displayName).width > maxTextWidth) {
        while (ctx.measureText(displayName + "…").width > maxTextWidth && displayName.length > 2) {
          displayName = displayName.slice(0, -1);
        }
        displayName += "…";
      }

      ctx.fillText(displayName, radius - 20, 0);
      ctx.restore();
      ctx.restore();
    }

    // Outer border ring with gold accents
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Rivet studs around perimeter
    const studCount = Math.min(36, Math.max(16, sliceCount));
    for (let i = 0; i < studCount; i++) {
      const angle = (i * 2 * Math.PI) / studCount;
      const sx = centerX + (radius + 6) * Math.cos(angle);
      const sy = centerY + (radius + 6) * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "#facc15";
      ctx.fill();
    }
    ctx.restore();

    // Center hub cap
    ctx.save();
    const hubRadius = 38;
    const hubGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, hubRadius);
    hubGrad.addColorStop(0, "#fef08a");
    hubGrad.addColorStop(0.5, "#eab308");
    hubGrad.addColorStop(1, "#713f12");

    ctx.beginPath();
    ctx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 12;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner logo dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 14, 0, 2 * Math.PI);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.restore();
  };

  // Confetti effect on win - strictly 3 seconds duration, no looping
  const startConfetti = () => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (confettiFrameRef.current) {
      cancelAnimationFrame(confettiFrameRef.current);
      confettiFrameRef.current = null;
    }

    canvas.width = canvas.parentElement?.clientWidth || 700;
    canvas.height = canvas.parentElement?.clientHeight || 500;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles: {
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
    }[] = [];

    const confettiColors = ["#facc15", "#38bdf8", "#f43f5e", "#a855f7", "#22c55e", "#ffffff"];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 80,
        y: canvas.height * 0.45,
        size: Math.random() * 8 + 4,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        speedX: (Math.random() - 0.5) * 14,
        speedY: (Math.random() - 0.9) * 16,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
      });
    }

    const startTime = performance.now();
    const render = () => {
      const elapsed = performance.now() - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (elapsed >= 3000) {
        if (confettiFrameRef.current) {
          cancelAnimationFrame(confettiFrameRef.current);
          confettiFrameRef.current = null;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.35; // Gravity
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      confettiFrameRef.current = requestAnimationFrame(render);
    };

    confettiFrameRef.current = requestAnimationFrame(render);
  };

  // Real-time synchronization via SSE and fallback polling
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/raffle/live-stream");
      eventSource.onmessage = (event) => {
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          setLiveSpin(data);
        } catch {}
      };
      eventSource.addEventListener("viewers", (event: MessageEvent) => {
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          if (typeof data.viewerCount === "number") {
            setViewerCount(data.viewerCount);
          }
        } catch {}
      });
    } catch {
      // EventSource failed or unsupported
    }

    // Lightweight fallback polling every 3.5 seconds
    const interval = setInterval(async () => {
      try {
        if (document.visibilityState === "visible") {
          const res = await fetch("/api/raffle/live-spin", { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            setLiveSpin(data.liveSpin);
          }
        }
      } catch {}
    }, 3500);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, []);

  // Synchronized wheel spin or duck race animation using millisecond physics
  useEffect(() => {
    if (!liveSpin || liveSpin.status !== "spinning") {
      if (drawMode === "wheel") {
        drawWheel(rotationRef.current);
      }
      return;
    }

    const currentEntrants = displayEntrants;
    const sliceCount = Math.max(1, currentEntrants.length);
    const sliceAngle = (2 * Math.PI) / sliceCount;
    const winningIndex = (liveSpin.winningIndex ?? 0) % sliceCount;

    const targetSliceCenterOffset = winningIndex * sliceAngle + sliceAngle / 2;
    const pointerAngle = 1.5 * Math.PI; // Top needle (270 deg)

    const durationMs = liveSpin.durationMs || 5200;
    const fullSpins = Math.max(3, Math.round(durationMs / 900));
    const currentAngle = rotationRef.current % (2 * Math.PI);
    const neededOffset = (pointerAngle - targetSliceCenterOffset - currentAngle) % (2 * Math.PI);
    const normalizedOffset = neededOffset >= 0 ? neededOffset : neededOffset + 2 * Math.PI;

    const totalSpinRotation = fullSpins * 2 * Math.PI + normalizedOffset;
    const startRotation = rotationRef.current;
    const finalRotation = startRotation + totalSpinRotation;
    const startedAt = liveSpin.startedAt || Date.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 4);

    const animate = () => {
      const now = Date.now();
      const elapsed = Math.max(0, now - startedAt);
      const progress = Math.min(1, elapsed / durationMs);
      const easedProgress = easeOutCubic(progress);

      const currentRotation = startRotation + totalSpinRotation * easedProgress;
      rotationRef.current = currentRotation;

      if (drawMode === "duck_race") {
        if (duckCanvasRef.current) {
          renderDuckRace({
            canvas: duckCanvasRef.current,
            entrants: currentEntrants,
            winningIndex,
            progress: easedProgress,
            isRacing: true,
            isFinished: false,
            timeMs: now,
            onLeaderboardUpdate: setDuckLeaders,
          });
        }
      } else {
        drawWheel(currentRotation);
      }

      // Sound tick detection
      const normalizedCurrent = (pointerAngle - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
      const activeAngle = normalizedCurrent >= 0 ? normalizedCurrent : normalizedCurrent + 2 * Math.PI;
      const currentPassingSlice = Math.floor(activeAngle / sliceAngle) % sliceCount;

      if (currentPassingSlice !== lastTickSliceRef.current) {
        lastTickSliceRef.current = currentPassingSlice;
        playTickSound();
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        rotationRef.current = finalRotation;
        if (drawMode === "duck_race") {
          if (duckCanvasRef.current) {
            renderDuckRace({
              canvas: duckCanvasRef.current,
              entrants: currentEntrants,
              winningIndex,
              progress: 1,
              isRacing: false,
              isFinished: true,
              timeMs: now,
              onLeaderboardUpdate: setDuckLeaders,
            });
          }
        } else {
          drawWheel(finalRotation);
        }
        setCelebratedWinner({
          name: liveSpin.winnerName,
          prize: liveSpin.prize,
        });
        const spinId = liveSpin.id;
        if (spinId && !celebratedEventsRef.current.has(spinId)) {
          celebratedEventsRef.current.add(spinId);
          playWinFanfare();
          startConfetti();
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [liveSpin?.id, liveSpin?.status, displayEntrants.length, drawMode]);

  // Idle duck race bobbing animation loop for public viewers
  useEffect(() => {
    if (drawMode !== "duck_race" || isLiveSpinning) return;
    let animId: number;
    const isFinished = liveSpin?.status === "landed";
    const winningIdx = liveSpin ? (liveSpin.winningIndex ?? 0) % Math.max(1, displayEntrants.length) : 0;
    const loop = (t: number) => {
      if (duckCanvasRef.current) {
        renderDuckRace({
          canvas: duckCanvasRef.current,
          entrants: displayEntrants,
          winningIndex: winningIdx,
          progress: isFinished ? 1 : 0,
          isRacing: false,
          isFinished,
          timeMs: t,
          onLeaderboardUpdate: setDuckLeaders,
        });
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [drawMode, isLiveSpinning, displayEntrants, liveSpin?.status, liveSpin?.winningIndex]);

  // Resting angle lock on landed for wheel mode
  useEffect(() => {
    if (drawMode === "wheel" && liveSpin?.status === "landed" && displayEntrants.length > 0) {
      const sliceCount = displayEntrants.length;
      const sliceAngle = (2 * Math.PI) / sliceCount;
      const winningIndex = (liveSpin.winningIndex ?? 0) % sliceCount;
      const targetSliceCenterOffset = winningIndex * sliceAngle + sliceAngle / 2;
      const restingAngle = 1.5 * Math.PI - targetSliceCenterOffset;
      rotationRef.current = restingAngle;
      drawWheel(restingAngle);
    }
  }, [drawMode, liveSpin?.status, liveSpin?.winningIndex, displayEntrants.length]);

  // Clean up confetti animation on unmount
  useEffect(() => {
    return () => {
      if (confettiFrameRef.current) {
        cancelAnimationFrame(confettiFrameRef.current);
        confettiFrameRef.current = null;
      }
    };
  }, []);

  // Initial draw and redraw on entries change
  useEffect(() => {
    if (drawMode === "wheel") {
      const timer = setTimeout(() => {
        drawWheel(rotationRef.current);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [displayEntrants.length, liveSpin?.id, liveSpin?.status, drawMode]);


  return (
    <div className="raffle-human-card raffle-live-wheel-card" id="public-live-wheel-section">
      <canvas ref={confettiCanvasRef} className="raffle-wheel-confetti-canvas" />

      {/* Header */}
      <div className="raffle-wheel-header embedded">
        <div className="raffle-wheel-title">
          <Trophy size={20} style={{ color: "#facc15" }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 16 }}>
                {drawMode === "duck_race" ? "🦆 Live Duck Race Stream" : "🎡 Live Draw Roulette Wheel"}
              </h3>
              <span className={`raffle-wheel-live-badge ${isLiveSpinning ? "active-spin" : ""}`}>
                <span className="raffle-wheel-live-dot" />
                {isLiveSpinning ? (drawMode === "duck_race" ? "DUCK RACE LIVE" : "LIVE DRAWING") : "READY FOR DRAW"}
              </span>
              <span
                className="raffle-wheel-viewers-badge"
                title={`${viewerCount} watching live`}
              >
                <Eye size={13} style={{ color: "#38bdf8" }} />
                <span>{viewerCount}</span>
              </span>
            </div>
            <small>
              {awardedWinners.length > 0
                ? `${displayEntrants.length} eligible participants · ${awardedWinners.length} winner(s) awarded`
                : `${entries.length} participants · Synced with live stream`}
            </small>
          </div>
        </div>

        <div className="raffle-wheel-header-actions">
          <button
            type="button"
            className={`raffle-wheel-tool-btn sound-toggle ${soundEnabled ? "sound-active" : ""}`}
            onClick={() => {
              getAudioContext();
              setSoundEnabled(!soundEnabled);
            }}
            title={soundEnabled ? "Mute sound" : "Enable sound"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{soundEnabled ? "Sound ON" : "Sound OFF"}</span>
          </button>
        </div>
      </div>

      {/* Wheel or Duck Race Body */}
      <div className="raffle-wheel-body embedded">
        {/* Stage: Render Wheel or Duck Race Canvas */}
        {drawMode === "duck_race" ? (
          <div className="raffle-duck-race-stage">
            <div className="raffle-duck-race-hud">
              <span>🏁 Live River Track ({displayEntrants.length} Ducks)</span>
              {duckLeaders.length > 0 && (
                <div className="raffle-duck-race-leaderboard">
                  {duckLeaders.map((lead) => (
                    <span
                      key={lead.name}
                      className={`raffle-duck-race-leader-pill ${lead.rank === 1 ? "rank-1" : ""}`}
                    >
                      #{lead.rank} {lead.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <canvas
              ref={duckCanvasRef}
              width={500}
              height={320}
              className="raffle-duck-race-canvas"
            />
          </div>
        ) : (
          <div className="raffle-wheel-stage">
            <div className="raffle-wheel-pointer" />
            <canvas
              ref={canvasRef}
              width={480}
              height={480}
              className="raffle-wheel-canvas"
            />
          </div>
        )}

        {/* Sidebar Info */}
        <div className="raffle-wheel-sidebar">
          {/* Live Status Card */}
          <div className="raffle-wheel-card">
            <label className="raffle-wheel-label">
              <Radio size={14} style={{ color: isLiveSpinning ? "#f87171" : "#4ade80" }} />
              <span>Stream Broadcast Status</span>
            </label>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
              {isLiveSpinning ? (
                <span style={{ color: "#facc15", fontWeight: 700 }}>
                  {drawMode === "duck_race"
                    ? `Ducks are racing downstream to determine the winner of ${liveSpin?.prize}!`
                    : `Organizer is spinning the wheel live for ${liveSpin?.prize}!`}
                </span>
              ) : awardedWinners.length > 0 ? (
                <span>
                  <strong style={{ color: "#facc15" }}>{awardedWinners.length} winner(s)</strong> officially awarded. Ready for remaining draws!
                </span>
              ) : (
                <span>
                  {drawMode === "duck_race"
                    ? "Duck Race is ready. Watch ducks race when the organizer begins the draw."
                    : "Wheel is live and will automatically spin when the organizer draws a winner."}
                </span>
              )}
            </p>
          </div>

          {/* Current Pick Spotlight Card */}
          {isLiveSpinning ? (
            <div className="raffle-wheel-card" style={{ textAlign: "center", padding: "18px 14px", border: "1px solid rgba(250, 204, 21, 0.4)", background: "rgba(15, 23, 42, 0.85)" }}>
              <div className="raffle-wheel-live-badge active-spin" style={{ marginBottom: 8 }}>
                <span className="raffle-wheel-live-dot" />
                {drawMode === "duck_race" ? "DUCK RACE IN PROGRESS" : "SPINNING WHEEL LIVE"}
              </div>
              <h4 style={{ margin: "4px 0", color: "#facc15", fontSize: 16, fontWeight: 800 }}>
                Drawing Winner for {liveSpin?.prize}
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                {drawMode === "duck_race"
                  ? "Ducks are swimming downstream to the finish line!"
                  : "Wheel is spinning at full speed. Landing soon!"}
              </p>
            </div>
          ) : celebratedWinner ? (
            <div className="raffle-wheel-winner-card">
              {liveSpin?.isAwarded ? (
                <>
                  <div className="raffle-wheel-winner-badge awarded" style={{ background: "rgba(34, 197, 94, 0.2)", borderColor: "rgba(34, 197, 94, 0.5)", color: "#4ade80" }}>
                    <CheckCircle size={14} />
                    <span>PRIZE OFFICIALLY AWARDED</span>
                  </div>

                  <h4 className="raffle-wheel-winner-name">{celebratedWinner.name}</h4>
                  <p className="raffle-wheel-winner-prize">
                    Won: <strong>{celebratedWinner.prize}</strong>
                  </p>
                  <span style={{ fontSize: 11.5, color: "#4ade80", fontWeight: 600 }}>
                    Verified present in livestream and recorded to winners list!
                  </span>
                </>
              ) : (
                <>
                  <div className="raffle-wheel-winner-badge">
                    <UserCheck size={14} />
                    <span>CURRENT PICK · ATTENDANCE CHECK</span>
                  </div>

                  <h4 className="raffle-wheel-winner-name">{celebratedWinner.name}</h4>
                  <p className="raffle-wheel-winner-prize">
                    Prize: <strong>{celebratedWinner.prize}</strong>
                  </p>

                  {/* Synchronized Claim Countdown Window */}
                  <div className={`raffle-wheel-claim-box ${claimRemaining !== null && claimRemaining <= 10 ? "urgent" : ""}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Clock size={14} style={{ color: claimRemaining !== null && claimRemaining <= 10 ? "#f87171" : "#facc15" }} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: claimRemaining !== null && claimRemaining <= 10 ? "#f87171" : "#facc15" }}>
                          {claimRemaining === 0 ? "CLAIM TIME EXPIRED" : "LIVE CLAIM COUNTDOWN"}
                        </span>
                      </div>
                      <span className="raffle-wheel-claim-val">
                        {claimRemaining !== null ? (
                          `${Math.floor(claimRemaining / 60).toString().padStart(2, "0")}:${(claimRemaining % 60).toString().padStart(2, "0")}`
                        ) : (
                          "--:--"
                        )}
                      </span>
                    </div>

                    <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#94a3b8", lineHeight: 1.4 }}>
                      {claimRemaining === 0
                        ? "Time expired! Awaiting organizer attendance verification or re-pick."
                        : "Must comment in the livestream chat to confirm presence and claim this prize before time expires!"}
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="raffle-wheel-card" style={{ textAlign: "center", padding: "20px 14px" }}>
              <Gift size={24} style={{ color: "#facc15", margin: "0 auto 8px" }} />
              <strong style={{ display: "block", color: "#ffffff", fontSize: 14 }}>
                Giveaway Prizes Ready
              </strong>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                Watch the live {drawMode === "duck_race" ? "duck race" : "spin"} here as winners are drawn by the community organizer.
              </span>
            </div>
          )}

          {/* Confirmed Awarded Winners in Live Roulette */}
          {awardedWinners.length > 0 && (
            <div className="raffle-wheel-awarded-summary-card">
              <div className="raffle-wheel-awarded-summary-header">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Trophy size={14} style={{ color: "#facc15" }} />
                  <strong style={{ fontSize: 12.5, color: "#ffffff" }}>
                    Awarded Winners ({awardedWinners.length})
                  </strong>
                </div>
                <span style={{ fontSize: 10.5, color: "#4ade80", fontWeight: 700, background: "rgba(34, 197, 94, 0.15)", padding: "1px 6px", borderRadius: 4, border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                  Confirmed
                </span>
              </div>
              <div className="raffle-wheel-awarded-scroll">
                {awardedWinners.map((w, idx) => (
                  <div key={w.id || idx} className="raffle-wheel-awarded-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <span className="raffle-wheel-awarded-rank">#{idx + 1}</span>
                      <span className="raffle-wheel-awarded-winner-name">{w.fullName}</span>
                    </div>
                    <span className="raffle-wheel-awarded-prize-chip">
                      {w.prizeWon}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
