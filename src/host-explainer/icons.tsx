import React from "react";
import type { HostIconName } from "./hostTypes";
import { theme } from "./theme";

export const HostIcon: React.FC<{ name: HostIconName; size?: number }> = ({
  name,
  size = 180,
}) => {
  const common = {
    fill: "none",
    stroke: theme.ink,
    strokeWidth: 8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 180 180">
      {name === "chart" ? (
        <polyline points="24,140 60,96 92,112 150,40" {...common} />
      ) : null}
      {name === "phone" ? (
        <rect x="52" y="18" width="76" height="144" rx="16" {...common} />
      ) : null}
      {name === "coin" ? (
        <ellipse cx="90" cy="90" rx="58" ry="58" {...common} stroke={theme.accent} />
      ) : null}
      {name === "user" ? (
        <>
          <circle cx="90" cy="62" r="28" {...common} />
          <path d="M36 156 Q90 104 144 156" {...common} />
        </>
      ) : null}
      {name === "arrow" ? (
        <polyline points="36,90 132,90 100,58" {...common} stroke={theme.accent} />
      ) : null}
      {name === "check" ? (
        <polyline points="40,96 74,130 142,52" {...common} stroke={theme.accent} />
      ) : null}
      {name === "wave" ? (
        <>
          <rect x="36" y="78" width="16" height="36" rx="6" fill={theme.accent} />
          <rect x="64" y="52" width="16" height="88" rx="6" fill={theme.ink} />
          <rect x="92" y="36" width="16" height="120" rx="6" fill={theme.accent} />
          <rect x="120" y="64" width="16" height="64" rx="6" fill={theme.ink} />
        </>
      ) : null}
    </svg>
  );
};
