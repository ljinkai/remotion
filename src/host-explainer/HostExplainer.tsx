import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { Checklist } from "./chrome/Checklist";
import {
  BEATS,
  BEAT_FRAMES,
  getBeatIndex,
  getLocalFrame,
} from "./demoScript";
import { Host } from "./host/Host";
import { PhoneBeat } from "./scenes/PhoneBeat";
import { ProductGrid } from "./scenes/ProductGrid";
import { RevenueBar } from "./scenes/RevenueBar";
import { theme } from "./theme";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const scenes = [ProductGrid, RevenueBar, PhoneBeat];

const Headline: React.FC<{ text: string; accent: string }> = ({
  text,
  accent,
}) => {
  const index = text.indexOf(accent);
  const before = index >= 0 ? text.slice(0, index) : text;
  const after = index >= 0 ? text.slice(index + accent.length) : "";

  return (
    <h1
      style={{
        margin: 0,
        fontSize: theme.headlineSize,
        fontWeight: 760,
        lineHeight: 1.05,
        letterSpacing: "-0.03em",
        color: theme.ink,
      }}
    >
      {before}
      {index >= 0 ? (
        <span style={{ color: theme.accent, fontStyle: "italic" }}>{accent}</span>
      ) : null}
      {after}
    </h1>
  );
};

export const HostExplainerDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const beat = BEATS[getBeatIndex(frame)];
  const local = getLocalFrame(frame);
  const contentOpacity = interpolate(
    local,
    [0, 12, 138, 149],
    [0, 1, 1, 0],
    clamp,
  );
  const subtitleOpacity = interpolate(
    local,
    [12, 20, 138, 149],
    [0, 1, 1, 0],
    clamp,
  );

  return (
    <AbsoluteFill
      style={{
        fontFamily: theme.font,
        color: theme.ink,
        backgroundColor: theme.paper,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, ${theme.dot} 1.3px, transparent 1.5px)`,
          backgroundSize: "18px 18px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 72,
          left: 64,
          fontSize: theme.chapterSize,
          letterSpacing: "0.04em",
          color: theme.muted,
          zIndex: 5,
        }}
      >
        {beat.chapter}
      </div>
      <div
        style={{
          position: "absolute",
          top: 72,
          right: 64,
          fontSize: theme.chapterSize,
          letterSpacing: "0.04em",
          color: theme.muted,
          zIndex: 5,
        }}
      >
        {beat.progressLabel}
        <span style={{ color: theme.accent, fontWeight: 760 }}>
          {beat.progressValue}
        </span>
      </div>

      <AbsoluteFill style={{ opacity: contentOpacity }}>
        <div
          style={{
            position: "absolute",
            top: 168,
            left: 64,
            width: 952,
          }}
        >
          <Headline text={beat.headline} accent={beat.accent} />
        </div>
        {BEATS.map((item, index) => {
          const Scene = scenes[index];
          return (
            <Sequence
              key={item.id}
              from={item.startFrame}
              durationInFrames={BEAT_FRAMES}
            >
              <Scene />
            </Sequence>
          );
        })}
      </AbsoluteFill>

      <Checklist
        activeIndex={beat.checklistIndex}
        progress={beat.progressValue}
      />
      <Host pose={beat.pose} localFrame={local} globalFrame={frame} />
      <div
        style={{
          position: "absolute",
          top: 1596,
          left: 48,
          width: 640,
          textAlign: "center",
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.3,
          opacity: subtitleOpacity,
          zIndex: 6,
        }}
      >
        {beat.subtitle}
      </div>
    </AbsoluteFill>
  );
};
