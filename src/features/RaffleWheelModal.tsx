"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Trophy, Shuffle, Volume2, VolumeX, CheckCircle, Gift, RefreshCw, Timer, Clock, UserCheck, RotateCcw } from "lucide-react";
import { type RafflePrizeItem, normalizePrizeItems } from "@/types";

interface RaffleWheelEntry {
  id: string;
  fullName: string;
  prizeWon?: string | null;
}

interface RaffleWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: RaffleWheelEntry[];
  prizes: (string | RafflePrizeItem)[];
  defaultPrize?: string;
  onAssignWinner: (entryId: string, prizeWon: string) => Promise<boolean | void>;
  onRefresh?: () => Promise<void>;
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

export function RaffleWheelModal({
  isOpen,
  onClose,
  entries,
  prizes,
  defaultPrize,
  onAssignWinner,
  onRefresh,
}: RaffleWheelModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filterUnassigned, setFilterUnassigned] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [winner, setWinner] = useState<RaffleWheelEntry | null>(null);
  const [selectedPrize, setSelectedPrize] = useState<string>(defaultPrize || "");
  const [awarding, setAwarding] = useState(false);
  const [awardedSuccess, setAwardedSuccess] = useState(false);
  const [spinDurationSeconds, setSpinDurationSeconds] = useState<number>(6);
  const [claimDurationSeconds, setClaimDurationSeconds] = useState<number>(60);
  const [claimDeadline, setClaimDeadline] = useState<number | null>(null);
  const [claimRemaining, setClaimRemaining] = useState<number>(60);

  // Wheel physics state
  const rotationRef = useRef<number>(0);
  const lastTickSliceRef = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const confettiFrameRef = useRef<number | null>(null);
  const isFanfarePlayingRef = useRef<boolean>(false);

  // Filter entrants
  const normalizedPrizes = normalizePrizeItems(prizes);
  const eligibleEntrants = filterUnassigned
    ? entries.filter((e) => !e.prizeWon)
    : entries;

  // Initialize selected prize if not set
  useEffect(() => {
    if (!selectedPrize && normalizedPrizes.length > 0) {
      setSelectedPrize(normalizedPrizes[0].name);
    }
  }, [normalizedPrizes, selectedPrize]);

  // Init audio context on user interaction
  function getAudioContext() {
    if (!audioCtxRef.current && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
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
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // Audio playback can fail if not interacted
    }
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

  // Draw the Roulette Wheel on Canvas
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

    const sliceCount = Math.max(1, eligibleEntrants.length);
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

      const entrantName = eligibleEntrants[i]?.fullName || `Participant #${i + 1}`;
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

    // Outer rim pins (golden dots)
    const pinCount = Math.max(12, Math.min(sliceCount, 36));
    for (let p = 0; p < pinCount; p++) {
      const pinAngle = rotationAngle + (p * 2 * Math.PI) / pinCount;
      const pinX = centerX + (radius + 5) * Math.cos(pinAngle);
      const pinY = centerY + (radius + 5) * Math.sin(pinAngle);
      ctx.beginPath();
      ctx.arc(pinX, pinY, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = "#fde047";
      ctx.fill();
      ctx.strokeStyle = "#854d0e";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Center hub
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 38, 0, 2 * Math.PI);
    ctx.fillStyle = "#090d16";
    ctx.fill();
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Center Emblem Icon / Stars
    ctx.beginPath();
    ctx.arc(centerX, centerY, 28, 0, 2 * Math.PI);
    ctx.fillStyle = "#1e293b";
    ctx.fill();

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CH", centerX, centerY);
    ctx.restore();
  };

  // Launch Confetti - strictly 3 seconds duration, no looping
  const startConfetti = () => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (confettiFrameRef.current) {
      cancelAnimationFrame(confettiFrameRef.current);
      confettiFrameRef.current = null;
    }

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      rotationSpeed: number;
      shape: "square" | "circle" | "star";
      alpha: number;
    }

    const colors = ["#facc15", "#38bdf8", "#ec4899", "#a855f7", "#34d399", "#f97316"];
    const particles: Particle[] = [];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 60,
        y: canvas.height * 0.45 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 14 - 6,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        shape: Math.random() > 0.6 ? "star" : Math.random() > 0.3 ? "square" : "circle",
        alpha: 1,
      });
    }

    const startTime = Date.now();
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsed = Date.now() - startTime;

      if (elapsed >= 3000) {
        if (confettiFrameRef.current) {
          cancelAnimationFrame(confettiFrameRef.current);
          confettiFrameRef.current = null;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // gravity
        p.vx *= 0.98; // air drag
        p.rotation += p.rotationSpeed;
        if (elapsed > 1800) {
          p.alpha = Math.max(0, p.alpha - 0.025);
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "square") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          // Draw mini star
          ctx.beginPath();
          for (let s = 0; s < 5; s++) {
            ctx.lineTo(
              Math.cos(((18 + s * 72) * Math.PI) / 180) * p.size,
              -Math.sin(((18 + s * 72) * Math.PI) / 180) * p.size,
            );
            ctx.lineTo(
              Math.cos(((54 + s * 72) * Math.PI) / 180) * (p.size / 2),
              -Math.sin(((54 + s * 72) * Math.PI) / 180) * (p.size / 2),
            );
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      confettiFrameRef.current = requestAnimationFrame(render);
    };

    confettiFrameRef.current = requestAnimationFrame(render);
  };

  // Trigger spin animation
  const spinWheel = () => {
    if (isSpinning || eligibleEntrants.length === 0) return;
    getAudioContext();

    setIsSpinning(true);
    setWinner(null);
    setClaimDeadline(null);
    setAwardedSuccess(false);

    const sliceCount = eligibleEntrants.length;
    const sliceAngle = (2 * Math.PI) / sliceCount;

    // Pick random winning index
    const winningIndex = Math.floor(Math.random() * sliceCount);
    const selectedWinner = eligibleEntrants[winningIndex];
    const spinDuration = Math.max(2, Math.min(30, spinDurationSeconds)) * 1000;

    // Broadcast live spin to public /raffle page viewers in real-time!
    void fetch("/api/raffle/live-spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        prize: selectedPrize,
        winnerId: selectedWinner.id,
        winnerName: selectedWinner.fullName,
        winningIndex,
        startedAt: Date.now(),
        durationMs: spinDuration,
        sliceCount,
      }),
    }).catch(() => {});

    // Calculate rotation to make winning slice stop exactly at the top (angle: -PI/2)
    const targetSliceCenterOffset = winningIndex * sliceAngle + sliceAngle / 2;
    const pointerAngle = 1.5 * Math.PI; // Top (270 degrees)

    // Calculate full spins based on duration for natural physics momentum
    const fullSpins = Math.max(3, Math.round(spinDuration / 900));
    const currentAngle = rotationRef.current % (2 * Math.PI);
    const neededOffset = (pointerAngle - targetSliceCenterOffset - currentAngle) % (2 * Math.PI);
    const normalizedOffset = neededOffset >= 0 ? neededOffset : neededOffset + 2 * Math.PI;

    const totalSpinRotation = fullSpins * 2 * Math.PI + normalizedOffset;
    const startRotation = rotationRef.current;
    const finalRotation = startRotation + totalSpinRotation;

    const startTime = performance.now();

    // Easing function: fast start, long smooth cinematic deceleration
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 4);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / spinDuration);
      const easedProgress = easeOutCubic(progress);

      const currentRotation = startRotation + totalSpinRotation * easedProgress;
      rotationRef.current = currentRotation;
      drawWheel(currentRotation);

      // Sound tick detection: calculate which slice currently passes the top needle
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
        drawWheel(finalRotation);
        setIsSpinning(false);
        setWinner(selectedWinner);
        const deadline = Date.now() + claimDurationSeconds * 1000;
        setClaimDeadline(deadline);
        setClaimRemaining(claimDurationSeconds);
        playWinFanfare();
        startConfetti();

        // Broadcast landed state to public viewers with synchronized claim timer
        void fetch("/api/raffle/live-spin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "landed",
            claimSeconds: claimDurationSeconds,
            claimDeadline: deadline,
          }),
        }).catch(() => {});
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Synchronized countdown interval for claim window
  useEffect(() => {
    if (!claimDeadline || awardedSuccess) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((claimDeadline - Date.now()) / 1000));
      setClaimRemaining(remaining);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [claimDeadline, awardedSuccess]);

  // Adjust claim window seconds live and broadcast
  const updateClaimTimer = (newSecs: number) => {
    setClaimDurationSeconds(newSecs);
    if (winner && !awardedSuccess) {
      const newDeadline = Date.now() + newSecs * 1000;
      setClaimDeadline(newDeadline);
      setClaimRemaining(newSecs);
      void fetch("/api/raffle/live-spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim_timer",
          claimSeconds: newSecs,
          claimDeadline: newDeadline,
        }),
      }).catch(() => {});
    }
  };

  // Add time to active claim timer (+30s)
  const addClaimTime = (addSecs: number) => {
    if (!winner || awardedSuccess) return;
    const currentBase = claimDeadline ? Math.max(Date.now(), claimDeadline) : Date.now();
    const newDeadline = currentBase + addSecs * 1000;
    const totalRemaining = Math.max(0, Math.ceil((newDeadline - Date.now()) / 1000));
    setClaimDeadline(newDeadline);
    setClaimRemaining(totalRemaining);
    void fetch("/api/raffle/live-spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "claim_timer",
        claimSeconds: totalRemaining,
        claimDeadline: newDeadline,
      }),
    }).catch(() => {});
  };

  // Re-pick another winner immediately (candidate absent or time expired)
  const handleRepick = () => {
    setWinner(null);
    setClaimDeadline(null);
    setAwardedSuccess(false);
    void fetch("/api/raffle/live-spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "repick" }),
    }).catch(() => {});
    setTimeout(() => {
      spinWheel();
    }, 150);
  };

  // Draw initial state on mount or change
  useEffect(() => {
    if (isOpen) {
      setWinner(null);
      setClaimDeadline(null);
      setAwardedSuccess(false);
      setTimeout(() => {
        drawWheel(rotationRef.current);
      }, 50);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (confettiFrameRef.current) cancelAnimationFrame(confettiFrameRef.current);
    };
  }, [isOpen, eligibleEntrants.length]);

  // Realtime background sync while wheel modal is open
  useEffect(() => {
    if (!isOpen || !onRefresh) return;
    const interval = setInterval(() => {
      if (!isSpinning && document.visibilityState === "visible") {
        void onRefresh();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen, isSpinning, onRefresh]);

  // Handle confirming prize assignment
  const handleConfirmAward = async () => {
    if (!winner || !selectedPrize || awarding) return;
    setAwarding(true);
    try {
      await onAssignWinner(winner.id, selectedPrize);
      setAwardedSuccess(true);
      void fetch("/api/raffle/live-spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "awarded" }),
      }).catch(() => {});
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setAwarding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ch-modal-backdrop" onClick={() => !isSpinning && onClose()}>
      <div
        className="raffle-wheel-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Confetti Overlay */}
        <canvas ref={confettiCanvasRef} className="raffle-wheel-confetti-canvas" />

        {/* Header */}
        <div className="raffle-wheel-header">
          <div className="raffle-wheel-title">
            <Trophy size={20} style={{ color: "#facc15" }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3>Interactive Live Draw Wheel</h3>
                <span className="raffle-wheel-live-badge">
                  <span className="raffle-wheel-live-dot" /> LIVE SYNC
                </span>
              </div>
              <small>
                {eligibleEntrants.length} eligible participants · Livestream ready
              </small>
            </div>
          </div>

          <div className="raffle-wheel-header-actions">
            <button
              type="button"
              className="raffle-wheel-tool-btn"
              onClick={async () => {
                if (refreshing || isSpinning) return;
                setRefreshing(true);
                try {
                  if (onRefresh) await onRefresh();
                } finally {
                  setRefreshing(false);
                }
              }}
              disabled={isSpinning || refreshing}
              title="Sync latest participants"
            >
              <RefreshCw size={15} className={refreshing ? "busy-spinner" : ""} />
            </button>
            <button
              type="button"
              className="raffle-wheel-tool-btn"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute audio" : "Enable audio"}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              className="raffle-wheel-tool-btn close"
              onClick={() => !isSpinning && onClose()}
              disabled={isSpinning}
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Wheel Body */}
        <div className="raffle-wheel-body">
          {/* Wheel Stage */}
          <div className="raffle-wheel-stage">
            {/* Top Pointer Ticker Needle */}
            <div className="raffle-wheel-pointer" />

            {/* Canvas Wheel */}
            <canvas
              ref={canvasRef}
              width={480}
              height={480}
              className="raffle-wheel-canvas"
            />
          </div>

          {/* Controls & Winner Panel */}
          <div className="raffle-wheel-sidebar">
            {/* Prize Selector */}
            <div className="raffle-wheel-card">
              <label className="raffle-wheel-label">
                <Gift size={14} style={{ color: "#facc15" }} />
                <span>Prize Being Drawn</span>
              </label>
              <select
                value={selectedPrize}
                onChange={(e) => setSelectedPrize(e.target.value)}
                disabled={isSpinning}
                className="raffle-wheel-select"
              >
                {normalizedPrizes.map((pz, idx) => (
                  <option key={idx} value={pz.name}>
                    {pz.name} (x{pz.winnerCount})
                  </option>
                ))}
                <option value="Custom Prize">Custom Prize…</option>
              </select>

              {selectedPrize === "Custom Prize" && (
                <input
                  type="text"
                  placeholder="Enter prize name"
                  onChange={(e) => setSelectedPrize(e.target.value)}
                  className="raffle-wheel-input"
                  style={{ marginTop: 8 }}
                />
              )}
            </div>

            {/* Customize Spin Timer / Duration */}
            <div className="raffle-wheel-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label className="raffle-wheel-label" style={{ margin: 0 }}>
                  <Timer size={14} style={{ color: "#38bdf8" }} />
                  <span>Spin Duration</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8" }}>
                  {spinDurationSeconds}s
                </span>
              </div>

              <div className="raffle-wheel-timer-presets">
                {[3, 5, 8, 10, 15].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`raffle-wheel-timer-chip ${spinDurationSeconds === sec ? "active" : ""}`}
                    onClick={() => setSpinDurationSeconds(sec)}
                    disabled={isSpinning}
                  >
                    {sec}s
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <input
                  type="range"
                  min={3}
                  max={25}
                  step={1}
                  value={spinDurationSeconds}
                  onChange={(e) => setSpinDurationSeconds(Number(e.target.value))}
                  disabled={isSpinning}
                  style={{ flex: 1, accentColor: "#38bdf8", cursor: "pointer" }}
                />
                <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {spinDurationSeconds < 5 ? "Fast" : spinDurationSeconds <= 9 ? "Balanced" : "Dramatic"}
                </span>
              </div>
            </div>

            {/* Customize Claim Timer Window */}
            <div className="raffle-wheel-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label className="raffle-wheel-label" style={{ margin: 0 }}>
                  <Clock size={14} style={{ color: "#facc15" }} />
                  <span>Claim Countdown Window</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#facc15" }}>
                  {claimDurationSeconds}s
                </span>
              </div>

              <div className="raffle-wheel-timer-presets">
                {[30, 60, 90, 120].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`raffle-wheel-timer-chip ${claimDurationSeconds === sec ? "active" : ""}`}
                    onClick={() => updateClaimTimer(sec)}
                    disabled={isSpinning}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Toggle */}
            <div className="raffle-wheel-filter-row">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={filterUnassigned}
                  disabled={isSpinning}
                  onChange={(e) => setFilterUnassigned(e.target.checked)}
                />
                <span>Exclude past winners ({entries.filter((e) => Boolean(e.prizeWon)).length} already won)</span>
              </label>
            </div>

            {/* Spin Button */}
            <button
              type="button"
              className="raffle-wheel-spin-btn"
              onClick={spinWheel}
              disabled={isSpinning || eligibleEntrants.length === 0}
            >
              <Shuffle size={18} className={isSpinning ? "busy-spinner" : ""} />
              <span>{isSpinning ? "Spinning Wheel…" : "SPIN THE WHEEL"}</span>
            </button>

            {/* Candidate Drawn / Attendance Verification Card */}
            {winner && (
              <div className="raffle-wheel-winner-card">
                <div className="raffle-wheel-winner-badge">
                  <UserCheck size={14} />
                  <span>NAME DRAWN · ATTENDANCE CHECK</span>
                </div>

                <h4 className="raffle-wheel-winner-name">{winner.fullName}</h4>
                <p className="raffle-wheel-winner-prize">
                  Prize: <strong>{selectedPrize}</strong>
                </p>

                {awardedSuccess ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="raffle-wheel-awarded-alert">
                      <CheckCircle size={16} />
                      <span>Prize confirmed and officially recorded!</span>
                    </div>
                    <button
                      type="button"
                      className="button primary small"
                      onClick={() => {
                        setWinner(null);
                        setClaimDeadline(null);
                        setAwardedSuccess(false);
                        drawWheel(rotationRef.current);
                      }}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      <span>Draw Next Prize</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Live Synchronized Claim Countdown */}
                    <div className={`raffle-wheel-claim-box ${claimRemaining <= 10 ? "urgent" : ""}`}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Clock size={14} style={{ color: claimRemaining <= 10 ? "#f87171" : "#facc15" }} />
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: claimRemaining <= 10 ? "#f87171" : "#facc15" }}>
                            {claimRemaining === 0 ? "CLAIM TIME EXPIRED" : "LIVE CLAIM COUNTDOWN"}
                          </span>
                        </div>
                        <span className="raffle-wheel-claim-val">
                          {Math.floor(claimRemaining / 60).toString().padStart(2, "0")}:
                          {(claimRemaining % 60).toString().padStart(2, "0")}
                        </span>
                      </div>

                      {/* Quick Adjust Buttons */}
                      <div className="raffle-wheel-claim-adjust-row">
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>Set timer:</span>
                        {[30, 60, 90, 120].map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={`raffle-wheel-adjust-chip ${claimDurationSeconds === s ? "active" : ""}`}
                            onClick={() => updateClaimTimer(s)}
                          >
                            {s}s
                          </button>
                        ))}
                        <button
                          type="button"
                          className="raffle-wheel-adjust-chip"
                          onClick={() => addClaimTime(30)}
                          title="Add 30 seconds"
                        >
                          +30s
                        </button>
                      </div>

                      <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                        {claimRemaining === 0
                          ? "Participant did not respond in stream. Click 'Re-pick Another Winner' below."
                          : "Entrant must comment in livestream chat to claim. If not present, re-pick another winner."}
                      </p>
                    </div>

                    {/* Action buttons: Confirm Present vs Re-pick */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        className="button primary small"
                        onClick={handleConfirmAward}
                        disabled={awarding}
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          background: "#22c55e",
                          borderColor: "#16a34a",
                          color: "#ffffff",
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle size={15} />
                        <span>{awarding ? "Awarding…" : `Confirm Present & Award Prize`}</span>
                      </button>

                      <button
                        type="button"
                        className="button outline small"
                        onClick={handleRepick}
                        disabled={isSpinning}
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          color: "#f87171",
                          borderColor: "rgba(239, 68, 68, 0.45)",
                          fontWeight: 600,
                        }}
                      >
                        <RotateCcw size={14} />
                        <span>Re-pick Another Winner</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Confirmed Awarded Winners in Modal */}
            {entries.some((e) => Boolean(e.prizeWon)) && (
              <div className="raffle-wheel-awarded-summary-card" style={{ marginTop: 12 }}>
                <div className="raffle-wheel-awarded-summary-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Trophy size={14} style={{ color: "#facc15" }} />
                    <strong style={{ fontSize: 12.5, color: "#ffffff" }}>
                      Awarded Winners ({entries.filter((e) => Boolean(e.prizeWon)).length})
                    </strong>
                  </div>
                  <span style={{ fontSize: 10.5, color: "#4ade80", fontWeight: 700, background: "rgba(34, 197, 94, 0.15)", padding: "1px 6px", borderRadius: 4, border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                    Recorded
                  </span>
                </div>
                <div className="raffle-wheel-awarded-scroll">
                  {entries
                    .filter((e) => Boolean(e.prizeWon))
                    .map((w, idx) => (
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
    </div>
  );
}
