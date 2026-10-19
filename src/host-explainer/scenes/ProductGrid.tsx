import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PlayButton } from "../chrome/PlayButton";
import { theme } from "../theme";

const CARDS: { name: string; art: React.ReactNode }[] = [
  {
    name: "甲板笔记",
    art: (
      <>
        <div style={{ height: 28, borderRadius: 8, background: theme.ink }} />
        <div style={{ height: 8, borderRadius: 4, background: theme.line, marginTop: 10 }} />
        <div style={{ height: 8, width: "78%", borderRadius: 4, background: theme.line, marginTop: 8 }} />
        <div style={{ height: 8, width: "62%", borderRadius: 4, background: theme.line, marginTop: 8 }} />
      </>
    ),
  },
  {
    name: "像素发票",
    art: (
      <div style={{ display: "flex", gap: 8, height: 78 }}>
        <div style={{ flex: 1, borderRadius: 8, background: theme.accent }} />
        <div style={{ flex: 1, borderRadius: 8, background: theme.line }} />
      </div>
    ),
  },
  {
    name: "晨跑打卡",
    art: (
      <svg width="100%" height="78" viewBox="0 0 180 78">
        <circle cx="28" cy="28" r="16" fill={theme.accent} />
        <polyline
          points="58,58 90,30 120,46 160,16"
          fill="none"
          stroke={theme.ink}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "书桌计时",
    art: (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 78 }}>
        <div style={{ width: 28, height: 40, borderRadius: 6, background: theme.ink }} />
        <div style={{ width: 28, height: 68, borderRadius: 6, background: theme.accent }} />
        <div style={{ width: 28, height: 32, borderRadius: 6, background: theme.ink }} />
      </div>
    ),
  },
  {
    name: "海报工坊",
    art: <div style={{ height: 78, borderRadius: 10, background: theme.line }} />,
  },
  {
    name: "订阅盒子",
    art: (
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          background: theme.ink,
        }}
      />
    ),
  },
];

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const ProductGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: "absolute",
        top: 470,
        left: 80,
        width: 920,
      }}
    >
      <div
        style={{
          background: theme.card,
          borderRadius: 32,
          border: `3px solid ${theme.ink}`,
          padding: 28,
          boxShadow: "0 12px 0 rgba(22,22,22,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                background: theme.accent,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ height: 8, borderRadius: 4, background: theme.ink }} />
              <div style={{ height: 8, width: "70%", borderRadius: 4, background: theme.ink }} />
              <div style={{ height: 8, width: "45%", borderRadius: 4, background: theme.ink }} />
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 760 }}>产品墙</div>
              <div style={{ fontSize: 22, color: theme.muted, marginTop: 4 }}>
                六款独立产品
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: `2px solid ${theme.line}`,
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 20,
              color: theme.muted,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: theme.accent,
              }}
            />
            翻看中…
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
          }}
        >
          {CARDS.map((card, index) => {
            const enter = spring({
              frame: frame - 4 - index * 4,
              fps,
              config: { damping: 14, stiffness: 120 },
            });
            const rise = interpolate(enter, [0, 1], [24, 0], clamp);
            return (
              <div
                key={card.name}
                style={{
                  height: 168,
                  borderRadius: 18,
                  border: `2px solid ${theme.ink}`,
                  background: theme.card,
                  padding: "14px 14px 10px",
                  opacity: enter,
                  transform: `translateY(${rise}px)`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>{card.art}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{card.name}</div>
              </div>
            );
          })}
        </div>
      </div>
      <PlayButton
        style={{
          position: "absolute",
          left: "50%",
          top: "58%",
          marginLeft: -44,
          marginTop: -44,
        }}
      />
    </div>
  );
};
