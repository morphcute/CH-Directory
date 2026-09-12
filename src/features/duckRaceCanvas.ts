export interface DuckEntrant {
  id: string;
  fullName: string;
}

export const DUCK_COLORS = [
  "#facc15", // Classic Rubber Duck Yellow
  "#38bdf8", // Sky Blue Duck
  "#f472b6", // Pink Flamingo Duck
  "#4ade80", // Spring Green Duck
  "#fb923c", // Orange Tangerine Duck
  "#c084fc", // Lavender Violet Duck
  "#2dd4bf", // Teal Aqua Duck
  "#fb7185", // Coral Rose Duck
  "#a3e635", // Lime Neon Duck
  "#e879f9", // Fuchsia Duck
];

/**
 * Deterministic pseudo-random float between 0 and 1 from seed string
 */
function pseudoHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs((hash % 10000) / 10000);
}

export interface RenderDuckRaceOptions {
  canvas: HTMLCanvasElement;
  entrants: DuckEntrant[];
  winningIndex: number;
  progress: number; // 0 to 1
  isRacing: boolean;
  isFinished: boolean;
  timeMs: number;
  onLeaderboardUpdate?: (leaders: { name: string; rank: number }[]) => void;
}

export function renderDuckRace({
  canvas,
  entrants,
  winningIndex,
  progress,
  isRacing,
  isFinished,
  timeMs,
  onLeaderboardUpdate,
}: RenderDuckRaceOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // River boundaries
  const bankHeight = 28;
  const waterTop = bankHeight;
  const waterBottom = height - bankHeight;
  const waterHeight = waterBottom - waterTop;

  // Track coordinates
  const startX = 42;
  const finishX = width - 56;
  const trackDistance = finishX - startX;

  // 1. Clear background
  ctx.clearRect(0, 0, width, height);

  // 2. Draw River Water with gradient
  const riverGrad = ctx.createLinearGradient(0, waterTop, 0, waterBottom);
  riverGrad.addColorStop(0, "#0369a1");
  riverGrad.addColorStop(0.5, "#0284c7");
  riverGrad.addColorStop(1, "#075985");
  ctx.fillStyle = riverGrad;
  ctx.fillRect(0, waterTop, width, waterHeight);

  // 3. Animated River Waves
  const waveOffset = (timeMs * 0.08) % 60;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1.5;
  for (let y = waterTop + 14; y < waterBottom; y += 22) {
    ctx.beginPath();
    for (let x = -60; x <= width + 60; x += 30) {
      const waveY = y + Math.sin((x + waveOffset + y * 2) * 0.05) * 2.8;
      if (x === -60) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }

  // 4. River Banks (Top and Bottom)
  const drawBank = (y: number, isTop: boolean) => {
    ctx.save();
    const grad = ctx.createLinearGradient(0, isTop ? 0 : y, 0, isTop ? bankHeight : height);
    if (isTop) {
      grad.addColorStop(0, "#14532d");
      grad.addColorStop(0.85, "#15803d");
      grad.addColorStop(1, "#166534");
    } else {
      grad.addColorStop(0, "#166534");
      grad.addColorStop(0.15, "#15803d");
      grad.addColorStop(1, "#14532d");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, isTop ? 0 : y, width, bankHeight);

    // Riverbank stones and grass tufts
    ctx.fillStyle = "rgba(250, 204, 21, 0.3)";
    for (let x = 12; x < width; x += 44) {
      ctx.beginPath();
      const stoneY = isTop ? bankHeight - 3 : y + 3;
      ctx.ellipse(x, stoneY, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  drawBank(0, true);
  drawBank(waterBottom, false);

  // 5. Start Line
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, waterTop);
  ctx.lineTo(startX, waterBottom);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 6. Finish Line (Checkerboard ribbon & banner)
  ctx.save();
  const squareSize = 7;
  const rows = Math.floor(waterHeight / squareSize);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#ffffff" : "#0f172a";
      ctx.fillRect(finishX + c * squareSize, waterTop + r * squareSize, squareSize, squareSize);
    }
  }

  // Finish Line Tape broken effect when finished
  if (isFinished) {
    ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(finishX + 8, waterTop);
    ctx.lineTo(finishX - 8, waterTop + waterHeight * 0.45);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(finishX + 8, waterBottom);
    ctx.lineTo(finishX + 20, waterTop + waterHeight * 0.55);
    ctx.stroke();
  }

  // Finish Post Poles
  ctx.fillStyle = "#facc15";
  ctx.fillRect(finishX - 1, waterTop - 6, 16, 6);
  ctx.fillRect(finishX - 1, waterBottom, 16, 6);
  ctx.restore();

  // 7. Calculate Ducks positions and lanes
  const totalEntrants = entrants.length;
  if (totalEntrants === 0) return;

  // Maximum concurrent visible vertical lanes to avoid squishing
  const maxLanes = Math.min(8, Math.max(3, totalEntrants));
  const laneHeight = (waterHeight - 30) / maxLanes;

  interface DuckState {
    id: string;
    fullName: string;
    x: number;
    y: number;
    color: string;
    isWinner: boolean;
    wobble: number;
    scale: number;
  }

  const duckStates: DuckState[] = [];

  for (let i = 0; i < totalEntrants; i++) {
    const entrant = entrants[i];
    const isWinner = i === winningIndex;
    const seed = pseudoHash(entrant.id + entrant.fullName);
    const color = DUCK_COLORS[i % DUCK_COLORS.length];

    // Distribute duck into a vertical lane with slight random jitter
    const laneIndex = i % maxLanes;
    const laneY = waterTop + 18 + laneIndex * laneHeight + (seed * 6 - 3);

    let duckX = startX;

    if (!isRacing && !isFinished) {
      // Idle / ready dock state: ducks bob gently near start
      const idleOffset = (i % 3) * 12 + (seed * 8);
      duckX = startX - 8 + idleOffset;
    } else if (isFinished) {
      // Finished state: winner is past finish line, others behind
      if (isWinner) {
        duckX = finishX + 18;
      } else {
        const placeOffset = 18 + seed * (trackDistance * 0.35);
        duckX = Math.max(startX + 10, finishX - placeOffset);
      }
    } else {
      // Active racing state: dynamic curves with surges!
      const surgePhase = Math.sin(progress * Math.PI * 3 + seed * 10);
      const randomLead = (seed - 0.5) * 0.18; // lead variance

      if (isWinner) {
        // Winner starts mid-pack and makes an exhilarating final sprint
        const winnerPace =
          progress < 0.45
            ? progress * 0.85
            : progress < 0.75
              ? 0.38 + (progress - 0.45) * 1.1
              : 0.71 + (progress - 0.75) * 1.25;

        duckX = startX + trackDistance * Math.min(1.05, winnerPace);
      } else {
        // Non-winners pace with surges but fall behind near finish
        const basePace = Math.pow(progress, 0.92) + randomLead * Math.sin(progress * Math.PI);
        const maxAllowed = 0.94 - seed * 0.16; // cannot cross finish line
        const clampedPace = Math.min(maxAllowed, basePace * 0.95);
        duckX = startX + trackDistance * clampedPace;
      }
    }

    const wobble = Math.sin(timeMs * 0.007 + seed * 20) * 3;
    const scale = totalEntrants > 25 ? 0.78 : totalEntrants > 12 ? 0.88 : 1.0;

    duckStates.push({
      id: entrant.id,
      fullName: entrant.fullName,
      x: duckX,
      y: laneY,
      color,
      isWinner,
      wobble,
      scale,
    });
  }

  // Sort ducks by Y position so ducks in foreground overlap ducks in background
  duckStates.sort((a, b) => a.y - b.y);

  // 8. Render Ducks and Splashes
  for (const duck of duckStates) {
    // Water wake splash if racing fast
    if (isRacing) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      for (let s = 0; s < 3; s++) {
        const splashX = duck.x - 14 - s * 7;
        const splashY = duck.y + duck.wobble + 6 + (Math.random() - 0.5) * 4;
        ctx.beginPath();
        ctx.arc(splashX, splashY, 2.2 - s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawRubberDuck(
      ctx,
      duck.x,
      duck.y,
      duck.scale,
      duck.fullName,
      duck.color,
      duck.isWinner && isFinished,
      duck.wobble
    );
  }

  // 9. Update live leaderboard for HUD (top ducks by X coordinate)
  if (onLeaderboardUpdate && (isRacing || isFinished)) {
    const sortedByX = [...duckStates].sort((a, b) => b.x - a.x);
    const leaders = sortedByX.slice(0, 3).map((d, idx) => ({
      name: d.fullName,
      rank: idx + 1,
    }));
    onLeaderboardUpdate(leaders);
  }
}

function drawRubberDuck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  fullName: string,
  colorBg: string,
  showCrown: boolean,
  wobble: number
) {
  ctx.save();
  ctx.translate(x, y + wobble);
  ctx.scale(scale, scale);

  // Water ripple underneath
  ctx.beginPath();
  ctx.ellipse(0, 9, 17, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.fill();

  // Duck body
  ctx.beginPath();
  ctx.moveTo(-13, 1);
  ctx.quadraticCurveTo(-18, -4, -22, -9); // tail tip
  ctx.quadraticCurveTo(-16, -1, -12, 5);
  ctx.quadraticCurveTo(-4, 11, 7, 9);
  ctx.quadraticCurveTo(16, 7, 16, 1);
  ctx.quadraticCurveTo(14, -5, 6, -5);
  ctx.quadraticCurveTo(-5, -5, -13, 1);
  ctx.fillStyle = colorBg;
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Duck wing
  ctx.beginPath();
  ctx.ellipse(-3, 1, 6.5, 3.8, -0.15, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.fill();

  // Duck head
  ctx.beginPath();
  ctx.arc(8, -9, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = colorBg;
  ctx.fill();
  ctx.stroke();

  // Duck beak
  ctx.beginPath();
  ctx.moveTo(15, -10);
  ctx.lineTo(23, -8);
  ctx.lineTo(15, -5.5);
  ctx.closePath();
  ctx.fillStyle = "#f97316";
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
  ctx.stroke();

  // Duck eye
  ctx.beginPath();
  ctx.arc(10.5, -11, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = "#090d16";
  ctx.fill();
  // Eye gleam
  ctx.beginPath();
  ctx.arc(11.2, -11.5, 0.7, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Winner Crown 👑
  if (showCrown) {
    ctx.save();
    ctx.translate(8, -18);
    ctx.beginPath();
    ctx.moveTo(-6, 3);
    ctx.lineTo(-8, -4);
    ctx.lineTo(-3, -1);
    ctx.lineTo(0, -6);
    ctx.lineTo(3, -1);
    ctx.lineTo(8, -4);
    ctx.lineTo(6, 3);
    ctx.closePath();
    ctx.fillStyle = "#facc15";
    ctx.fill();
    ctx.strokeStyle = "#ca8a04";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Name tag pill
  const shortName = fullName.length > 12 ? fullName.slice(0, 11) + "…" : fullName;
  ctx.font = "bold 9px Inter, sans-serif";
  const textW = ctx.measureText(shortName).width;
  const pillW = Math.max(26, textW + 8);
  const pillH = 13;

  ctx.fillStyle = "rgba(9, 13, 22, 0.88)";
  ctx.beginPath();
  ctx.roundRect(-pillW / 2, -25, pillW, pillH, 4);
  ctx.fill();
  ctx.strokeStyle = showCrown ? "#facc15" : "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = showCrown ? "#facc15" : "#f8fafc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(shortName, 0, -18.5);

  ctx.restore();
}
