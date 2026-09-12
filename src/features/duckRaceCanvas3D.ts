// ============================================================================
// 3D REALISTIC DUCK RACE CANVAS ENGINE
// - Perspective flowing water river with animated waves, caustics, and foam
// - 3D shaded swimming ducks with realistic bobbing, waddling tilt, and wake trails
// - "Nakikipag-unahan" dynamic overtaking, slipstreaming & lead-swapping physics
// - Deterministic victory pacing (winner crosses finish line tape at durationMs)
// - Floating 3D name badges and top-3 leader HUD
// ============================================================================

export interface DuckEntrant {
  id: string;
  fullName: string;
}

export interface DuckRaceState {
  entrants: DuckEntrant[];
  winnerId: string;
  winnerName: string;
  durationMs: number;
  startedAt: number;
  isFinished: boolean;
  ducks: DuckSim[];
}

export interface DuckSim {
  id: string;
  name: string;
  isWinner: boolean;
  x: number; // 0 to trackWidth
  laneY: number; // target horizontal lane
  actualY: number; // current interpolated Y
  speed: number;
  baseSpeed: number;
  surge: number;
  surgeDuration: number;
  wobblePhase: number;
  bobFreq: number;
  color: DuckColorPalette;
  rank: number;
  wakes: WakeParticle[];
  splashes: SplashParticle[];
}

export interface DuckColorPalette {
  body: string;
  bodyHighlight: string;
  bodyShadow: string;
  head: string;
  bill: string;
  billShadow: string;
  badgeBg: string;
}

interface WakeParticle {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  vx: number;
}

interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

// Curated 3D Duck Color Palettes
const DUCK_PALETTES: DuckColorPalette[] = [
  // Classic Canary Gold
  {
    body: "#facc15",
    bodyHighlight: "#fef08a",
    bodyShadow: "#ca8a04",
    head: "#eab308",
    bill: "#f97316",
    billShadow: "#c2410c",
    badgeBg: "rgba(234, 179, 8, 0.9)",
  },
  // Tangerine Sunshine
  {
    body: "#fb923c",
    bodyHighlight: "#fed7aa",
    bodyShadow: "#ea580c",
    head: "#f97316",
    bill: "#ef4444",
    billShadow: "#b91c1c",
    badgeBg: "rgba(249, 115, 22, 0.9)",
  },
  // Emerald Teal
  {
    body: "#2dd4bf",
    bodyHighlight: "#99f6e4",
    bodyShadow: "#0d9488",
    head: "#14b8a6",
    bill: "#f59e0b",
    billShadow: "#b45309",
    badgeBg: "rgba(20, 184, 166, 0.9)",
  },
  // Royal Amethyst
  {
    body: "#c084fc",
    bodyHighlight: "#f3e8ff",
    bodyShadow: "#9333ea",
    head: "#a855f7",
    bill: "#fb923c",
    billShadow: "#c2410c",
    badgeBg: "rgba(168, 85, 247, 0.9)",
  },
  // Ruby Rose
  {
    body: "#fb7185",
    bodyHighlight: "#ffe4e6",
    bodyShadow: "#e11d48",
    head: "#f43f5e",
    bill: "#facc15",
    billShadow: "#ca8a04",
    badgeBg: "rgba(244, 63, 94, 0.9)",
  },
  // Sapphire Sky
  {
    body: "#38bdf8",
    bodyHighlight: "#bae6fd",
    bodyShadow: "#0284c7",
    head: "#0ea5e9",
    bill: "#f97316",
    billShadow: "#c2410c",
    badgeBg: "rgba(14, 165, 233, 0.9)",
  },
];

// Audio Context Singleton for sound effects
let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playDuckPaddleSound(isMuted = false): void {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(140 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {}
}

export function playDuckFinishSound(isMuted = false): void {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [440, 554.37, 659.25, 880];
    const now = ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = now + idx * 0.08;
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  } catch {}
}

/**
 * Initialize a 3D Duck Race Simulation State
 */
export function init3DDuckRace(
  entrants: DuckEntrant[],
  winnerId: string,
  winnerName: string,
  durationMs = 8000,
  canvasHeight = 400
): DuckRaceState {
  const riverTop = 75;
  const riverBottom = canvasHeight - 55;
  const riverHeight = riverBottom - riverTop;
  const duckCount = Math.max(1, entrants.length);
  const laneSpacing = riverHeight / (duckCount + 1);

  const ducks: DuckSim[] = entrants.map((entrant, idx) => {
    const isWinner = entrant.id === winnerId;
    const laneY = riverTop + laneSpacing * (idx + 1);
    return {
      id: entrant.id,
      name: entrant.fullName,
      isWinner,
      x: 35 + Math.random() * 15,
      laneY,
      actualY: laneY,
      speed: 0.8 + Math.random() * 0.4,
      baseSpeed: 1.0,
      surge: 0,
      surgeDuration: 0,
      wobblePhase: Math.random() * Math.PI * 2,
      bobFreq: 3.5 + Math.random() * 1.2,
      color: DUCK_PALETTES[idx % DUCK_PALETTES.length],
      rank: idx + 1,
      wakes: [],
      splashes: [],
    };
  });

  return {
    entrants,
    winnerId,
    winnerName,
    durationMs,
    startedAt: Date.now(),
    isFinished: false,
    ducks,
  };
}

/**
 * Step the simulation and draw the 3D Duck Race frame
 */
export function render3DDuckRace(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: DuckRaceState,
  isMuted = false
): { isFinished: boolean; winnerName: string; top3: { name: string; rank: number }[] } {
  const now = Date.now();
  const elapsed = Math.max(0, now - state.startedAt);
  const rawProgress = Math.min(1.0, elapsed / state.durationMs);

  const riverTop = 75;
  const riverBottom = height - 55;
  const finishLineX = width - 90;
  const startX = 50;
  const trackLength = finishLineX - startX;

  // -------------------------------------------------------------
  // 1. DRAW 3D PERSPECTIVE RIVER & WATER ENVIRONMENT
  // -------------------------------------------------------------
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Distant river bank (top grass/wood deck)
  const topBankGrad = ctx.createLinearGradient(0, 0, 0, riverTop);
  topBankGrad.addColorStop(0, "#064e3b");
  topBankGrad.addColorStop(0.6, "#047857");
  topBankGrad.addColorStop(1, "#1e293b");
  ctx.fillStyle = topBankGrad;
  ctx.fillRect(0, 0, width, riverTop);

  // Top wooden dock pier planks
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  for (let px = 0; px < width; px += 28) {
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, riverTop - 4);
    ctx.stroke();
  }
  // Dock edge highlight
  ctx.fillStyle = "#64748b";
  ctx.fillRect(0, riverTop - 4, width, 4);

  // Flowing 3D Water Base (Deep Teal to Radiant Cyan)
  const waterGrad = ctx.createLinearGradient(0, riverTop, 0, riverBottom);
  waterGrad.addColorStop(0, "#0369a1");
  waterGrad.addColorStop(0.35, "#0284c7");
  waterGrad.addColorStop(0.7, "#0ea5e9");
  waterGrad.addColorStop(1, "#075985");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, riverTop, width, riverBottom - riverTop);

  // Animated Flowing Water Waves & Caustics
  const waveTime = now * 0.003;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  for (let wy = riverTop + 15; wy < riverBottom - 10; wy += 22) {
    ctx.beginPath();
    const waveOffset = wy * 0.4;
    for (let wx = 0; wx <= width; wx += 20) {
      const dy = Math.sin(wx * 0.02 + waveTime + waveOffset) * 2.8;
      if (wx === 0) ctx.moveTo(wx, wy + dy);
      else ctx.lineTo(wx, wy + dy);
    }
    ctx.stroke();
  }

  // Sunlight shimmer caustic ripples on water surface
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  for (let i = 0; i < 8; i++) {
    const sx = ((now * 0.04 + i * 90) % (width + 100)) - 50;
    const sy = riverTop + 20 + ((i * 37) % (riverBottom - riverTop - 40));
    ctx.beginPath();
    ctx.ellipse(sx, sy, 30, 4, -0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // Floating lane divider lines (soft buoy ropes)
  const duckCount = state.ducks.length;
  const laneSpacing = (riverBottom - riverTop) / (duckCount + 1);
  ctx.setLineDash([6, 12]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= duckCount; i++) {
    const ly = riverTop + laneSpacing * i;
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(width, ly);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Bottom River Bank (Foreground wooden barrier & stones)
  const botBankGrad = ctx.createLinearGradient(0, riverBottom, 0, height);
  botBankGrad.addColorStop(0, "#0f172a");
  botBankGrad.addColorStop(0.3, "#1e293b");
  botBankGrad.addColorStop(1, "#020617");
  ctx.fillStyle = botBankGrad;
  ctx.fillRect(0, riverBottom, width, height - riverBottom);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(0, riverBottom, width, 2); // water shoreline reflection rim

  // -------------------------------------------------------------
  // 2. CHECKERED 3D FINISH LINE
  // -------------------------------------------------------------
  const flTop = riverTop;
  const flBottom = riverBottom;
  const ribbonWidth = 14;

  // Floating red & white buoys at top and bottom of finish line
  draw3DBuoy(ctx, finishLineX + ribbonWidth / 2, flTop - 4);
  draw3DBuoy(ctx, finishLineX + ribbonWidth / 2, flBottom + 4);

  // Checkered ribbon
  const sqSize = 7;
  for (let y = flTop; y < flBottom; y += sqSize) {
    for (let x = finishLineX; x < finishLineX + ribbonWidth; x += sqSize) {
      const isBlack = ((Math.floor(x / sqSize) + Math.floor(y / sqSize)) % 2) === 0;
      ctx.fillStyle = isBlack ? "#0f172a" : "#ffffff";
      ctx.fillRect(x, y, sqSize, sqSize);
    }
  }

  // Finish banner text
  ctx.save();
  ctx.translate(finishLineX + ribbonWidth + 12, flTop + (flBottom - flTop) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = "900 11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.textAlign = "center";
  ctx.letterSpacing = "2px";
  ctx.fillText("FINISH LINE", 0, 0);
  ctx.restore();

  // -------------------------------------------------------------
  // 3. DYNAMIC OVERTAKING & RACING SIMULATION PHYSICS
  // -------------------------------------------------------------
  const winnerDuck = state.ducks.find((d) => d.isWinner);

  // Update position and simulate "nakikipag-unahan"
  state.ducks.forEach((duck, idx) => {
    // Periodic stamina surge bursts
    if (duck.surgeDuration > 0) {
      duck.surgeDuration--;
    } else if (Math.random() < 0.025 && rawProgress < 0.75) {
      duck.surge = 0.4 + Math.random() * 0.7; // sudden speed surge!
      duck.surgeDuration = 25 + Math.floor(Math.random() * 35);
      duck.splashes.push({
        x: duck.x - 12,
        y: duck.actualY,
        vx: -(1 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 2,
        life: 0,
        maxLife: 15,
        size: 2.5 + Math.random() * 2,
      });
      if (idx % 2 === 0) playDuckPaddleSound(isMuted);
    } else {
      duck.surge *= 0.94;
    }

    // Drafting / Slipstreaming: If trailing another duck within 40px, get draft boost and steer out
    const leaderAhead = state.ducks.find(
      (other) => other.id !== duck.id && other.x > duck.x && other.x - duck.x < 45 && Math.abs(other.actualY - duck.actualY) < 20
    );
    if (leaderAhead && rawProgress < 0.8) {
      duck.surge = Math.max(duck.surge, 0.5); // Drafting pull!
      // Steer laterally to overtake
      const steerDirection = duck.actualY > leaderAhead.actualY ? 0.6 : -0.6;
      duck.actualY += steerDirection;
    } else {
      // Gently return to original assigned lane
      duck.actualY += (duck.laneY - duck.actualY) * 0.05;
    }

    // Winner trajectory curve:
    // In early race (0 - 65%), winner stays in top 3 jostling.
    // In late race (65% - 100%), winner surges forward decisively to cross first!
    let targetX: number;
    if (duck.isWinner) {
      if (rawProgress < 0.65) {
        // Jostling in 2nd or 3rd place with random fluctuations
        const earlyCurve = Math.pow(rawProgress / 0.65, 1.2);
        targetX = startX + earlyCurve * (trackLength * 0.58) + Math.sin(now * 0.005 + idx) * 10;
      } else {
        // Dramatic finishing sprint ("Huling Hirit")
        const finishSprintProgress = (rawProgress - 0.65) / 0.35;
        // Ease out quadratic sprint
        const sprintEase = 1 - Math.pow(1 - finishSprintProgress, 2.2);
        targetX = startX + (trackLength * 0.58) + sprintEase * (trackLength * 0.42 + 25);
      }
    } else {
      // Non-winners
      if (rawProgress < 0.65) {
        // May lead or surge ahead in early/mid race to create suspense!
        const excitementBonus = Math.sin(duck.wobblePhase + now * 0.003) * 20;
        const curve = Math.pow(rawProgress / 0.65, 0.95);
        targetX = startX + curve * (trackLength * 0.62) + excitementBonus + duck.surge * 15;
      } else {
        // Slow down slightly in final sprint behind the winner
        const finishProgress = (rawProgress - 0.65) / 0.35;
        const maxNonWinnerX = finishLineX - 12 - (idx + 1) * 8;
        const currentBase = startX + trackLength * 0.62;
        targetX = currentBase + (maxNonWinnerX - currentBase) * Math.min(1.0, finishProgress * 0.92);
      }
    }

    // Smooth interpolation for natural momentum
    duck.x += (targetX - duck.x) * 0.12;

    // Emit wake bubbles while moving
    if (duck.x > startX + 10 && Math.random() < 0.6) {
      duck.wakes.push({
        x: duck.x - 14,
        y: duck.actualY + (Math.random() - 0.5) * 4,
        radius: 3,
        opacity: 0.7,
        vx: -(0.5 + Math.random() * 0.5),
      });
    }
  });

  // Calculate live ranks (highest X = rank 1)
  const sortedDucks = [...state.ducks].sort((a, b) => b.x - a.x);
  sortedDucks.forEach((d, rIdx) => {
    d.rank = rIdx + 1;
  });

  // -------------------------------------------------------------
  // 4. DRAW WAKE TRAILS & WATER FOAM BUBBLES
  // -------------------------------------------------------------
  state.ducks.forEach((duck) => {
    // V-shaped hydrodynamic wake arms
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(duck.x - 6, duck.actualY);
    ctx.lineTo(duck.x - 38, duck.actualY - 14);
    ctx.moveTo(duck.x - 6, duck.actualY);
    ctx.lineTo(duck.x - 38, duck.actualY + 14);
    ctx.stroke();

    // Wake foam bubbles
    for (let i = duck.wakes.length - 1; i >= 0; i--) {
      const p = duck.wakes[i];
      p.x += p.vx;
      p.radius += 0.25;
      p.opacity -= 0.025;
      if (p.opacity <= 0) {
        duck.wakes.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Water splashes from surges
    for (let i = duck.splashes.length - 1; i >= 0; i--) {
      const sp = duck.splashes[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life++;
      if (sp.life >= sp.maxLife) {
        duck.splashes.splice(i, 1);
        continue;
      }
      const alpha = 1 - sp.life / sp.maxLife;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // -------------------------------------------------------------
  // 5. DRAW 3D REALISTIC SWIMMING DUCKS (Ordered by Y for depth)
  // -------------------------------------------------------------
  const depthOrderedDucks = [...state.ducks].sort((a, b) => a.actualY - b.actualY);

  depthOrderedDucks.forEach((duck) => {
    draw3DRealisticDuck(ctx, duck, now);
  });

  // -------------------------------------------------------------
  // 6. DRAW TOP-3 LEADERBOARD HUD & COUNTDOWN TIMER
  // -------------------------------------------------------------
  drawRaceHUD(ctx, width, rawProgress, state.durationMs, elapsed, sortedDucks);

  // Check finish condition
  const isFinished = rawProgress >= 1.0;
  if (isFinished && !state.isFinished) {
    state.isFinished = true;
    playDuckFinishSound(isMuted);
  }

  ctx.restore();

  return {
    isFinished,
    winnerName: winnerDuck?.name || state.winnerName,
    top3: sortedDucks.slice(0, 3).map((d) => ({ name: d.name, rank: d.rank })),
  };
}

/**
 * Draw a single 3D Realistic Swimming Duck with bobbing, waddling tilt, and name tag
 */
function draw3DRealisticDuck(ctx: CanvasRenderingContext2D, duck: DuckSim, now: number): void {
  const timeSec = now * 0.001;
  // Natural vertical bobbing
  const bobOffset = Math.sin(timeSec * duck.bobFreq + duck.wobblePhase) * 2.8;
  // Waddling roll tilt as feet paddle alternately
  const rollAngle = Math.sin(timeSec * duck.bobFreq * 0.8 + duck.wobblePhase) * 0.08;

  const dx = duck.x;
  const dy = duck.actualY + bobOffset;

  ctx.save();
  ctx.translate(dx, dy);
  ctx.rotate(rollAngle);

  // Submerged Water Shadow (Elliptical depth ring)
  ctx.fillStyle = "rgba(2, 44, 34, 0.4)";
  ctx.beginPath();
  ctx.ellipse(-2, 10, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Water Displacement Chest Ring (Bow Wave)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(14, 5, 8, 4, 0, 0, Math.PI * 2);
  ctx.stroke();

  // -----------------------------------------------------------
  // 3D DUCK TORSO (Egg shape with spherical lighting gradient)
  // -----------------------------------------------------------
  const bodyGrad = ctx.createRadialGradient(-2, -4, 3, 0, 2, 22);
  bodyGrad.addColorStop(0, duck.color.bodyHighlight);
  bodyGrad.addColorStop(0.55, duck.color.body);
  bodyGrad.addColorStop(1, duck.color.bodyShadow);

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 2, 20, 13, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Perky Tail Feathers
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.quadraticCurveTo(-26, -6, -28, -9);
  ctx.quadraticCurveTo(-23, 2, -15, 6);
  ctx.closePath();
  ctx.fillStyle = duck.color.bodyShadow;
  ctx.fill();

  // 3D Wing Contour with feather gradient
  const wingGrad = ctx.createLinearGradient(-10, -5, 8, 6);
  wingGrad.addColorStop(0, duck.color.bodyHighlight);
  wingGrad.addColorStop(1, duck.color.bodyShadow);
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 12, 7, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // -----------------------------------------------------------
  // 3D DUCK HEAD & NECK
  // -----------------------------------------------------------
  // Neck connection
  ctx.fillStyle = duck.color.body;
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.quadraticCurveTo(14, -8, 16, -12);
  ctx.quadraticCurveTo(10, -10, 4, -4);
  ctx.closePath();
  ctx.fill();

  // Head sphere with 3D radial specular highlight
  const headGrad = ctx.createRadialGradient(16, -15, 2, 14, -13, 11);
  headGrad.addColorStop(0, duck.color.bodyHighlight);
  headGrad.addColorStop(0.6, duck.color.head);
  headGrad.addColorStop(1, duck.color.bodyShadow);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(14, -12, 10, 0, Math.PI * 2);
  ctx.fill();

  // -----------------------------------------------------------
  // 3D DUCK BILL (Contoured beak with nostrils)
  // -----------------------------------------------------------
  const billGrad = ctx.createLinearGradient(20, -12, 30, -9);
  billGrad.addColorStop(0, duck.color.bill);
  billGrad.addColorStop(1, duck.color.billShadow);
  ctx.fillStyle = billGrad;
  ctx.beginPath();
  ctx.moveTo(21, -14);
  ctx.quadraticCurveTo(28, -13, 30, -10);
  ctx.quadraticCurveTo(28, -7, 21, -8);
  ctx.closePath();
  ctx.fill();

  // Beak mouth crease
  ctx.strokeStyle = duck.color.billShadow;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(21, -11);
  ctx.lineTo(29, -10);
  ctx.stroke();

  // Nostril pinpoint
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.arc(24, -12, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // -----------------------------------------------------------
  // GLOSSY 3D EYE (Specular pinpoint reflection)
  // -----------------------------------------------------------
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(17, -14, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // White specular pinpoint reflection
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(18, -15, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // Undo duck rotation and translation

  // -----------------------------------------------------------
  // FLOATING 3D PARTICIPANT NAME TAG & RANK BADGE
  // -----------------------------------------------------------
  ctx.save();
  const badgeY = dy - 26;
  const label = duck.name.length > 13 ? duck.name.slice(0, 12) + "…" : duck.name;

  ctx.font = "bold 10px system-ui, sans-serif";
  const nameWidth = ctx.measureText(label).width;
  const totalBadgeW = nameWidth + 24;
  const badgeX = dx - totalBadgeW / 2;

  // Drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  roundRect(ctx, badgeX + 1, badgeY - 7 + 1, totalBadgeW, 16, 8);
  ctx.fill();

  // Badge background (High contrast dark pill with rank color rim)
  ctx.fillStyle = duck.rank === 1 ? "rgba(234, 179, 8, 0.95)" : "rgba(15, 23, 42, 0.9)";
  roundRect(ctx, badgeX, badgeY - 7, totalBadgeW, 16, 8);
  ctx.fill();

  ctx.strokeStyle = duck.rank === 1 ? "#fef08a" : "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Rank badge circle
  const rankColor =
    duck.rank === 1 ? "#713f12" : duck.rank === 2 ? "#e2e8f0" : duck.rank === 3 ? "#fdba74" : "#94a3b8";
  ctx.fillStyle = duck.rank === 1 ? "#ca8a04" : "#334155";
  ctx.beginPath();
  ctx.arc(badgeX + 8, badgeY + 1, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "900 8px system-ui, sans-serif";
  ctx.fillStyle = rankColor;
  ctx.textAlign = "center";
  ctx.fillText(String(duck.rank), badgeX + 8, badgeY + 4);

  // Participant Name text
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.fillStyle = duck.rank === 1 ? "#0f172a" : "#f8fafc";
  ctx.textAlign = "left";
  ctx.fillText(label, badgeX + 18, badgeY + 4);

  ctx.restore();
}

/**
 * Draw 3D Floating Buoy
 */
function draw3DBuoy(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bottom red half
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI);
  ctx.fill();

  // Top white half
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, 9, Math.PI, Math.PI * 2);
  ctx.fill();

  // Center ring
  ctx.fillStyle = "#facc15";
  ctx.fillRect(x - 9, y - 2, 18, 4);

  ctx.restore();
}

/**
 * Draw Top Race HUD: Live Countdown & Leaderboard
 */
function drawRaceHUD(
  ctx: CanvasRenderingContext2D,
  width: number,
  progress: number,
  durationMs: number,
  elapsed: number,
  sortedDucks: DuckSim[]
): void {
  ctx.save();

  // Top Header Banner
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.fillRect(0, 0, width, 52);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(0, 50, width, 2);

  // Left Title
  ctx.font = "900 13px system-ui, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "left";
  ctx.fillText("🦆 3D DUCK DERBY", 16, 22);

  // Countdown timer in seconds
  const remainingSec = Math.max(0, (durationMs - elapsed) / 1000).toFixed(1);
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "#38bdf8";
  ctx.fillText(progress >= 1.0 ? "🏁 FINISH!" : `⏱️ ${remainingSec}s`, 16, 38);

  // Progress Bar
  const pBarW = 120;
  const pBarX = 140;
  const pBarY = 22;
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  roundRect(ctx, pBarX, pBarY, pBarW, 8, 4);
  ctx.fill();

  const fillW = Math.max(4, pBarW * progress);
  const pBarGrad = ctx.createLinearGradient(pBarX, 0, pBarX + pBarW, 0);
  pBarGrad.addColorStop(0, "#38bdf8");
  pBarGrad.addColorStop(1, "#facc15");
  ctx.fillStyle = pBarGrad;
  roundRect(ctx, pBarX, pBarY, fillW, 8, 4);
  ctx.fill();

  // Right Top 3 Leaderboard pills
  const top3 = sortedDucks.slice(0, 3);
  let pillX = width - 16;
  for (let i = top3.length - 1; i >= 0; i--) {
    const d = top3[i];
    const nameStr = d.name.length > 8 ? d.name.slice(0, 7) + "…" : d.name;
    const badgeText = `${i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} ${nameStr}`;
    ctx.font = "bold 10px system-ui, sans-serif";
    const bWidth = ctx.measureText(badgeText).width + 12;
    pillX -= bWidth + 6;

    ctx.fillStyle = i === 0 ? "rgba(234, 179, 8, 0.25)" : "rgba(255, 255, 255, 0.1)";
    roundRect(ctx, pillX, 14, bWidth, 24, 12);
    ctx.fill();
    ctx.strokeStyle = i === 0 ? "#facc15" : "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = i === 0 ? "#fef08a" : "#f8fafc";
    ctx.textAlign = "center";
    ctx.fillText(badgeText, pillX + bWidth / 2, 30);
  }

  ctx.restore();
}

/**
 * Draw Pre-Race Idle State (Ducks bobbing at the starting gates)
 */
export function draw3DIdleDucks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  entrants: DuckEntrant[]
): void {
  const now = Date.now();
  const riverTop = 75;
  const riverBottom = height - 55;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // River banks and water
  const topBankGrad = ctx.createLinearGradient(0, 0, 0, riverTop);
  topBankGrad.addColorStop(0, "#064e3b");
  topBankGrad.addColorStop(1, "#1e293b");
  ctx.fillStyle = topBankGrad;
  ctx.fillRect(0, 0, width, riverTop);

  const waterGrad = ctx.createLinearGradient(0, riverTop, 0, riverBottom);
  waterGrad.addColorStop(0, "#0369a1");
  waterGrad.addColorStop(0.5, "#0284c7");
  waterGrad.addColorStop(1, "#075985");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, riverTop, width, riverBottom - riverTop);

  // Animated wave lines
  const waveTime = now * 0.002;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  for (let wy = riverTop + 15; wy < riverBottom - 10; wy += 22) {
    ctx.beginPath();
    for (let wx = 0; wx <= width; wx += 20) {
      const dy = Math.sin(wx * 0.02 + waveTime + wy * 0.4) * 2;
      if (wx === 0) ctx.moveTo(wx, wy + dy);
      else ctx.lineTo(wx, wy + dy);
    }
    ctx.stroke();
  }

  // Bottom bank
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, riverBottom, width, height - riverBottom);

  // Header Banner
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.fillRect(0, 0, width, 52);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(0, 50, width, 2);

  ctx.font = "900 13px system-ui, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "left";
  ctx.fillText("🦆 3D DUCK DERBY", 16, 25);
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Waiting for race to start…", 16, 42);

  // Starting gate rope
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(90, riverTop);
  ctx.lineTo(90, riverBottom);
  ctx.stroke();

  // Draw ducks bobbing at the starting gate
  const duckCount = Math.max(1, entrants.length);
  const laneSpacing = (riverBottom - riverTop) / (duckCount + 1);

  entrants.slice(0, 16).forEach((entrant, idx) => {
    const laneY = riverTop + laneSpacing * (idx + 1);
    const mockDuck: DuckSim = {
      id: entrant.id,
      name: entrant.fullName,
      isWinner: false,
      x: 45 + Math.sin(now * 0.002 + idx) * 8,
      laneY,
      actualY: laneY,
      speed: 0,
      baseSpeed: 1,
      surge: 0,
      surgeDuration: 0,
      wobblePhase: idx,
      bobFreq: 2.8 + (idx % 3) * 0.4,
      color: DUCK_PALETTES[idx % DUCK_PALETTES.length],
      rank: idx + 1,
      wakes: [],
      splashes: [],
    };
    draw3DRealisticDuck(ctx, mockDuck, now);
  });

  ctx.restore();
}

/**
 * Utility for drawing rounded rectangles
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
