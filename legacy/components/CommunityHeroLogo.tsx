import React from 'react';

interface CommunityHeroLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showMotto?: boolean;
}

export const CommunityHeroLogo: React.FC<CommunityHeroLogoProps> = ({
  size = 'md',
  className = '',
  showMotto = false,
}) => {
  const sizeMap = {
    sm: 'w-16 h-20',
    md: 'w-24 h-28',
    lg: 'w-32 h-36',
    xl: 'w-44 h-52',
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Community Hero Emblem */}
      <div className={`relative ${sizeMap[size]} flex items-center justify-center filter drop-shadow-[0_4px_16px_rgba(234,179,8,0.45)]`}>
        <svg
          viewBox="0 0 200 230"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Outer Shield Gold Glow & Border */}
          <defs>
            <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="25%" stopColor="#CA8A04" />
              <stop offset="50%" stopColor="#FEF08A" />
              <stop offset="75%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#854D0E" />
            </linearGradient>

            <linearGradient id="shieldBg" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="40%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            <linearGradient id="textGold" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#F8FAFC" />
              <stop offset="65%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>

            <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Shield Outer Line */}
          <path
            d="M100 8 L185 36 V115 C185 168 142 208 100 222 C58 208 15 168 15 115 V36 L100 8 Z"
            fill="url(#shieldBg)"
            stroke="url(#goldBorder)"
            strokeWidth="5"
            strokeLinejoin="round"
          />

          {/* Shield Inner Inset Line */}
          <path
            d="M100 18 L175 43 V113 C175 160 137 197 100 210 C63 197 25 160 25 113 V43 L100 18 Z"
            stroke="#EAB308"
            strokeWidth="1.5"
            strokeOpacity="0.6"
            fill="none"
          />

          {/* Top Hero Silhouette Shapes with Philippine Flag Accent */}
          <g transform="translate(42, 28) scale(0.6)">
            {/* Philippine Flag Mini Crest */}
            <path d="M150 15 L180 5 L180 30 L150 40 Z" fill="#2563EB" />
            <path d="M150 40 L180 30 L180 55 L150 65 Z" fill="#DC2626" />
            <polygon points="140,10 160,37 140,65" fill="#F8FAFC" />
            <circle cx="147" cy="37" r="4" fill="#FBBF24" />

            {/* 3 Hero Silhouettes (Left, Center, Right) */}
            {/* Left Mage/Marksman */}
            <path
              d="M30 75 Q40 45 55 40 Q65 42 70 55 Q75 40 85 45 Q90 60 85 75 Z"
              fill="#FBBF24"
              opacity="0.85"
            />
            {/* Center Warrior / Fighter */}
            <path
              d="M75 75 Q85 30 100 25 Q115 30 125 75 Z"
              fill="#FEF08A"
              opacity="0.95"
            />
            <path d="M96 15 L104 15 L102 30 L98 30 Z" fill="#FBBF24" />
            {/* Right Assassin / Tank */}
            <path
              d="M115 75 Q125 45 135 40 Q145 42 150 55 Q155 40 165 45 Q170 60 165 75 Z"
              fill="#FBBF24"
              opacity="0.85"
            />
          </g>

          {/* COMMUNITY Ribbon / Header Banner */}
          <path
            d="M32 82 L168 82 L160 102 L40 102 Z"
            fill="#0F172A"
            stroke="#EAB308"
            strokeWidth="2"
          />
          <text
            x="100"
            y="97"
            textAnchor="middle"
            fontFamily="Impact, 'Space Grotesk', sans-serif"
            fontSize="15"
            fontWeight="900"
            letterSpacing="3"
            fill="#FDE047"
          >
            COMMUNITY
          </text>

          {/* HERO Big Display Typography */}
          <g filter="url(#goldGlow)">
            <text
              x="100"
              y="142"
              textAnchor="middle"
              fontFamily="Impact, 'Space Grotesk', sans-serif"
              fontSize="40"
              fontWeight="900"
              letterSpacing="1"
              fill="#0F172A"
              stroke="#FDE047"
              strokeWidth="5"
              strokeLinejoin="miter"
            >
              HERO
            </text>
            <text
              x="100"
              y="142"
              textAnchor="middle"
              fontFamily="Impact, 'Space Grotesk', sans-serif"
              fontSize="40"
              fontWeight="900"
              letterSpacing="1"
              fill="url(#textGold)"
            >
              HERO
            </text>
          </g>

          {/* MLBB Sub-brand Ribbon */}
          <g transform="translate(48, 154) scale(0.52)">
            {/* ML Crest Icon */}
            <rect x="0" y="2" width="22" height="24" rx="4" fill="#3B82F6" />
            <path d="M4 14 L11 7 L18 14 L11 21 Z" fill="#F8FAFC" />
            <text
              x="30"
              y="16"
              fontFamily="'Space Grotesk', sans-serif"
              fontSize="16"
              fontWeight="900"
              letterSpacing="2"
              fill="#FFFFFF"
            >
              MOBILE LEGENDS
            </text>
            <text
              x="30"
              y="28"
              fontFamily="'Space Grotesk', sans-serif"
              fontSize="11"
              fontWeight="700"
              letterSpacing="4"
              fill="#FBBF24"
            >
              BANG BANG
            </text>
          </g>

          {/* Bottom Star & Laurel */}
          <polygon
            points="100,188 103,196 111,196 104,201 107,209 100,204 93,209 96,201 89,196 97,196"
            fill="#FDE047"
          />
          <path
            d="M75 192 Q65 185 62 175 M125 192 Q135 185 138 175"
            stroke="#CA8A04"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Official Slogan */}
      {showMotto && (
        <div className="mt-1 text-center font-bold tracking-widest text-[10px] sm:text-xs text-amber-300 drop-shadow-md uppercase">
          <span>ONE GAME. ONE NATION. ONE COMMUNITY.</span>
        </div>
      )}
    </div>
  );
};
