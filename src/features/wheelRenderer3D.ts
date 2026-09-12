export const WHEEL_PALETTE = [
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

function adjustBrightness(hex: string, delta: number): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + delta));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + delta));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + delta));
  return `rgb(${r}, ${g}, ${b})`;
}

export function render3DRealisticWheel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rotationAngle: number,
  entrants: { id?: string; fullName: string }[],
  needleDeflection = 0
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.min(centerX, centerY) - 8;
  const wheelRadius = outerRadius - 16;
  const hubRadius = 36;

  ctx.clearRect(0, 0, width, height);

  // 1. Physical 3D Floor Shadow
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY + 8, outerRadius, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  ctx.fill();
  ctx.restore();

  // 2. 3D Outer Metallic Brass & Gold Bezel
  ctx.save();
  const bezelGrad = ctx.createLinearGradient(
    centerX - outerRadius,
    centerY - outerRadius,
    centerX + outerRadius,
    centerY + outerRadius
  );
  bezelGrad.addColorStop(0.0, "#451a03"); // Deep burnished brass
  bezelGrad.addColorStop(0.18, "#d97706");
  bezelGrad.addColorStop(0.35, "#fef08a"); // Metallic specular gleam
  bezelGrad.addColorStop(0.55, "#b45309");
  bezelGrad.addColorStop(0.75, "#fde047");
  bezelGrad.addColorStop(0.9, "#92400e");
  bezelGrad.addColorStop(1.0, "#451a03");

  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
  ctx.fillStyle = bezelGrad;
  ctx.fill();

  // Recessed groove line
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius - 6, 0, 2 * Math.PI);
  ctx.strokeStyle = "rgba(10, 15, 28, 0.95)";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Inner beveled golden ring
  const innerBezelGrad = ctx.createRadialGradient(
    centerX,
    centerY,
    wheelRadius - 2,
    centerX,
    centerY,
    outerRadius - 6
  );
  innerBezelGrad.addColorStop(0.0, "#78350f");
  innerBezelGrad.addColorStop(0.5, "#d97706");
  innerBezelGrad.addColorStop(0.9, "#facc15");
  innerBezelGrad.addColorStop(1.0, "#b45309");

  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius - 7, 0, 2 * Math.PI);
  ctx.fillStyle = innerBezelGrad;
  ctx.fill();
  ctx.restore();

  // 3. Slices with 3D Radial Shading
  const sliceCount = Math.max(1, entrants.length);
  const sliceAngle = (2 * Math.PI) / sliceCount;

  for (let i = 0; i < sliceCount; i++) {
    const startAngle = rotationAngle + i * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    const color = WHEEL_PALETTE[i % WHEEL_PALETTE.length];

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, wheelRadius, startAngle, endAngle);
    ctx.closePath();

    // 3D Depth Radial Gradient per slice
    const sliceGrad = ctx.createRadialGradient(
      centerX,
      centerY,
      hubRadius,
      centerX,
      centerY,
      wheelRadius
    );
    sliceGrad.addColorStop(0.0, adjustBrightness(color.bg, -35)); // Darker near center hub
    sliceGrad.addColorStop(0.7, color.bg);
    sliceGrad.addColorStop(1.0, adjustBrightness(color.bg, 25)); // Luminous towards rim

    ctx.fillStyle = sliceGrad;
    ctx.fill();

    // Metallic separator line between slices
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Text label with 3D embossed shadow
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const fontSize = sliceCount > 50 ? 9.5 : sliceCount > 30 ? 10.5 : sliceCount > 15 ? 11.5 : 13;
    ctx.font = `700 ${fontSize}px Inter, sans-serif`;

    const entrantName = entrants[i]?.fullName || (entrants.length === 0 ? "Awaiting participants…" : `Participant #${i + 1}`);
    const maxTextWidth = wheelRadius - hubRadius - 20;
    let text = entrantName;
    if (ctx.measureText(text).width > maxTextWidth) {
      while (ctx.measureText(text + "…").width > maxTextWidth && text.length > 2) {
        text = text.slice(0, -1);
      }
      text = text + "…";
    }

    // Embossed drop shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = color.text;
    ctx.fillText(text, wheelRadius - 16, 0);
    ctx.restore();
    ctx.restore();
  }

  // 4. 3D Perimeter Studs / Metallic Chrome Pegs
  for (let i = 0; i < sliceCount; i++) {
    const pinAngle = rotationAngle + i * sliceAngle;
    const pinDistance = outerRadius - 9;
    const pinX = centerX + pinDistance * Math.cos(pinAngle);
    const pinY = centerY + pinDistance * Math.sin(pinAngle);

    ctx.save();
    // Drop shadow under peg
    ctx.beginPath();
    ctx.arc(pinX + 1, pinY + 1.5, 3.8, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fill();

    // 3D Sphere gradient for metallic peg
    const pegGrad = ctx.createRadialGradient(
      pinX - 1,
      pinY - 1,
      0.5,
      pinX,
      pinY,
      3.8
    );
    pegGrad.addColorStop(0.0, "#ffffff"); // Specular glint
    pegGrad.addColorStop(0.25, "#fef08a");
    pegGrad.addColorStop(0.65, "#eab308");
    pegGrad.addColorStop(1.0, "#713f12");

    ctx.beginPath();
    ctx.arc(pinX, pinY, 3.8, 0, 2 * Math.PI);
    ctx.fillStyle = pegGrad;
    ctx.fill();

    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  // 5. 3D Curved Acrylic / Crystal Dome Specular Sheen (Top hemisphere)
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, wheelRadius, Math.PI * 0.9, Math.PI * 2.1);
  ctx.closePath();
  const glassGrad = ctx.createLinearGradient(centerX, centerY - wheelRadius, centerX, centerY);
  glassGrad.addColorStop(0.0, "rgba(255, 255, 255, 0.22)");
  glassGrad.addColorStop(0.45, "rgba(255, 255, 255, 0.07)");
  glassGrad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
  ctx.fillStyle = glassGrad;
  ctx.fill();
  ctx.restore();

  // 6. 3D Center Hub (Multi-layer Brass Flange + Brushed Obsidian Disc + Ruby Spindle)
  ctx.save();
  // Hub shadow onto wheel surface
  ctx.beginPath();
  ctx.arc(centerX, centerY + 3, hubRadius + 2, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 12;
  ctx.fill();

  // Outer hub gold flange
  const hubGoldGrad = ctx.createLinearGradient(
    centerX - hubRadius,
    centerY - hubRadius,
    centerX + hubRadius,
    centerY + hubRadius
  );
  hubGoldGrad.addColorStop(0.0, "#78350f");
  hubGoldGrad.addColorStop(0.3, "#fef08a");
  hubGoldGrad.addColorStop(0.6, "#d97706");
  hubGoldGrad.addColorStop(1.0, "#451a03");

  ctx.beginPath();
  ctx.arc(centerX, centerY, hubRadius, 0, 2 * Math.PI);
  ctx.fillStyle = hubGoldGrad;
  ctx.fill();
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Middle titanium disc
  const hubInnerGrad = ctx.createRadialGradient(
    centerX - 4,
    centerY - 4,
    2,
    centerX,
    centerY,
    hubRadius - 6
  );
  hubInnerGrad.addColorStop(0.0, "#334155");
  hubInnerGrad.addColorStop(0.5, "#0f172a");
  hubInnerGrad.addColorStop(1.0, "#020617");

  ctx.beginPath();
  ctx.arc(centerX, centerY, hubRadius - 6, 0, 2 * Math.PI);
  ctx.fillStyle = hubInnerGrad;
  ctx.fill();

  // Center Ruby / Crystal Spindle Gem
  const gemGrad = ctx.createRadialGradient(
    centerX - 3,
    centerY - 3,
    1,
    centerX,
    centerY,
    15
  );
  gemGrad.addColorStop(0.0, "#fef08a"); // Specular glint
  gemGrad.addColorStop(0.2, "#f43f5e"); // Ruby core
  gemGrad.addColorStop(0.7, "#9f1239");
  gemGrad.addColorStop(1.0, "#4c0519");

  ctx.beginPath();
  ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
  ctx.fillStyle = gemGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(250, 204, 21, 0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top glint highlight on gem
  ctx.beginPath();
  ctx.arc(centerX - 4, centerY - 4, 2.5, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fill();
  ctx.restore();

  // 7. 3D Faceted Golden Pointer Needle with Physical Deflection
  ctx.save();
  const pointerY = centerY - outerRadius + 8;
  const pointerX = centerX;

  ctx.translate(pointerX, pointerY);
  ctx.rotate(needleDeflection);

  // Pointer drop shadow
  ctx.beginPath();
  ctx.moveTo(0, 36);
  ctx.lineTo(-15, -10);
  ctx.lineTo(15, -10);
  ctx.closePath();
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  ctx.fill();

  // Pointer left shaded half
  ctx.beginPath();
  ctx.moveTo(0, 36);
  ctx.lineTo(-14, -8);
  ctx.lineTo(0, -8);
  ctx.closePath();
  const leftPointerGrad = ctx.createLinearGradient(-14, -8, 0, 36);
  leftPointerGrad.addColorStop(0, "#b45309");
  leftPointerGrad.addColorStop(0.5, "#d97706");
  leftPointerGrad.addColorStop(1, "#78350f");
  ctx.fillStyle = leftPointerGrad;
  ctx.fill();

  // Pointer right highlight half
  ctx.beginPath();
  ctx.moveTo(0, 36);
  ctx.lineTo(14, -8);
  ctx.lineTo(0, -8);
  ctx.closePath();
  const rightPointerGrad = ctx.createLinearGradient(0, -8, 14, 36);
  rightPointerGrad.addColorStop(0, "#fef08a");
  rightPointerGrad.addColorStop(0.5, "#facc15");
  rightPointerGrad.addColorStop(1, "#eab308");
  ctx.fillStyle = rightPointerGrad;
  ctx.fill();

  // Center ridge line
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(0, 36);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Pointer base hinge
  ctx.beginPath();
  ctx.arc(0, -8, 7.5, 0, 2 * Math.PI);
  const hingeGrad = ctx.createRadialGradient(-2, -10, 1, 0, -8, 7.5);
  hingeGrad.addColorStop(0, "#ffffff");
  hingeGrad.addColorStop(0.3, "#facc15");
  hingeGrad.addColorStop(1, "#78350f");
  ctx.fillStyle = hingeGrad;
  ctx.fill();
  ctx.strokeStyle = "#451a03";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}
