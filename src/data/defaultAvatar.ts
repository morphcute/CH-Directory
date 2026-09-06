/**
 * Default SVG Avatar representing MLBB PH Community Heroes gaming mascot
 * (Gamer with Community Hero cap and arcade controller)
 */
export const DEFAULT_CH_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="arcadeGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.9" />
      <stop offset="60%" stop-color="#1e1b4b" stop-opacity="1" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="1" />
    </radialGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fed7aa" />
      <stop offset="100%" stop-color="#fdba74" />
    </linearGradient>
    <linearGradient id="capGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <circle cx="100" cy="100" r="100" fill="url(#arcadeGlow)" />
  <!-- Neon bokeh circles -->
  <circle cx="45" cy="40" r="18" fill="#ec4899" opacity="0.3" filter="blur(2px)" />
  <circle cx="160" cy="60" r="22" fill="#06b6d4" opacity="0.35" filter="blur(2px)" />
  <circle cx="170" cy="150" r="16" fill="#f59e0b" opacity="0.25" />
  <circle cx="30" cy="140" r="14" fill="#a855f7" opacity="0.3" />

  <!-- Headphones band around back -->
  <path d="M 46 95 C 46 55 154 55 154 95" fill="none" stroke="#64748b" stroke-width="8" stroke-linecap="round" />

  <!-- Anime Hair back -->
  <path d="M 52 85 C 40 120 50 160 65 175 C 80 160 120 160 135 175 C 150 160 160 120 148 85 Z" fill="#090d16" />

  <!-- Neck & Shirt -->
  <path d="M 86 135 L 114 135 L 120 180 L 80 180 Z" fill="url(#skinGrad)" />
  <path d="M 50 170 C 80 155 120 155 150 170 L 160 200 L 40 200 Z" fill="#1e293b" />
  <!-- Shirt collar graphic: HERO -->
  <rect x="82" y="172" width="36" height="12" rx="3" fill="#0f172a" />
  <text x="100" y="181" font-size="8" font-family="sans-serif" font-weight="900" fill="#f59e0b" text-anchor="middle">HERO</text>

  <!-- Head/Face -->
  <path d="M 68 85 C 68 65 132 65 132 85 C 132 115 120 142 100 142 C 80 142 68 115 68 85 Z" fill="url(#skinGrad)" />

  <!-- Blush on cheeks -->
  <ellipse cx="78" cy="114" rx="7" ry="4" fill="#fb7185" opacity="0.6" />
  <ellipse cx="122" cy="114" rx="7" ry="4" fill="#fb7185" opacity="0.6" />

  <!-- Expressive Big Anime Eyes -->
  <!-- Left Eye -->
  <ellipse cx="82" cy="102" rx="9" ry="11" fill="#0f172a" />
  <ellipse cx="82" cy="103" rx="7" ry="9" fill="#9333ea" />
  <circle cx="80" cy="98" r="3.5" fill="#ffffff" />
  <circle cx="84" cy="106" r="1.5" fill="#ffffff" />
  <path d="M 72 91 Q 83 87 92 92" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />

  <!-- Right Eye (focused gamer wink/gaze) -->
  <ellipse cx="118" cy="102" rx="9" ry="11" fill="#0f172a" />
  <ellipse cx="118" cy="103" rx="7" ry="9" fill="#9333ea" />
  <circle cx="116" cy="98" r="3.5" fill="#ffffff" />
  <circle cx="120" cy="106" r="1.5" fill="#ffffff" />
  <path d="M 108 92 Q 117 87 128 91" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />

  <!-- Nose & Smile -->
  <path d="M 99 110 L 101 113" stroke="#ea580c" stroke-width="2" stroke-linecap="round" />
  <!-- Confident grin -->
  <path d="M 94 121 Q 100 128 106 121" fill="#be123c" stroke="#0f172a" stroke-width="1.5" />
  <path d="M 96 122 Q 100 125 104 122" fill="#ffffff" />

  <!-- Hair Bangs framing face -->
  <path d="M 64 78 C 70 95 72 110 74 116 C 76 100 80 92 84 84 Z" fill="#0f172a" />
  <path d="M 136 78 C 130 95 128 110 126 116 C 124 100 120 92 116 84 Z" fill="#0f172a" />
  <path d="M 82 82 C 88 95 92 102 96 106 C 98 96 100 88 104 82 Z" fill="#0f172a" />

  <!-- COMMUNITY HERO Baseball Cap (Black & Gold) -->
  <!-- Cap Crown -->
  <path d="M 56 78 C 56 36 144 36 144 78 Z" fill="url(#capGrad)" />
  <!-- Cap Visor / Bill -->
  <path d="M 44 75 C 60 62 140 62 156 75 C 158 84 146 88 100 88 C 54 88 42 84 44 75 Z" fill="#090d16" stroke="#f59e0b" stroke-width="1" />

  <!-- Cap Gold Shield Patch with "HERO" -->
  <path d="M 88 46 L 112 46 L 114 62 L 100 70 L 86 62 Z" fill="url(#goldGrad)" stroke="#78350f" stroke-width="1" />
  <path d="M 91 49 L 109 49 L 111 60 L 100 66 L 89 60 Z" fill="#0f172a" />
  <text x="100" y="59" font-size="7" font-family="sans-serif" font-weight="900" fill="#fbbf24" text-anchor="middle" letter-spacing="0.5">HERO</text>

  <!-- Headphones earcups on sides -->
  <rect x="42" y="85" width="10" height="24" rx="5" fill="#f59e0b" stroke="#0f172a" stroke-width="2" />
  <rect x="148" y="85" width="10" height="24" rx="5" fill="#f59e0b" stroke="#0f172a" stroke-width="2" />

  <!-- Arcade Joystick in foreground -->
  <circle cx="50" cy="170" r="14" fill="#f43f5e" stroke="#ffe4e6" stroke-width="3" />
  <path d="M 50 170 L 44 195" stroke="#94a3b8" stroke-width="6" stroke-linecap="round" />
  <!-- Gamer Hand gripping -->
  <ellipse cx="48" cy="168" rx="8" ry="7" fill="url(#skinGrad)" opacity="0.9" />

  <!-- Sparkle highlights -->
  <polygon points="155,35 158,45 168,48 158,51 155,61 152,51 142,48 152,45" fill="#fef08a" opacity="0.9" />
</svg>
`)}`;
