"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Trophy,
  Sparkles,
  Volume2,
  VolumeX,
  Radio,
  Gift,
} from "lucide-react";
import { type RafflePrizeItem } from "@/types";
import type { LiveSpinState } from "@/server/liveSpinStore";

interface PublicLiveWheelProps {
  entries: { id: string; fullName: string; prizeWon?: string | null }[];
  prizes?: (string | RafflePrizeItem)[];
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

export function PublicLiveWheel({ entries }: PublicLiveWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [liveSpin, setLiveSpin] = useState<LiveSpinState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false); // muted by default for browser compliance
  const [celebratedWinner, setCelebratedWinner] = useState<{
    name: string;
    prize: string;
  } | null>(null);

  const rotationRef = useRef<number>(0);
  const lastTickSliceRef = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const confettiFrameRef = useRef<number | null>(null);

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
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
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
    } catch {}
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

    const sliceCount = Math.max(1, entries.length);
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

      const entrantName = entries[i]?.fullName || (entries.length === 0 ? "Awaiting participants…" : `Participant #${i + 1}`);
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

  // Confetti effect on win
  const startConfetti = () => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 700;
    canvas.height = canvas.parentElement?.clientHeight || 500;

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

      if (elapsed < 4000) {
        confettiFrameRef.current = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    render();
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

  // Synchronized wheel spin animation using millisecond physics
  useEffect(() => {
    if (!liveSpin || liveSpin.status !== "spinning") {
      drawWheel(rotationRef.current);
      return;
    }

    const sliceCount = Math.max(1, entries.length);
    const sliceAngle = (2 * Math.PI) / sliceCount;
    const winningIndex = liveSpin.winningIndex % sliceCount;

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
      drawWheel(currentRotation);

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
        drawWheel(finalRotation);
        setCelebratedWinner({
          name: liveSpin.winnerName,
          prize: liveSpin.prize,
        });
        playWinFanfare();
        startConfetti();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [liveSpin?.id, liveSpin?.status, entries.length]);

  // Initial draw and redraw on resize/entries change
  useEffect(() => {
    const timer = setTimeout(() => {
      drawWheel(rotationRef.current);
    }, 60);
    return () => clearTimeout(timer);
  }, [entries.length]);

  const isLiveSpinning = Boolean(liveSpin && liveSpin.status === "spinning");

  return (
    <div className="raffle-human-card raffle-live-wheel-card" id="public-live-wheel-section">
      <canvas ref={confettiCanvasRef} className="raffle-wheel-confetti-canvas" />

      {/* Header */}
      <div className="raffle-wheel-header embedded">
        <div className="raffle-wheel-title">
          <Trophy size={20} style={{ color: "#facc15" }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 16 }}>Live Draw Roulette Wheel</h3>
              <span className={`raffle-wheel-live-badge ${isLiveSpinning ? "active-spin" : ""}`}>
                <span className="raffle-wheel-live-dot" />
                {isLiveSpinning ? "🔴 LIVE DRAWING" : "🟢 READY FOR DRAW"}
              </span>
            </div>
            <small>
              {entries.length} participants · Synced with live stream
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

      {/* Wheel Body */}
      <div className="raffle-wheel-body embedded">
        {/* Wheel Stage */}
        <div className="raffle-wheel-stage">
          <div className="raffle-wheel-pointer" />
          <canvas
            ref={canvasRef}
            width={480}
            height={480}
            className="raffle-wheel-canvas"
          />
        </div>

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
                  🎡 Organizer is spinning the wheel live for {liveSpin?.prize}!
                </span>
              ) : (
                <span>Wheel is live and will automatically spin when the organizer draws a winner.</span>
              )}
            </p>
          </div>

          {/* Sound Prompt Notice */}
          {!soundEnabled && (
            <button
              type="button"
              className="raffle-wheel-sound-prompt"
              onClick={() => {
                getAudioContext();
                setSoundEnabled(true);
              }}
            >
              <Volume2 size={14} />
              <span>Click to enable live sound effects</span>
            </button>
          )}

          {/* Celebrated Winner announcement */}
          {celebratedWinner ? (
            <div className="raffle-wheel-winner-card">
              <div className="raffle-wheel-winner-badge">
                <Sparkles size={14} />
                <span>🎉 OFFICIAL WINNER DRAWN!</span>
              </div>

              <h4 className="raffle-wheel-winner-name">{celebratedWinner.name}</h4>
              <p className="raffle-wheel-winner-prize">
                Won: <strong>{celebratedWinner.prize}</strong>
              </p>
              <span style={{ fontSize: 11.5, color: "#4ade80", fontWeight: 600 }}>
                ✓ Recorded to official winners list
              </span>
            </div>
          ) : (
            <div className="raffle-wheel-card" style={{ textAlign: "center", padding: "20px 14px" }}>
              <Gift size={24} style={{ color: "#facc15", margin: "0 auto 8px" }} />
              <strong style={{ display: "block", color: "#ffffff", fontSize: 14 }}>
                Giveaway Prizes Ready
              </strong>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                Watch the live spin here as winners are drawn by the community organizer.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
