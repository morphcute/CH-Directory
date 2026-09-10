import React from "react";

export function MlbbDiamondIcon({
  size = 18,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, verticalAlign: "middle", ...style }}
      aria-hidden="true"
    >
      <path
        d="M12 2L4 8L6.5 15L12 22L17.5 15L20 8L12 2Z"
        fill="url(#mlbb-dm-grad)"
        stroke="#38bdf8"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M4 8H20M12 2L8.5 8L12 22L15.5 8L12 2Z"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 15H17.5"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.8"
      />
      <defs>
        <linearGradient
          id="mlbb-dm-grad"
          x1="12"
          y1="2"
          x2="12"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#38bdf8" />
          <stop offset="0.45" stopColor="#0284c7" />
          <stop offset="1" stopColor="#075985" />
        </linearGradient>
      </defs>
    </svg>
  );
}
