"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Trophy, Shuffle, Sparkles, Volume2, VolumeX, CheckCircle, Gift } from "lucide-react";
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
}: RaffleWheelModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filterUnassigned, setFilterUnassigned] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<RaffleWheelEntry | null>(null);
  const [selectedPrize, setSelectedPrize] = useState<string>(defaultPrize || "");
  const [awarding, setAwarding] = useState(false);
  const [awardedSuccess, setAwardedSuccess] = useState(false);

  // Wheel physics state
  const rotationRef = useRef<number>(0);
  const lastTickSliceRef = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const confettiFrameRef = useRef<number | null>(null);

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
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.2, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.4);
      });
    } catch {
      // ignore
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

  // Launch Confetti
  const startConfetti = () => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

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

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // gravity
        p.vx *= 0.98; // air drag
        p.rotation += p.rotationSpeed;
        if (elapsed > 2000) {
          p.alpha = Math.max(0, p.alpha - 0.015);
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

      if (elapsed < 4000) {
        confettiFrameRef.current = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    render();
  };

  // Trigger spin animation
  const spinWheel = () => {
    if (isSpinning || eligibleEntrants.length === 0) return;
    getAudioContext();

    setIsSpinning(true);
    setWinner(null);
    setAwardedSuccess(false);

    const sliceCount = eligibleEntrants.length;
    const sliceAngle = (2 * Math.PI) / sliceCount;

    // Pick random winning index
    const winningIndex = Math.floor(Math.random() * sliceCount);

    // Calculate rotation to make winning slice stop exactly at the top (angle: -PI/2)
    const targetSliceCenterOffset = winningIndex * sliceAngle + sliceAngle / 2;
    const pointerAngle = 1.5 * Math.PI; // Top (270 degrees)

    // Ensure 5 to 8 full spins + alignment
    const fullSpins = 6;
    const currentAngle = rotationRef.current % (2 * Math.PI);
    const neededOffset = (pointerAngle - targetSliceCenterOffset - currentAngle) % (2 * Math.PI);
    const normalizedOffset = neededOffset >= 0 ? neededOffset : neededOffset + 2 * Math.PI;

    const totalSpinRotation = fullSpins * 2 * Math.PI + normalizedOffset;
    const startRotation = rotationRef.current;
    const finalRotation = startRotation + totalSpinRotation;

    const spinDuration = 5200; // 5.2 seconds
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
        const selectedWinner = eligibleEntrants[winningIndex];
        setWinner(selectedWinner);
        playWinFanfare();
        startConfetti();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Draw initial state on mount or change
  useEffect(() => {
    if (isOpen) {
      setWinner(null);
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

  // Handle confirming prize assignment
  const handleConfirmAward = async () => {
    if (!winner || !selectedPrize || awarding) return;
    setAwarding(true);
    try {
      await onAssignWinner(winner.id, selectedPrize);
      setAwardedSuccess(true);
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
              <h3>Interactive Live Draw Wheel</h3>
              <small>
                {eligibleEntrants.length} eligible participants · Livestream ready
              </small>
            </div>
          </div>

          <div className="raffle-wheel-header-actions">
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
              <span>{isSpinning ? "Spinning Wheel…" : "🎡 SPIN THE WHEEL"}</span>
            </button>

            {/* Winner Announcement Card */}
            {winner && (
              <div className="raffle-wheel-winner-card">
                <div className="raffle-wheel-winner-badge">
                  <Sparkles size={14} />
                  <span>WINNER DRAWN!</span>
                </div>

                <h4 className="raffle-wheel-winner-name">{winner.fullName}</h4>
                <p className="raffle-wheel-winner-prize">
                  Won: <strong>{selectedPrize}</strong>
                </p>

                {awardedSuccess ? (
                  <div className="raffle-wheel-awarded-alert">
                    <CheckCircle size={16} />
                    <span>Prize assigned to official winners list!</span>
                  </div>
                ) : (
                  <div className="raffle-wheel-actions-row">
                    <button
                      type="button"
                      className="button primary small"
                      onClick={handleConfirmAward}
                      disabled={awarding}
                      style={{ flex: 1 }}
                    >
                      {awarding ? "Awarding…" : `🏆 Award "${selectedPrize}"`}
                    </button>
                    <button
                      type="button"
                      className="button outline small"
                      onClick={spinWheel}
                      disabled={isSpinning}
                    >
                      Re-spin
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
