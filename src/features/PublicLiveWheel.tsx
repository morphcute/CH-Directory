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
import { LiveViewersModal } from "./LiveViewersModal";
import { render3DRealisticWheel } from "./wheelRenderer3D";
import {
  init3DDuckRace,
  render3DDuckRace,
  draw3DIdleDucks,
  type DuckRaceState,
} from "./duckRaceCanvas3D";

interface PublicLiveWheelProps {
  entries: { id: string; fullName: string; prizeWon?: string | null }[];
  prizes?: (string | RafflePrizeItem)[];
  onRefresh?: () => void;
  myEntryName?: string;
}

export function PublicLiveWheel({ entries, prizes, onRefresh, myEntryName }: PublicLiveWheelProps) {
  const { viewerCount, setViewerCount, viewersList, setViewersList } = useRafflePresence({
    entryName: myEntryName,
  });
  const [showViewersModal, setShowViewersModal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [liveSpin, setLiveSpin] = useState<LiveSpinState | null>(null);

  const isLiveSpinning = Boolean(liveSpin && liveSpin.status === "spinning");
  const drawMode = liveSpin?.drawMode || "wheel";

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
  const [spinCountdown, setSpinCountdown] = useState<number>(0);

  const rotationRef = useRef<number>(0);
  const lastTickSliceRef = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const confettiFrameRef = useRef<number | null>(null);
  const duckRaceStateRef = useRef<DuckRaceState | null>(null);
  const idleDuckFrameRef = useRef<number | null>(null);
  const celebratedEventsRef = useRef<Set<string>>(new Set());
  const refreshedAwardsRef = useRef<Set<string>>(new Set());
  const isFanfarePlayingRef = useRef<boolean>(false);
  const lastShuffledAtRef = useRef<number>(0);

  // Live countdown timer during spin / duck race
  useEffect(() => {
    if (!isLiveSpinning || !liveSpin?.startedAt || !liveSpin?.durationMs) {
      setSpinCountdown(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((liveSpin.startedAt + liveSpin.durationMs - Date.now()) / 1000));
      setSpinCountdown(remaining);
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [isLiveSpinning, liveSpin?.startedAt, liveSpin?.durationMs]);

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

  // Sync celebrated winner with liveSpin state
  // ONLY display the current unawarded pick undergoing attendance check. Awarded winners stay in Awarded Winners!
  useEffect(() => {
    if (!liveSpin || liveSpin.status === "idle" || liveSpin.isAwarded || !liveSpin.winnerName) {
      setCelebratedWinner(null);
      return;
    }

    if (liveSpin.status === "spinning") {
      setCelebratedWinner(null);
      return;
    }

    if (liveSpin.status === "landed" && !liveSpin.isAwarded) {
      setCelebratedWinner({
        name: liveSpin.winnerName,
        prize: liveSpin.prize,
      });

      const spinId = liveSpin.id;
      // Celebrate once on landing
      if (spinId && !celebratedEventsRef.current.has(spinId)) {
        celebratedEventsRef.current.add(spinId);
        playWinFanfare();
        startConfetti();
      }
    }
  }, [liveSpin?.id, liveSpin?.status, liveSpin?.winnerName, liveSpin?.prize, liveSpin?.isAwarded]);

  // Trigger refresh on award event
  useEffect(() => {
    if (liveSpin?.isAwarded && !refreshedAwardsRef.current.has(liveSpin.id)) {
      refreshedAwardsRef.current.add(liveSpin.id);
      setCelebratedWinner(null);
      onRefresh?.();
    }
  }, [liveSpin?.id, liveSpin?.isAwarded, onRefresh]);

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

  // Draw 3D realistic roulette wheel on canvas
  const needleDeflectionRef = useRef<number>(0);
  const drawWheel = (rotationAngle: number, needleDeflection = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    render3DRealisticWheel(
      ctx,
      canvas.width,
      canvas.height,
      rotationAngle,
      displayEntrants,
      needleDeflection
    );
  };

  // Confetti Particle Explosion
  const startConfetti = () => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 500;
    canvas.height = canvas.parentElement?.clientHeight || 400;

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      vRot: number;
      alpha: number;
    }[] = [];

    const colors = ["#facc15", "#4ade80", "#38bdf8", "#f43f5e", "#a855f7"];
    for (let i = 0; i < 70; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14 - 3,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        alpha: 1,
      });
    }

    let frame = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.rotation += p.vRot;
        p.alpha = Math.max(0, 1 - frame / 100);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (frame < 100) {
        confettiFrameRef.current = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        confettiFrameRef.current = null;
      }
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
          if (Array.isArray(data.viewers)) {
            setViewersList(data.viewers);
          }
        } catch {}
      });
    } catch {
      // EventSource fallback to polling
    }

    // Lightweight fallback polling every 2.5 seconds
    const interval = setInterval(async () => {
      try {
        if (document.visibilityState === "visible") {
          const res = await fetch("/api/raffle/live-spin", { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            setLiveSpin(data.liveSpin);
          }
          const vRes = await fetch("/api/raffle/viewers", { cache: "no-store" });
          if (vRes.ok) {
            const vData = await vRes.json();
            if (typeof vData.viewerCount === "number") setViewerCount(vData.viewerCount);
            if (Array.isArray(vData.viewers)) setViewersList(vData.viewers);
          }
        }
      } catch {}
    }, 2500);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, []);

  // Real-time Stage Redraw on Participant changes or Real-time Shuffle
  useEffect(() => {
    if (isLiveSpinning) return;

    if (drawMode === "duck_race") {
      if (liveSpin?.status === "landed") {
        return;
      }
      let active = true;
      const renderIdleDucks = () => {
        if (!active || isLiveSpinning || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          draw3DIdleDucks(ctx, canvasRef.current.width, canvasRef.current.height, displayEntrants);
        }
        idleDuckFrameRef.current = requestAnimationFrame(renderIdleDucks);
      };
      renderIdleDucks();
      return () => {
        active = false;
        if (idleDuckFrameRef.current) {
          cancelAnimationFrame(idleDuckFrameRef.current);
          idleDuckFrameRef.current = null;
        }
      };
    } else {
      if (idleDuckFrameRef.current) {
        cancelAnimationFrame(idleDuckFrameRef.current);
        idleDuckFrameRef.current = null;
      }
      if (liveSpin?.shuffledAt && liveSpin.shuffledAt !== lastShuffledAtRef.current) {
        lastShuffledAtRef.current = liveSpin.shuffledAt;
        playTickSound();
        rotationRef.current = rotationRef.current + (2 * Math.PI) / Math.max(1, displayEntrants.length);
      }
      drawWheel(rotationRef.current);
    }
  }, [displayEntrants, liveSpin?.shuffledAt, isLiveSpinning, drawMode, liveSpin?.status]);

  // Synchronized Draw Animation (3D Duck Race or 3D Wheel)
  useEffect(() => {
    if (!liveSpin || liveSpin.status !== "spinning") {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (drawMode === "duck_race") {
      const raceDuration = liveSpin.durationMs || 8000;
      const raceState = init3DDuckRace(
        displayEntrants.map((e) => ({ id: e.id, fullName: e.fullName })),
        liveSpin.winnerId,
        liveSpin.winnerName,
        raceDuration,
        canvas.height
      );
      if (liveSpin.startedAt) {
        raceState.startedAt = liveSpin.startedAt;
      }
      duckRaceStateRef.current = raceState;

      const animateRace = () => {
        const curCanvas = canvasRef.current;
        if (!curCanvas) return;
        const curCtx = curCanvas.getContext("2d");
        if (!curCtx) return;

        const res = render3DDuckRace(curCtx, curCanvas.width, curCanvas.height, raceState, !soundEnabled);
        if (!res.isFinished) {
          animationFrameRef.current = requestAnimationFrame(animateRace);
        } else {
          if (liveSpin.winnerName && !liveSpin.isAwarded) {
            setCelebratedWinner({
              name: liveSpin.winnerName,
              prize: liveSpin.prize,
            });
          }
          const spinId = liveSpin.id;
          if (spinId && !celebratedEventsRef.current.has(spinId)) {
            celebratedEventsRef.current.add(spinId);
            playWinFanfare();
            startConfetti();
          }
        }
      };

      animationFrameRef.current = requestAnimationFrame(animateRace);
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }

    // Wheel Animation
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

      // Sound tick & needle deflection physics
      const normalizedCurrent = (pointerAngle - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
      const activeAngle = normalizedCurrent >= 0 ? normalizedCurrent : normalizedCurrent + 2 * Math.PI;
      const currentPassingSlice = Math.floor(activeAngle / sliceAngle) % sliceCount;

      if (currentPassingSlice !== lastTickSliceRef.current) {
        lastTickSliceRef.current = currentPassingSlice;
        playTickSound();
        needleDeflectionRef.current = -0.15;
      } else {
        needleDeflectionRef.current *= 0.82;
      }

      drawWheel(currentRotation, needleDeflectionRef.current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        rotationRef.current = finalRotation;
        drawWheel(finalRotation, 0);

        // Set the current pick only after the wheel finishes landing
        if (liveSpin.winnerName && !liveSpin.isAwarded) {
          setCelebratedWinner({
            name: liveSpin.winnerName,
            prize: liveSpin.prize,
          });
        }
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
  }, [liveSpin?.id, liveSpin?.status, drawMode]);

  // Lock pointer angle when landed in wheel mode
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
  }, [liveSpin?.status, liveSpin?.winningIndex, displayEntrants.length, drawMode]);

  // Clean up confetti animation on unmount
  useEffect(() => {
    return () => {
      if (confettiFrameRef.current) {
        cancelAnimationFrame(confettiFrameRef.current);
        confettiFrameRef.current = null;
      }
    };
  }, []);

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
                {drawMode === "duck_race" ? "🦆 Live 3D Duck Derby" : "🎡 Live Draw Roulette Wheel"}
              </h3>
              <span className={`raffle-wheel-live-badge ${isLiveSpinning ? "active-spin" : ""}`}>
                <span className="raffle-wheel-live-dot" />
                {isLiveSpinning ? (drawMode === "duck_race" ? "DUCK RACE LIVE" : "LIVE DRAWING") : "READY FOR DRAW"}
              </span>
              {isLiveSpinning && spinCountdown > 0 && (
                <span className="raffle-wheel-countdown-badge">
                  ⏱️ {spinCountdown}s
                </span>
              )}
              <button
                type="button"
                className="raffle-wheel-viewers-badge clickable"
                onClick={() => setShowViewersModal(true)}
                title={`${viewerCount} watching live · Click to see spectators & participants`}
              >
                <Eye size={13} style={{ color: "#38bdf8" }} />
                <span>{viewerCount}</span>
              </button>
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

      {/* Wheel / Duck Race Body */}
      <div className="raffle-wheel-body embedded">
        <div className="raffle-wheel-stage">
          {drawMode === "wheel" && <div className="raffle-wheel-pointer" />}
          <canvas
            ref={canvasRef}
            width={drawMode === "duck_race" ? 640 : 480}
            height={drawMode === "duck_race" ? 420 : 480}
            className={drawMode === "duck_race" ? "raffle-duck-race-canvas" : "raffle-wheel-canvas"}
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
                  Organizer is {drawMode === "duck_race" ? "racing ducks" : "spinning the wheel"} live for {liveSpin?.prize || "the giveaway prize"}!
                </span>
              ) : awardedWinners.length > 0 ? (
                <span>
                  <strong style={{ color: "#facc15" }}>{awardedWinners.length} winner(s)</strong> officially awarded. Ready for remaining draws!
                </span>
              ) : (
                <span>
                  {drawMode === "duck_race" ? "Duck derby" : "Wheel"} is live and will automatically animate when the organizer begins a draw.
                </span>
              )}
            </p>
          </div>

          {/* Current Pick Spotlight Card */}
          {isLiveSpinning ? (
            <div className="raffle-wheel-card" style={{ textAlign: "center", padding: "18px 14px", border: "1px solid rgba(250, 204, 21, 0.4)", background: "rgba(15, 23, 42, 0.85)" }}>
              <div className="raffle-wheel-live-badge active-spin" style={{ marginBottom: 8 }}>
                <span className="raffle-wheel-live-dot" />
                {drawMode === "duck_race" ? "3D DUCK DERBY LIVE" : "SPINNING WHEEL LIVE"}
                {spinCountdown > 0 && (
                  <span className="raffle-live-countdown-tag">⏱️ {spinCountdown}s</span>
                )}
              </div>
              <h4 style={{ margin: "4px 0", color: "#facc15", fontSize: 16, fontWeight: 800 }}>
                Drawing Winner for {liveSpin?.prize || "Giveaway Prize"}
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                {drawMode === "duck_race"
                  ? "Ducks are battling and overtaking for 1st place! Finish line approaching!"
                  : "Wheel is spinning at full speed. Landing soon!"}
              </p>
            </div>
          ) : celebratedWinner ? (
            <div className="raffle-wheel-winner-card">
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
            </div>
          ) : (
            <div className="raffle-wheel-card" style={{ textAlign: "center", padding: "20px 14px" }}>
              <Gift size={24} style={{ color: "#facc15", margin: "0 auto 8px" }} />
              <strong style={{ display: "block", color: "#ffffff", fontSize: 14 }}>
                {awardedWinners.length > 0 ? "Ready for Next Draw" : "Giveaway Prizes Ready"}
              </strong>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {awardedWinners.length > 0
                  ? `${awardedWinners.length} winner(s) officially awarded. Wheel will spin automatically when the organizer starts the next draw.`
                  : "Watch the live wheel spin here as winners are drawn by the community organizer."}
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

              <div className="raffle-wheel-awarded-summary-list">
                {awardedWinners.map((winner, idx) => (
                  <div key={winner.id} className="raffle-wheel-awarded-summary-item">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span className="raffle-wheel-awarded-rank">#{idx + 1}</span>
                      <strong className="raffle-wheel-awarded-name" title={winner.fullName}>
                        {winner.fullName}
                      </strong>
                    </div>
                    <span className="raffle-wheel-awarded-prize">
                      {winner.prizeWon}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showViewersModal && (
        <LiveViewersModal
          isOpen={showViewersModal}
          onClose={() => setShowViewersModal(false)}
          viewers={viewersList}
          viewerCount={viewerCount}
        />
      )}
    </div>
  );
}
