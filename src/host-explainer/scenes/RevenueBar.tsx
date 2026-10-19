import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PlayButton } from "../chrome/PlayButton";
import { theme } from "../theme";

export const RevenueBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const numberIn = spring({
    frame: frame - 8,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 500,
        left: 80,
        width: 920,
        height: 620,
      }}
    >
      <div style={{ position: "absolute", left: 0, bottom: 40, width: 220 }}>
        <div
          style={{
            position: "absolute",
            left: 36,
            top: -78,
            background: theme.ink,
            color: "#ffffff",
            borderRadius: 16,
            padding: "8px 12px 10px",
            width: 148,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>每月</div>
          <svg width="120" height="28" viewBox="0 0 120 28">
            <polyline
              points="4,22 28,14 48,18 70,8 96,12 116,4"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div
          style={{
            width: 200,
            height: 520 * grow,
            marginTop: 520 - 520 * grow,
            borderRadius: 28,
            background: theme.accent,
            border: `3px solid ${theme.ink}`,
          }}
        />
        <div
          style={{
            marginTop: 14,
            borderTop: `3px dashed ${theme.ink}`,
            paddingTop: 8,
            fontSize: 28,
            fontWeight: 760,
          }}
        >
          $2,400
        </div>
        <div style={{ fontSize: 20, color: theme.muted, marginTop: 4 }}>上月</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 280,
          top: 150,
          opacity: numberIn,
          transform: `scale(${0.86 + numberIn * 0.14})`,
          transformOrigin: "left center",
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: theme.muted,
            letterSpacing: "0.04em",
            marginBottom: 8,
          }}
        >
          // 本月
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 760,
            color: theme.accent,
            lineHeight: 0.95,
          }}
        >
          $12,000
        </div>
      </div>

      <PlayButton style={{ position: "absolute", left: 390, top: 300 }} />

      <svg
        width="150"
        height="190"
        viewBox="0 0 150 190"
        style={{ position: "absolute", right: 10, top: 80 }}
      >
        <rect
          x="8"
          y="8"
          width="134"
          height="174"
          rx="18"
          fill={theme.card}
          stroke={theme.ink}
          strokeWidth="4"
        />
        <rect x="8" y="8" width="134" height="36" rx="16" fill={theme.ink} />
        <rect x="28" y="68" width="94" height="10" rx="5" fill={theme.line} />
        <rect x="28" y="92" width="72" height="10" rx="5" fill={theme.line} />
        <rect x="28" y="116" width="84" height="10" rx="5" fill={theme.accent} />
      </svg>
    </div>
  );
};
