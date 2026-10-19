import React from "react";
import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { assetSrc } from "../Composition";
import { Checklist } from "./chrome/Checklist";
import { ElementStage } from "./ElementStage";
import { Host } from "./host/Host";
import type { HostBeat, HostExplainerProps } from "./hostTypes";
import { theme } from "./theme";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const checklistEntries = (
  titles: string[],
  active: number | null,
) => {
  if (titles.length <= 4) {
    return titles.map((label, index) => ({ label, index }));
  }
  const center = active === null ? 0 : active;
  const start = Math.max(0, Math.min(center - 1, titles.length - 3));
  return [0, 1, 2].map((offset) => ({
    label: titles[start + offset],
    index: start + offset,
  }));
};

const activeBeat = (beats: HostBeat[], frame: number, fps: number) => {
  const ms = (frame / fps) * 1000;
  const found = beats.findIndex(
    (beat) => ms >= beat.startMs && ms < beat.endMs,
  );
  if (found >= 0) {
    return found;
  }
  const upcoming = beats.findIndex((beat) => ms < beat.startMs);
  if (upcoming > 0) {
    return upcoming - 1;
  }
  return upcoming === 0 ? 0 : beats.length - 1;
};

const Headline: React.FC<{ text: string; accent: string }> = ({
  text,
  accent,
}) => {
  const index = accent ? text.indexOf(accent) : -1;
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

export const HostExplainer: React.FC<HostExplainerProps> = ({
  beats = [],
  cases = [],
  narrationAudioSrc,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titles = cases.map((item, index) => item.title || `案例 ${index + 1}`);

  if (beats.length === 0) {
    return (
      <AbsoluteFill
        style={{
          background: theme.paper,
          color: theme.ink,
          fontFamily: theme.font,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 42,
          fontWeight: 700,
        }}
      >
        还没有分镜
      </AbsoluteFill>
    );
  }

  const index = activeBeat(beats, frame, fps);
  const beat = beats[index];
  const startFrame = Math.round((beat.startMs / 1000) * fps);
  const durationFrames = Math.max(
    1,
    Math.round(((beat.endMs - beat.startMs) / 1000) * fps),
  );
  const localFrame = Math.max(0, frame - startFrame);
  const mouthOpen = localFrame >= 12 && localFrame < durationFrames - 12;
  const subtitleOpacity = interpolate(
    localFrame,
    [Math.max(0, durationFrames - 12), Math.max(1, durationFrames - 1)],
    [1, 0],
    clamp,
  );
  const caseTitle =
    beat.caseIndex !== null ? titles[beat.caseIndex] || "" : "";
  const chapter =
    beat.section === "intro"
      ? "// 开场"
      : beat.section === "closing"
        ? "// 结尾"
        : `// ${String((beat.caseIndex ?? 0) + 1).padStart(2, "0")} – ${caseTitle}`;
  const progress =
    beat.section === "case" && titles.length > 0
      ? `${(beat.caseIndex ?? 0) + 1}/${titles.length}`
      : beat.section === "intro"
        ? "开场"
        : "结尾";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.paper,
        color: theme.ink,
        fontFamily: theme.font,
      }}
    >
      {narrationAudioSrc ? (
        <Audio src={assetSrc(narrationAudioSrc)} volume={0.95} />
      ) : null}
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
        }}
      >
        {chapter}
      </div>
      <div
        style={{
          position: "absolute",
          top: 72,
          right: 64,
          fontSize: theme.chapterSize,
          letterSpacing: "0.04em",
          color: theme.muted,
        }}
      >
        {beat.section === "case" ? "案例 " : ""}
        <span style={{ color: theme.accent, fontWeight: 760 }}>{progress}</span>
      </div>
      <div style={{ position: "absolute", top: 168, left: 64, width: 952 }}>
        <Headline text={beat.headline} accent={beat.accent} />
      </div>
      <ElementStage
        elements={beat.elements}
        localFrame={localFrame}
        durationFrames={durationFrames}
      />
      <Checklist
        title="// 本期案例"
        activeIndex={beat.section === "case" ? beat.caseIndex : null}
        progress={progress}
        entries={checklistEntries(titles, beat.section === "case" ? beat.caseIndex : null)}
      />
      <Host
        pose={beat.host}
        localFrame={localFrame}
        globalFrame={frame}
        mouthOpen={mouthOpen}
      />
      <div
        style={{
          position: "absolute",
          top: 1596,
          left: 48,
          width: 640,
          textAlign: "center",
          fontSize: 32,
          fontWeight: 700,
          opacity: subtitleOpacity,
          zIndex: 6,
        }}
      >
        {beat.say}
      </div>
    </AbsoluteFill>
  );
};
