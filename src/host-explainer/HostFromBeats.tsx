import React from "react";
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig } from "remotion";
import { assetSrc } from "../Composition";
import { Checklist } from "./chrome/Checklist";
import { ElementStage } from "./ElementStage";
import { Host } from "./host/Host";
import type { HostBeat, HostExplainerProps } from "./hostTypes";
import { theme } from "./theme";
import { deriveHostScene } from "./sceneContent";
import { continuousSceneWindow } from "./richSceneMath";
import { HostLocaleProvider, hostLabels, type HostLocale } from "./hostLocale";
import { hostCaptionPages, hostCaptionPageAtFrame } from "./hostCaptions";
import { HostCaptions } from "./HostCaptionArea";
import { postGalleryElements } from "./postGallery";

const checklistEntries = (titles: string[], active: number | null) => {
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

const Headline: React.FC<{
  text: string;
  accent: string;
  locale: HostLocale;
  frame: number;
  duration: number;
}> = ({ text, accent, locale, frame, duration }) => {
  if (locale === "en") {
    const pages = hostCaptionPages(text, {
      width: 952,
      paddingX: 0,
      fontSize: 56,
    });
    text = hostCaptionPageAtFrame(pages, frame, duration)
      .page.lines.map((line) => line.trim())
      .join("\n");
  }
  const index = accent ? text.indexOf(accent) : -1;
  const before = index >= 0 ? text.slice(0, index) : text;
  const after = index >= 0 ? text.slice(index + accent.length) : "";
  return (
    <h1
      style={{
        margin: 0,
        fontSize: locale === "en" ? 56 : theme.headlineSize,
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        fontWeight: 760,
        lineHeight: 1.05,
        letterSpacing: "-0.03em",
      }}
    >
      {before}
      {index >= 0 ? (
        <span style={{ color: theme.accent, fontStyle: "italic" }}>
          {accent}
        </span>
      ) : null}
      {after}
    </h1>
  );
};

export const HostExplainer: React.FC<HostExplainerProps> = ({
  beats = [],
  cases = [],
  narrationAudioSrc,
  locale = "zh",
  contentMode,
  sourceUrl,
  sourceAuthor,
}) => {
  const singlePost = contentMode === "single_post";
  const labels = hostLabels[locale];
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titles = cases.map(
    (item, index) => item.title || `${labels.case} ${index + 1}`,
  );

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
        {labels.empty}
      </AbsoluteFill>
    );
  }

  const index = activeBeat(beats, frame, fps);
  const beat = beats[index];
  const elements = singlePost
    ? postGalleryElements(beat, beats, cases, (frame / fps) * 1000)
    : beat.elements;
  const rich = ["product", "metric", "relationship"].includes(
    deriveHostScene(elements, beat.scene),
  );
  const sceneWindow = continuousSceneWindow(beats, index, frame, fps);
  const startFrame = Math.round((beat.startMs / 1000) * fps);
  const durationFrames = Math.max(
    1,
    Math.round(((beat.endMs - beat.startMs) / 1000) * fps),
  );
  const localFrame = Math.max(0, frame - startFrame);
  const caseTitle = beat.caseIndex !== null ? titles[beat.caseIndex] || "" : "";
  const chapter =
    beat.section === "intro"
      ? `// ${labels.intro}`
      : beat.section === "closing"
        ? `// ${labels.closing}`
        : `// ${String((beat.caseIndex ?? 0) + 1).padStart(2, "0")} – ${caseTitle}`;
  const progress =
    beat.section === "case" && titles.length > 0
      ? `${(beat.caseIndex ?? 0) + 1}/${titles.length}`
      : beat.section === "intro"
        ? labels.intro
        : labels.closing;

  return (
    <HostLocaleProvider value={locale}>
      <AbsoluteFill style={{ backgroundColor: theme.paper }} />
      <AbsoluteFill
        style={{
          backgroundColor: theme.paper,
          color: theme.ink,
          fontFamily: theme.font,
          ...(singlePost
            ? {
                transform: "translateY(-40px) scale(0.86)",
                transformOrigin: "center",
              }
            : {}),
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
            maxWidth: 730,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
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
          {beat.section === "case" ? `${labels.case} ` : ""}
          <span style={{ color: theme.accent, fontWeight: 760 }}>
            {progress}
          </span>
        </div>
        <div style={{ position: "absolute", top: 168, left: 64, width: 952 }}>
          <Headline
            text={beat.headline}
            accent={beat.accent}
            locale={locale}
            frame={localFrame}
            duration={durationFrames}
          />
        </div>
        {singlePost && sourceUrl ? (
          <div
            style={{
              position: "absolute",
              top: 124,
              left: 64,
              width: 850,
              fontSize: 23,
              color: theme.muted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Source: {sourceAuthor ? `${sourceAuthor} · ` : ""}
            {sourceUrl}
          </div>
        ) : null}
        <ElementStage
          narration={beat.say}
          elements={elements}
          scene={beat.scene}
          localFrame={localFrame}
          durationFrames={durationFrames}
          sceneFrame={sceneWindow.frame}
          sceneDuration={sceneWindow.duration}
          expanded={rich}
        />
        <Checklist
          compact={rich}
          title={`// ${singlePost ? "Featured post" : labels.cases}`}
          activeIndex={beat.section === "case" ? beat.caseIndex : null}
          progress={progress}
          entries={checklistEntries(
            titles,
            beat.section === "case" ? beat.caseIndex : null,
          )}
        />
        <Host
          pose={beat.host}
          section={beat.section}
          localFrame={localFrame}
          speakFrom={12}
          speakTo={Math.max(13, durationFrames - 12)}
        />
        <HostCaptions
          text={beat.say}
          localFrame={localFrame}
          durationFrames={durationFrames}
        />
      </AbsoluteFill>
    </HostLocaleProvider>
  );
};
