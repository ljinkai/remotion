import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PlayButton } from "../chrome/PlayButton";
import { theme } from "../theme";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const BARS = [36, 64, 88, 52];

export const PhoneBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const fromLeft = interpolate(enter, [0, 1], [-40, 0], clamp);
  const fromRight = interpolate(enter, [0, 1], [40, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        top: 500,
        left: 70,
        width: 940,
        height: 700,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 10 + fromLeft,
          top: 80,
          width: 420,
          opacity: enter,
          transform: "rotate(-6deg)",
          background: theme.card,
          borderRadius: 28,
          border: `3px solid ${theme.ink}`,
          padding: "22px 22px 18px",
          boxShadow: "0 14px 0 rgba(22,22,22,0.06)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: theme.accent,
            color: "#ffffff",
            fontWeight: 760,
            fontSize: 20,
            borderRadius: 999,
            padding: "6px 12px",
          }}
        >
          订阅制
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 12,
            height: 120,
            marginTop: 28,
          }}
        >
          {BARS.map((height, index) => (
            <div
              key={height}
              style={{
                width: 28,
                height,
                borderRadius: 8,
                background: index % 2 === 0 ? theme.accent : theme.ink,
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 18, fontSize: 22, color: theme.muted }}>月付</div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 20 - fromRight,
          top: 0,
          width: 340,
          height: 620,
          opacity: enter,
          background: theme.ink,
          borderRadius: 44,
          padding: 16,
          boxShadow: "0 16px 0 rgba(22,22,22,0.08)",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 32,
            background: theme.card,
            padding: "28px 20px",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 760, letterSpacing: "0.04em" }}>
            本周上线
          </div>
          <div
            style={{
              marginTop: 28,
              background: "#ffffff",
              borderRadius: 18,
              border: `2px solid ${theme.line}`,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 760 }}>甲板笔记</div>
            <div
              style={{
                marginTop: 14,
                display: "inline-block",
                background: theme.accent,
                color: "#ffffff",
                fontWeight: 760,
                fontSize: 20,
                borderRadius: 999,
                padding: "8px 16px",
              }}
            >
              打开
            </div>
          </div>
        </div>
      </div>

      <PlayButton style={{ position: "absolute", left: 400, top: 250 }} />
    </div>
  );
};
