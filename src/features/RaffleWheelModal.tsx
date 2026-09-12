"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Trophy,
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  RefreshCw,
  Shuffle,
  Eye,
  CheckCircle,
  Timer,
  Clock,
  UserCheck,
  Gift,
} from "lucide-react";
import { type RafflePrizeItem, normalizePrizeItems } from "@/types";
import { LiveViewersModal } from "./LiveViewersModal";
import type { LiveViewerInfo } from "./useRafflePresence";
import { render3DRealisticWheel } from "./wheelRenderer3D";
import {
  init3DDuckRace,
  render3DDuckRace,
  draw3DIdleDucks,
  draw3DFinishDucks,
  playDuckStartHorn,
  playDuckFinishCelebration,
  playDuckQuackSound,
  playDuckPaddleSound,
  type DuckRaceState,
} from "./duckRaceCanvas3D";

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
  initialDrawMode?: "wheel" | "duck_race";
  onAssignWinner: (entryId: string, prizeWon: string) => Promise<boolean | void>;
  onRefresh?: () => Promise<void>;
}

export function RaffleWheelModal({
  isOpen,
  onClose,
  entries,
  prizes,
  defaultPrize,
  initialDrawMode,
  onAssignWinner,
  onRefresh,
}: RaffleWheelModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [drawMode, setDrawMode] = useState<"wheel" | "duck_race">(initialDrawMode || "duck_race");
  const duckRaceStateRef = useRef<DuckRaceState | null>(null);
  const idleDuckFrameRef = useRef<number | null>(null);
  const raceFrameRef = useRef<number | null>(null);
  const wheelFrameRef = useRef<number | null>(null);
  const winnerCelebrationFrameRef = useRef<number | null>(null);
  const lastCountdownSecRef = useRef<number>(-1);
  const [liveCountdown, setLiveCountdown] = useState<number>(0);

  const handleModeChange = (newMode: "wheel" | "duck_race") => {
    if (isSpinning || newMode === drawMode) return;
    setDrawMode(newMode);
    if (newMode === "duck_race") {
      playDuckPaddleSound(!soundEnabled);
      playDuckQuackSound(!soundEnabled, 450, 0.3);
    } else {
      playTickSound();
    }
    void fetch("/api/raffle/live-spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_mode",
        drawMode: newMode,
      }),
    }).catch(() => {});
  };

  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filterUnassigned, setFilterUnassigned] = useState(true);
  const [excludedEntryIds, setExcludedEntryIds] = useState<Set<string>>(new Set());
  const [isSpinning, setIsSpinning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [winner, setWinner] = useState<RaffleWheelEntry | null>(null);
  const [selectedPrize, setSelectedPrize] = useState<string>(defaultPrize || "");
  const [awarding, setAwarding] = useState(false);
  const [awardedSuccess, setAwardedSuccess] = useState(false);
  const [spinDurationSeconds, setSpinDurationSeconds] = useState<number>(8);
  const [claimDurationSeconds, setClaimDurationSeconds] = useState<number>(60);
  const [claimDeadline, setClaimDeadline] = useState<number | null>(null);
  const [claimRemaining, setClaimRemaining] = useState<number>(60);
  const [liveViewers, setLiveViewers] = useState<number>(0);
  const [viewersList, setViewersList] = useState<LiveViewerInfo[]>([]);
  const [showViewersModal, setShowViewersModal] = useState(false);

  // Poll genuine live viewers while wheel modal is open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchViewers = async () => {
      try {
        const res = await fetch("/api/raffle/viewers");
        if (res.ok && isMounted) {
          const data = await res.json();
          if (typeof data.viewerCount === "number") {
            setLiveViewers(data.viewerCount);
          }
          if (Array.isArray(data.viewers)) {
            setViewersList(data.viewers);
          }
        }
      } catch {}
    };
    void fetchViewers();
    const interval = setInterval(fetchViewers, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  // Wheel physics state
  const rotationRef = useRef<number>(0);
  const lastTickSliceRef = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const confettiFrameRef = useRef<number | null>(null);
  const isFanfarePlayingRef = useRef<boolean>(false);

  // Filter entrants: exclude already awarded winners AND excluded/repicked candidates
  const normalizedPrizes = normalizePrizeItems(prizes);
  const rawEligible = filterUnassigned
    ? entries.filter((e) => !e.prizeWon && !excludedEntryIds.has(e.id))
    : entries.filter((e) => !excludedEntryIds.has(e.id));

  // If shuffledIds exists, preserve real-time shuffled ordering
  const eligibleEntrants = useMemo(() => {
    if (!shuffledIds) return rawEligible;
    const map = new Map(rawEligible.map((e) => [e.id, e]));
    const ordered: RaffleWheelEntry[] = [];
    for (const id of shuffledIds) {
      const entrant = map.get(id);
      if (entrant) {
        ordered.push(entrant);
        map.delete(id);
      }
    }
    for (const remaining of map.values()) {
      ordered.push(remaining);
    }
    return ordered;
  }, [rawEligible, shuffledIds]);

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

  // Draw the 3D Realistic Roulette Wheel on Canvas
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
      eligibleEntrants,
      needleDeflection
    );
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

  // Real-time shuffle participants order and broadcast
  const handleShuffle = async () => {
    if (isSpinning || isShuffling || eligibleEntrants.length === 0) return;
    setIsShuffling(true);

    if (drawMode === "duck_race") {
      playDuckPaddleSound(!soundEnabled);
      playDuckQuackSound(!soundEnabled, 430, 0.28);
    } else {
      playTickSound();
    }

    const shuffled = [...eligibleEntrants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const newIds = shuffled.map((e) => e.id);
    setShuffledIds(newIds);

    // Audio feedback ticks and visual wheel spin nudge
    if (drawMode === "wheel") {
      rotationRef.current = rotationRef.current + (2 * Math.PI) / Math.max(1, shuffled.length);
      drawWheel(rotationRef.current);
      setTimeout(playTickSound, 90);
      setTimeout(playTickSound, 190);
    } else {
      setTimeout(() => {
        playDuckPaddleSound(!soundEnabled);
      }, 120);
    }

    // Broadcast shuffle in real-time to viewers
    try {
      await fetch("/api/raffle/live-spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "shuffle",
          entrants: shuffled.map((e) => ({ id: e.id, fullName: e.fullName })),
          excludedIds: Array.from(excludedEntryIds),
        }),
      });
    } catch {}

    setTimeout(() => setIsShuffling(false), 350);
  };

  // 3D Duck Race Simulation
  const startDuckRace = (
    activeExcluded: Set<string>,
    currentEligible: RaffleWheelEntry[],
    targetPrize: string
  ) => {
    if (raceFrameRef.current) {
      cancelAnimationFrame(raceFrameRef.current);
      raceFrameRef.current = null;
    }
    if (wheelFrameRef.current) {
      cancelAnimationFrame(wheelFrameRef.current);
      wheelFrameRef.current = null;
    }
    if (idleDuckFrameRef.current) {
      cancelAnimationFrame(idleDuckFrameRef.current);
      idleDuckFrameRef.current = null;
    }
    if (winnerCelebrationFrameRef.current) {
      cancelAnimationFrame(winnerCelebrationFrameRef.current);
      winnerCelebrationFrameRef.current = null;
    }

    const winningIndex = Math.floor(Math.random() * currentEligible.length);
    const selectedWinner = currentEligible[winningIndex];
    const durationMs = Math.max(3, Math.min(30, spinDurationSeconds)) * 1000;
    const initialCountdown = Math.ceil(durationMs / 1000);
    lastCountdownSecRef.current = initialCountdown;
    setLiveCountdown(initialCountdown);
    playDuckStartHorn(!soundEnabled);

    void fetch("/api/raffle/live-spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        drawMode: "duck_race",
        prize: targetPrize,
        winnerId: selectedWinner.id,
        winnerName: selectedWinner.fullName,
        winningIndex,
        startedAt: Date.now(),
        durationMs,
        sliceCount: currentEligible.length,
        entrants: currentEligible.map((e) => ({ id: e.id, fullName: e.fullName })),
        excludedIds: Array.from(activeExcluded),
      }),
    }).catch(() => {});

    const canvas = canvasRef.current;
    if (!canvas) {
      setIsSpinning(false);
      return;
    }
    const raceState = init3DDuckRace(
      currentEligible.map((e) => ({ id: e.id, fullName: e.fullName })),
      selectedWinner.id,
      selectedWinner.fullName,
      durationMs,
      canvas.height
    );
    duckRaceStateRef.current = raceState;

    const animateRace = () => {
      const curCanvas = canvasRef.current;
      if (!curCanvas) return;
      const curCtx = curCanvas.getContext("2d");
      if (!curCtx) return;

      const res = render3DDuckRace(
        curCtx,
        curCanvas.width,
        curCanvas.height,
        raceState,
        !soundEnabled
      );

      const remainingSec = Math.max(0, Math.ceil((raceState.startedAt + durationMs - Date.now()) / 1000));
      if (lastCountdownSecRef.current !== remainingSec) {
        lastCountdownSecRef.current = remainingSec;
        setLiveCountdown(remainingSec);
      }

      if (!res.isFinished) {
        raceFrameRef.current = requestAnimationFrame(animateRace);
      } else {
        raceFrameRef.current = null;
        setIsSpinning(false);
        setWinner(selectedWinner);
        const deadline = Date.now() + claimDurationSeconds * 1000;
        setClaimDeadline(deadline);
        setClaimRemaining(claimDurationSeconds);
        playDuckFinishCelebration(!soundEnabled);
        startConfetti();

        void fetch("/api/raffle/live-spin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "landed",
            drawMode: "duck_race",
            prize: targetPrize,
            winnerId: selectedWinner.id,
            winnerName: selectedWinner.fullName,
            winningIndex,
            claimSeconds: claimDurationSeconds,
            claimDeadline: deadline,
            entrants: currentEligible.map((e) => ({ id: e.id, fullName: e.fullName })),
            excludedIds: Array.from(activeExcluded),
          }),
        }).catch(() => {});
      }
    };

    raceFrameRef.current = requestAnimationFrame(animateRace);
  };

  // Trigger wheel spin or 3D duck race animation
  const spinWheel = (overrideExcluded?: Set<string>) => {
    const activeExcluded = overrideExcluded || excludedEntryIds;
    const currentEligible = filterUnassigned
      ? entries.filter((e) => !e.prizeWon && !activeExcluded.has(e.id))
      : entries.filter((e) => !activeExcluded.has(e.id));

    if (isSpinning || currentEligible.length === 0) return;
    getAudioContext();

    setIsSpinning(true);
    setWinner(null);
    setClaimDeadline(null);
    setAwardedSuccess(false);

    if (drawMode === "duck_race") {
      return startDuckRace(activeExcluded, currentEligible, selectedPrize);
    }

    if (wheelFrameRef.current) {
      cancelAnimationFrame(wheelFrameRef.current);
      wheelFrameRef.current = null;
    }
    if (raceFrameRef.current) {
      cancelAnimationFrame(raceFrameRef.current);
      raceFrameRef.current = null;
    }
    if (idleDuckFrameRef.current) {
      cancelAnimationFrame(idleDuckFrameRef.current);
      idleDuckFrameRef.current = null;
    }
    if (winnerCelebrationFrameRef.current) {
      cancelAnimationFrame(winnerCelebrationFrameRef.current);
      winnerCelebrationFrameRef.current = null;
    }

    const sliceCount = currentEligible.length;
    const sliceAngle = (2 * Math.PI) / sliceCount;

    // Pick random winning index
    const winningIndex = Math.floor(Math.random() * sliceCount);
    const selectedWinner = currentEligible[winningIndex];
    const spinDuration = Math.max(2, Math.min(30, spinDurationSeconds)) * 1000;
    const initialCountdown = Math.ceil(spinDuration / 1000);
    lastCountdownSecRef.current = initialCountdown;
    setLiveCountdown(initialCountdown);

    // Broadcast live spin with exact slices to public /raffle viewers in real-time!
    void fetch("/api/raffle/live-spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        drawMode: "wheel",
        prize: selectedPrize,
        winnerId: selectedWinner.id,
        winnerName: selectedWinner.fullName,
        winningIndex,
        startedAt: Date.now(),
        durationMs: spinDuration,
        sliceCount,
        entrants: currentEligible.map((e) => ({ id: e.id, fullName: e.fullName })),
        excludedIds: Array.from(activeExcluded),
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

      const remainingSec = Math.max(0, Math.ceil((spinDuration - elapsed) / 1000));
      if (lastCountdownSecRef.current !== remainingSec) {
        lastCountdownSecRef.current = remainingSec;
        setLiveCountdown(remainingSec);
      }

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
        wheelFrameRef.current = requestAnimationFrame(animate);
      } else {
        wheelFrameRef.current = null;
        rotationRef.current = finalRotation;
        drawWheel(finalRotation, 0);
        setIsSpinning(false);
        setWinner(selectedWinner);
        const deadline = Date.now() + claimDurationSeconds * 1000;
        setClaimDeadline(deadline);
        setClaimRemaining(claimDurationSeconds);
        playWinFanfare();
        startConfetti();

        // Broadcast landed state to public viewers with synchronized claim timer and winner info
        void fetch("/api/raffle/live-spin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "landed",
            drawMode: "wheel",
            prize: selectedPrize,
            winnerId: selectedWinner.id,
            winnerName: selectedWinner.fullName,
            winningIndex,
            claimSeconds: claimDurationSeconds,
            claimDeadline: deadline,
            entrants: currentEligible.map((e) => ({ id: e.id, fullName: e.fullName })),
            excludedIds: Array.from(activeExcluded),
          }),
        }).catch(() => {});
      }
    };

    wheelFrameRef.current = requestAnimationFrame(animate);
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
    const repickedWinner = winner;
    const nextExcluded = new Set(excludedEntryIds);
    if (repickedWinner) {
      nextExcluded.add(repickedWinner.id);
      setExcludedEntryIds(nextExcluded);
    }
    setWinner(null);
    setClaimDeadline(null);
    setAwardedSuccess(false);

    const remainingEntrants = entries
      .filter((e) => !e.prizeWon && !nextExcluded.has(e.id))
      .map((e) => ({ id: e.id, fullName: e.fullName }));

    void fetch("/api/raffle/live-spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "repick",
        drawMode,
        excludedId: repickedWinner?.id,
        excludedIds: Array.from(nextExcluded),
        entrants: remainingEntrants,
      }),
    }).catch(() => {});

    setTimeout(() => {
      spinWheel(nextExcluded);
    }, 200);
  };

  // Reset state and sync mode on initial open only
  useEffect(() => {
    if (!isOpen) return;
    setWinner(null);
    setClaimDeadline(null);
    setAwardedSuccess(false);

    if (initialDrawMode) {
      setDrawMode(initialDrawMode);
      void fetch("/api/raffle/live-spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_mode",
          drawMode: initialDrawMode,
        }),
      }).catch(() => {});
      return;
    }

    // Sync active draw mode from server
    void fetch("/api/raffle/live-spin")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.drawMode === "duck_race" || data?.drawMode === "wheel") {
          setDrawMode(data.drawMode);
        }
      })
      .catch(() => {});
  }, [isOpen, initialDrawMode]);

  // Draw initial state & idle animation (NO reset of winner!)
  useEffect(() => {
    if (!isOpen) return;

    if (drawMode === "wheel") {
      if (idleDuckFrameRef.current) {
        cancelAnimationFrame(idleDuckFrameRef.current);
        idleDuckFrameRef.current = null;
      }
      if (!isSpinning && !winner) {
        drawWheel(rotationRef.current);
      }
      return;
    }

    // Duck Race mode:
    // Only bob at starting gate when NOT spinning and NO winner is awaiting attendance check
    if (isSpinning || winner) {
      if (idleDuckFrameRef.current) {
        cancelAnimationFrame(idleDuckFrameRef.current);
        idleDuckFrameRef.current = null;
      }
      return;
    }

    let active = true;
    const renderIdleDucks = () => {
      if (!active || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        draw3DIdleDucks(ctx, canvasRef.current.width, canvasRef.current.height, eligibleEntrants);
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
  }, [isOpen, drawMode, isSpinning, Boolean(winner), eligibleEntrants]);

  // Duck Race Winner Celebration Animation Loop (shows champion duck while attendance check is ongoing)
  useEffect(() => {
    if (!isOpen || !winner || isSpinning || drawMode !== "duck_race") {
      if (winnerCelebrationFrameRef.current) {
        cancelAnimationFrame(winnerCelebrationFrameRef.current);
        winnerCelebrationFrameRef.current = null;
      }
      return;
    }

    let active = true;
    const renderWinner = () => {
      if (!active || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        draw3DFinishDucks(
          ctx,
          canvasRef.current.width,
          canvasRef.current.height,
          winner.fullName,
          selectedPrize
        );
      }
      winnerCelebrationFrameRef.current = requestAnimationFrame(renderWinner);
    };

    renderWinner();

    return () => {
      active = false;
      if (winnerCelebrationFrameRef.current) {
        cancelAnimationFrame(winnerCelebrationFrameRef.current);
        winnerCelebrationFrameRef.current = null;
      }
    };
  }, [isOpen, winner, isSpinning, drawMode, selectedPrize]);

  // Redraw wheel when eligible entrants change in wheel mode (when idle)
  useEffect(() => {
    if (isOpen && !isSpinning && !winner && drawMode === "wheel") {
      drawWheel(rotationRef.current);
    }
  }, [isOpen, eligibleEntrants, isSpinning, Boolean(winner), drawMode]);

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
    const currentWinner = winner;
    setAwarding(true);
    try {
      await onAssignWinner(currentWinner.id, selectedPrize);
      setAwardedSuccess(true);
      const remainingEntrants = entries
        .filter((e) => e.id !== currentWinner.id && !e.prizeWon && !excludedEntryIds.has(e.id))
        .map((e) => ({ id: e.id, fullName: e.fullName }));

      void fetch("/api/raffle/live-spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "awarded",
          winnerId: currentWinner.id,
          winnerName: currentWinner.fullName,
          prize: selectedPrize,
          entrants: remainingEntrants,
          excludedIds: Array.from(excludedEntryIds),
        }),
      }).catch(() => {});

      if (onRefresh) {
        await onRefresh();
      }

      // Automatically reset attendance card after 1.8 seconds so old winner never lingers
      setTimeout(() => {
        setWinner(null);
        setClaimDeadline(null);
        setAwardedSuccess(false);
      }, 1800);
    } finally {
      setAwarding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ch-modal-backdrop" onClick={() => !isSpinning && onClose()}>
      <div
        className={`raffle-wheel-modal ${drawMode === "duck_race" ? "duck-mode" : ""}`}
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3>Interactive Live Draw</h3>

                <span className="raffle-wheel-live-badge">
                  <span className="raffle-wheel-live-dot" /> LIVE SYNC
                </span>
                <button
                  type="button"
                  className="raffle-wheel-viewers-badge clickable"
                  onClick={() => setShowViewersModal(true)}
                  title={`${liveViewers} watching live · Click to see spectators & participants`}
                >
                  <Eye size={13} style={{ color: "#38bdf8" }} />
                  <span>{liveViewers}</span>
                </button>
              </div>
              <small>
                {eligibleEntrants.length} eligible participants · Livestream ready
              </small>
            </div>
          </div>

          <div className="raffle-wheel-header-actions">
            {/* Draw Mode Switcher */}
            <div className="raffle-draw-mode-toggle">
              <button
                type="button"
                className={`raffle-draw-mode-btn ${drawMode === "wheel" ? "active" : ""}`}
                onClick={() => handleModeChange("wheel")}
                disabled={isSpinning}
              >
                🎡 3D Wheel
              </button>
              <button
                type="button"
                className={`raffle-draw-mode-btn duck-mode ${drawMode === "duck_race" ? "active" : ""}`}
                onClick={() => handleModeChange("duck_race")}
                disabled={isSpinning}
              >
                🦆 3D Duck Race
              </button>
            </div>

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

        {/* Wheel / Duck Race Body */}
        <div className="raffle-wheel-body">
          {/* Stage */}
          <div className="raffle-wheel-stage">
            {/* Top Pointer Ticker Needle for Wheel */}
            {drawMode === "wheel" && <div className="raffle-wheel-pointer" />}

            {/* Canvas Wheel or Duck Race */}
            <canvas
              ref={canvasRef}
              width={drawMode === "duck_race" ? 640 : 480}
              height={drawMode === "duck_race" ? 420 : 480}
              className={drawMode === "duck_race" ? "raffle-duck-race-canvas" : "raffle-wheel-canvas"}
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

            {/* Customize Spin / Race Timer / Duration */}
            <div className="raffle-wheel-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label className="raffle-wheel-label" style={{ margin: 0 }}>
                  <Timer size={14} style={{ color: "#38bdf8" }} />
                  <span>{drawMode === "duck_race" ? "Race Duration" : "Spin Duration"}</span>
                </label>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#38bdf8" }}>
                  {spinDurationSeconds}s
                </span>
              </div>

              <div className="raffle-wheel-timer-presets">
                {[5, 8, 10, 15, 20].map((sec) => (
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
                  min={4}
                  max={30}
                  step={1}
                  value={spinDurationSeconds}
                  onChange={(e) => setSpinDurationSeconds(Number(e.target.value))}
                  disabled={isSpinning}
                  style={{ flex: 1, accentColor: "#38bdf8", cursor: "pointer" }}
                />
                <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {spinDurationSeconds <= 6 ? "Fast" : spinDurationSeconds <= 12 ? "Balanced" : "Dramatic"}
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
                {[15, 30, 60, 90, 120].map((sec) => (
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

            {/* Draw Actions: Shuffle & Spin / Duck Race */}
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <button
                type="button"
                className={`raffle-wheel-shuffle-btn ${isShuffling ? "is-shuffling" : ""}`}
                onClick={handleShuffle}
                disabled={isSpinning || isShuffling || eligibleEntrants.length === 0}
                title="Realtime shuffle participants order on the wheel"
              >
                <Shuffle size={15} />
                <span>{isShuffling ? "Shuffling…" : "Shuffle"}</span>
              </button>

              <button
                type="button"
                className={`raffle-wheel-spin-btn ${drawMode === "duck_race" ? "duck-race" : ""}`}
                style={{ flex: 1 }}
                onClick={() => spinWheel()}
                disabled={isSpinning || eligibleEntrants.length === 0}
              >
                <Sparkles size={18} className={isSpinning ? "busy-spinner" : ""} />
                <span>
                  {drawMode === "duck_race"
                    ? isSpinning
                      ? `🦆 Racing... (${liveCountdown}s)`
                      : `🦆 Start 3D Duck Race (${spinDurationSeconds}s)`
                    : isSpinning
                      ? `🎡 Spinning... (${liveCountdown}s)`
                      : `🎡 Spin 3D Wheel (${spinDurationSeconds}s)`}
                </span>
              </button>
            </div>

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
                        if (drawMode === "wheel") {
                          drawWheel(rotationRef.current);
                        }
                        void fetch("/api/raffle/live-spin", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "reset" }),
                        }).catch(() => {});
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

      {showViewersModal && (
        <LiveViewersModal
          isOpen={showViewersModal}
          onClose={() => setShowViewersModal(false)}
          viewers={viewersList}
          viewerCount={liveViewers}
        />
      )}
    </div>
  );
}
