import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";
import React, { useState } from "react";
import {
  buildSceneSegments,
  defaultVideoProps,
  getActiveCue,
  getDurationInFrames,
  hasSynthesizedTimeline,
  normalizeVideoProps,
  type SubtitleCue,
  type WeeklyCase,
  type WeeklyVideoProps,
} from "./videoData";
import { ensureSingleLineCues } from "./subtitleLines";
import { getVideoTemplate } from "./videoTemplates";
import { getVideoFormat } from "./videoFormats";
import {
  FIXED_CLOSING_NARRATION,
  splitClosingSummaryAndCta,
} from "./narrationScript";

const calculateMetadata: CalculateMetadataFunction<WeeklyVideoProps> = ({
  props,
}) => {
  return {
    durationInFrames: getDurationInFrames(props),
  };
};

export const MyComposition = () => {
  const landscape = getVideoFormat("landscape");
  const portrait = getVideoFormat("portrait");

  return (
    <>
      <Composition
        id={landscape.compositionId}
        component={MyComponent}
        durationInFrames={getDurationInFrames(defaultVideoProps)}
        fps={30}
        width={landscape.width}
        height={landscape.height}
        defaultProps={{ ...defaultVideoProps, aspect: "landscape" }}
        calculateMetadata={calculateMetadata}
      />
      <Composition
        id={portrait.compositionId}
        component={MyComponent}
        durationInFrames={getDurationInFrames(defaultVideoProps)}
        fps={30}
        width={portrait.width}
        height={portrait.height}
        defaultProps={{ ...defaultVideoProps, aspect: "portrait" }}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const fade = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end - 24, end], [1, 1, 0], clamp);

const sceneProgress = (frame: number, durationFrames: number) =>
  interpolate(frame, [0, Math.max(durationFrames - 1, 1)], [0, 1], clamp);

/** Cover H1 size by Chinese/Latin title length — keep single-line readable. */
export const fitCoverTitleSize = (title: string, portrait = false) => {
  const len = [...title.trim()].length;
  let size = 156;
  if (len <= 6) {
    size = 156;
  } else if (len <= 10) {
    size = 128;
  } else if (len <= 12) {
    size = 108;
  } else if (len <= 14) {
    size = 96;
  } else if (len <= 16) {
    size = 84;
  } else if (len <= 20) {
    size = 72;
  } else {
    size = 60;
  }
  return portrait ? Math.round(size * 0.7) : size;
};

/** Case meta title — keeps strip height stable. */
export const fitCaseTitleSize = (title: string, portrait = false) => {
  const len = [...title.trim()].length;
  let size = 42;
  if (len <= 12) {
    size = 42;
  } else if (len <= 20) {
    size = 34;
  } else if (len <= 32) {
    size = 28;
  } else {
    size = 24;
  }
  return portrait ? Math.round(size * 0.85) : size;
};

export const fitSubtitleSize = (text: string, portrait = false) => {
  const len = [...text.trim()].length;
  let size = 34;
  if (len <= 28) {
    size = 34;
  } else if (len <= 48) {
    size = 30;
  } else if (len <= 72) {
    size = 26;
  } else {
    size = 24;
  }
  return portrait ? Math.round(size * 0.9) : size;
};

export const assetSrc = (src: string) => {
  if (!src || !String(src).trim()) {
    return src;
  }
  const trimmed = String(src).trim();
  // Remote / data URLs — use as-is
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  // Files under public/ must go through staticFile so Remotion CLI render
  // resolves them from the project public folder (not the webpack temp bundle).
  // Do NOT branch on `window`: headless Chrome during render also has window,
  // and a bare "/.generated/..." path 404s against the bundle server.
  const cleaned = trimmed.replace(/^\/+/, "");
  return staticFile(cleaned);
};

const SceneSubtitles: React.FC<{
  cues?: SubtitleCue[];
  fallbackText: string;
  portrait?: boolean;
}> = ({ cues, fallbackText, portrait = false }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sceneMs = (frame / fps) * 1000;
  const durationMs = (durationInFrames / fps) * 1000;
  const lineCues = ensureSingleLineCues(cues, fallbackText, durationMs);
  const text = getActiveCue(lineCues, sceneMs, "").split(/\n/)[0]?.trim() || "";

  if (!text) {
    return null;
  }

  return (
    <div className="sceneSubtitleRegion">
      <p
        className="sceneSubtitleText"
        style={{ fontSize: fitSubtitleSize(text, portrait) }}
      >
        {text}
      </p>
    </div>
  );
};

const Header: React.FC<{ video: WeeklyVideoProps }> = ({ video }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(
    frame,
    [0, durationInFrames - 1],
    [0, 100],
    clamp,
  );

  return (
    <div className="header">
      <span>
        {video.headerTitle} ezindie.com
      </span>
      <div className="progressTrack">
        <div className="progressFill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

type CoverTileLayout = {
  top: string;
  left: string;
  width: string;
  height: string;
  driftX: number;
  driftY: number;
  rotate: number;
  z: number;
};

const LANDSCAPE_COVER_TILES: CoverTileLayout[] = [
  { top: "-4%", left: "-2%", width: "46%", height: "58%", driftX: -28, driftY: 18, rotate: -2.5, z: 1 },
  { top: "8%", left: "38%", width: "42%", height: "48%", driftX: 22, driftY: -16, rotate: 1.8, z: 2 },
  { top: "42%", left: "68%", width: "36%", height: "52%", driftX: 18, driftY: 24, rotate: -1.2, z: 3 },
  { top: "52%", left: "8%", width: "34%", height: "46%", driftX: -16, driftY: 20, rotate: 2.2, z: 2 },
  { top: "-6%", left: "72%", width: "30%", height: "40%", driftX: 14, driftY: -12, rotate: 3, z: 1 },
  { top: "58%", left: "48%", width: "28%", height: "38%", driftX: -10, driftY: 14, rotate: -2, z: 1 },
];

const PORTRAIT_COVER_TILES: CoverTileLayout[] = [
  { top: "-2%", left: "-6%", width: "62%", height: "36%", driftX: -18, driftY: 14, rotate: -2, z: 1 },
  { top: "8%", left: "42%", width: "64%", height: "32%", driftX: 16, driftY: -12, rotate: 1.6, z: 2 },
  { top: "34%", left: "-4%", width: "58%", height: "30%", driftX: -14, driftY: 18, rotate: 2, z: 2 },
  { top: "42%", left: "48%", width: "58%", height: "34%", driftX: 12, driftY: 16, rotate: -1.4, z: 3 },
  { top: "68%", left: "6%", width: "54%", height: "30%", driftX: -10, driftY: 12, rotate: 1.2, z: 1 },
  { top: "72%", left: "52%", width: "52%", height: "28%", driftX: 10, driftY: -8, rotate: -2.2, z: 2 },
];

const CoverImageBackdrop: React.FC<{
  cases: WeeklyCase[];
  portrait: boolean;
}> = ({ cases, portrait }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const images = cases
    .map((item) => item.image.trim())
    .filter(Boolean)
    .slice(0, 6);
  const layouts = portrait ? PORTRAIT_COVER_TILES : LANDSCAPE_COVER_TILES;

  if (images.length === 0) {
    return <AbsoluteFill className="coverBackdrop coverBackdrop--empty" />;
  }

  return (
    <AbsoluteFill className="coverBackdrop">
      {images.map((src, index) => {
        const layout = layouts[index % layouts.length];
        const zoom = interpolate(
          frame,
          [0, Math.max(durationInFrames - 1, 1)],
          [1.06, 1.18],
          clamp,
        );
        const shiftX = interpolate(
          frame,
          [0, Math.max(durationInFrames - 1, 1)],
          [0, layout.driftX],
          clamp,
        );
        const shiftY = interpolate(
          frame,
          [0, Math.max(durationInFrames - 1, 1)],
          [0, layout.driftY],
          clamp,
        );

        return (
          <div
            key={`${src}-${index}`}
            className="coverTile"
            style={{
              top: layout.top,
              left: layout.left,
              width: layout.width,
              height: layout.height,
              zIndex: layout.z,
              opacity: 1,
              transform: `rotate(${layout.rotate}deg)`,
            }}
          >
            <Img
              className="coverTileImg"
              src={assetSrc(src)}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              style={{
                transform: `translate(${shiftX}px, ${shiftY}px) scale(${zoom})`,
              }}
            />
          </div>
        );
      })}
      <AbsoluteFill className="coverBackdropVeil" style={{ zIndex: 2 }} />
      <AbsoluteFill className="coverBackdropGrain" style={{ zIndex: 3 }} />
    </AbsoluteFill>
  );
};

const CoverScene: React.FC<{
  video: WeeklyVideoProps;
  portrait?: boolean;
}> = ({ video, portrait = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const showBottomChrome = frame >= fps;
  const brandSize = portrait ? 32 : 52;
  const issueLabel = `第${video.issueNumber}期`;
  const rawTheme = video.coverTitle.trim();
  const themeTitle =
    rawTheme &&
    stripIssueParen(rawTheme) !== video.headerTitle &&
    rawTheme !== `${video.headerTitle}（第${video.issueNumber}期）`
      ? stripIssueParen(rawTheme).replace(
          new RegExp(`^${video.headerTitle}[：:\\s]*`),
          "",
        ).trim() || rawTheme
      : "";
  const heroTitle = themeTitle || issueLabel;
  const heroSize = fitCoverTitleSize(heroTitle, portrait);

  return (
    <AbsoluteFill className="coverSceneLayout">
      <CoverImageBackdrop cases={video.cases} portrait={portrait} />
      <section className="coverScene">
        <div className="coverMain">
          <div className="coverBrandBlock">
            <p className="coverBrandName" style={{ fontSize: brandSize }}>
              {video.headerTitle.endsWith("精选")
                ? video.headerTitle
                : `${video.headerTitle}-精选`}
            </p>
            <div
              className="coverBrandLine"
              style={{ width: portrait ? 160 : 220 }}
            />
            <div className="coverThemeBlock">
              {themeTitle ? (
                <p
                  className="coverIssueLabel"
                  style={{ fontSize: portrait ? 34 : 56 }}
                >
                  {issueLabel}
                </p>
              ) : null}
              <h1
                className="coverThemeTitle"
                style={{ fontSize: heroSize }}
              >
                {heroTitle}
              </h1>
              <span
                className="coverThemeSub"
                style={{ fontSize: portrait ? 26 : 44 }}
              >
                {video.coverSubtitle}
              </span>
            </div>
          </div>
          {showBottomChrome && video.coverBadge ? (
            <div
              className="coverBadge"
              style={
                portrait
                  ? { fontSize: 28, padding: "16px 20px" }
                  : undefined
              }
            >
              {video.coverBadge}
            </div>
          ) : null}
        </div>
      </section>
      {showBottomChrome ? (
        <SceneSubtitles
          cues={video.introCues}
          fallbackText={video.introSubtitle}
          portrait={portrait}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const stripIssueParen = (text: string) =>
  String(text || "")
    .replace(/[（(]\s*第\s*\d+\s*期\s*[）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();

type ImageShape = "unknown" | "landscape" | "portrait";

const CaseImage: React.FC<{
  item: WeeklyCase;
  imageScale: number;
  imageY: number;
  onShape: (shape: ImageShape) => void;
  onBroken: () => void;
}> = ({ item, imageScale, imageY, onShape, onBroken }) => {
  const src = item.image.trim();

  if (!src) {
    return null;
  }

  const markShape = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) {
      return;
    }
    onShape(
      img.naturalHeight > img.naturalWidth * 1.12 ? "portrait" : "landscape",
    );
  };

  return (
    <>
      <Img
        className="caseImageBg"
        onError={(event) => {
          event.currentTarget.style.display = "none";
          onBroken();
        }}
        onLoad={markShape}
        src={assetSrc(src)}
        style={{
          transform: `translateY(${imageY}px) scale(${imageScale})`,
        }}
      />
      <Img
        className="caseImage"
        onError={(event) => {
          event.currentTarget.style.display = "none";
          onBroken();
        }}
        onLoad={markShape}
        src={assetSrc(src)}
      />
    </>
  );
};

const CaseScene: React.FC<{ item: WeeklyCase; portrait?: boolean }> = ({
  item,
  portrait = false,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = sceneProgress(frame, durationInFrames);
  const imageScale = interpolate(progress, [0, 1], [1.04, 1.01]);
  const imageY = interpolate(progress, [0, 1], [0, -16]);
  const meta = [item.author, item.date].filter(Boolean).join(" · ");
  const hasImageSrc = Boolean(item.image.trim());
  const [imageShape, setImageShape] = useState<ImageShape>("unknown");
  const [imageBroken, setImageBroken] = useState(false);
  const showFallbackOnly = !hasImageSrc || imageBroken;
  const stageClass = [
    "imageStage",
    showFallbackOnly ? "imageStage--empty" : "",
    !showFallbackOnly && imageShape === "portrait" ? "imageStage--portrait" : "",
    !showFallbackOnly && imageShape === "landscape"
      ? "imageStage--landscape"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <AbsoluteFill className="caseSceneLayout">
      <div className="caseImageRegion">
        <div className={stageClass}>
          {!showFallbackOnly ? (
            <CaseImage
              item={item}
              imageScale={imageScale}
              imageY={imageY}
              onShape={setImageShape}
              onBroken={() => setImageBroken(true)}
            />
          ) : null}
          <div
            className={`fallbackPoster${showFallbackOnly ? " fallbackPoster--solo" : ""}`}
            style={{ borderColor: item.color }}
          >
            <span style={{ color: item.color }}>{item.index}</span>
            <strong>{item.fallback || item.title}</strong>
            <small>{item.title}</small>
          </div>
        </div>
      </div>

      <div className="caseMetaStrip">
        <div className="caseIdentity">
          <span style={{ background: item.color }}>{item.index}</span>
          <div className="caseIdentityText">
            <h2 style={{ fontSize: fitCaseTitleSize(item.title, portrait) }}>
              {item.title}
            </h2>
            <p>{meta || "精选内容"}</p>
          </div>
        </div>
        <strong className="caseMetric" style={{ color: item.color }}>
          {item.metric}
        </strong>
      </div>

      <SceneSubtitles
        cues={item.cues}
        fallbackText={item.subtitle}
        portrait={portrait}
      />
    </AbsoluteFill>
  );
};

const ClosingScene: React.FC<{
  video: WeeklyVideoProps;
  portrait?: boolean;
}> = ({ video, portrait = false }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { summary, cta } = splitClosingSummaryAndCta(video.closingSubtitle);
  const summaryText = summary || video.closingSubtitle;
  const ctaText = cta || FIXED_CLOSING_NARRATION;
  const closingSize = fitCoverTitleSize(summaryText, portrait);

  return (
    <AbsoluteFill className="closingSceneLayout">
      <section
        className="closingScene"
        style={{ opacity: fade(frame, 0, durationInFrames) }}
      >
        <p className="closingLabel">{video.closingTitle}</p>
        <h2
          style={{
            fontSize: Math.max(
              portrait ? 40 : 48,
              Math.min(portrait ? 64 : 94, closingSize),
            ),
          }}
        >
          {summaryText}
        </h2>
        <p
          className="closingCta"
          style={portrait ? { fontSize: 26 } : undefined}
        >
          {ctaText}
        </p>
      </section>
      <SceneSubtitles
        cues={video.closingCues}
        fallbackText={video.closingSubtitle}
        portrait={portrait}
      />
    </AbsoluteFill>
  );
};

export const MyComponent: React.FC<WeeklyVideoProps> = (props) => {
  const { width, height } = useVideoConfig();
  const video = normalizeVideoProps(props);
  const format = getVideoFormat(video.aspect);
  const portrait = height > width || format.id === "portrait";
  const template = getVideoTemplate(video.templateId);
  const themedVideo: WeeklyVideoProps = {
    ...video,
    templateId: template.id,
    aspect: format.id,
    cases: video.cases.map((item, index) => ({
      ...item,
      color: template.caseColors[index % template.caseColors.length],
    })),
  };
  const segments = buildSceneSegments(themedVideo);
  const synthesized = hasSynthesizedTimeline(themedVideo);

  return (
    <AbsoluteFill
      className="scene"
      data-template={template.id}
      data-aspect={portrait ? "portrait" : "landscape"}
    >
      {!synthesized && themedVideo.audioSrc ? (
        <Audio src={assetSrc(themedVideo.audioSrc)} volume={0.95} />
      ) : null}
      <AbsoluteFill className="softBackdrop" />
      <Header video={themedVideo} />

      {segments.map((segment) => {
        if (segment.type === "intro") {
          return (
            <Sequence
              key={segment.id}
              from={segment.startFrame}
              durationInFrames={segment.durationFrames}
            >
              {themedVideo.introAudioSrc ? (
                <Audio src={assetSrc(themedVideo.introAudioSrc)} volume={0.95} />
              ) : null}
              <CoverScene video={themedVideo} portrait={portrait} />
            </Sequence>
          );
        }

        if (segment.type === "case" && segment.caseIndex !== undefined) {
          const item = themedVideo.cases[segment.caseIndex];
          return (
            <Sequence
              key={segment.id}
              from={segment.startFrame}
              durationInFrames={segment.durationFrames}
            >
              {item.audioSrc ? (
                <Audio src={assetSrc(item.audioSrc)} volume={0.95} />
              ) : null}
              <CaseScene item={item} portrait={portrait} />
            </Sequence>
          );
        }

        return (
          <Sequence
            key={segment.id}
            from={segment.startFrame}
            durationInFrames={segment.durationFrames}
          >
            {themedVideo.closingAudioSrc ? (
              <Audio src={assetSrc(themedVideo.closingAudioSrc)} volume={0.95} />
            ) : null}
            <ClosingScene video={themedVideo} portrait={portrait} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
