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
import { getVideoFormat, PORTRAIT_CAPTION_INSET } from "./videoFormats";
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

/** Cover H1 size by Chinese/Latin title length. */
export const fitCoverTitleSize = (title: string, portrait = false) => {
  const len = [...title.trim()].length;
  let size = 220;
  if (len <= 6) {
    size = 220;
  } else if (len <= 10) {
    size = 188;
  } else if (len <= 12) {
    size = 168;
  } else if (len <= 14) {
    size = 148;
  } else if (len <= 16) {
    size = 132;
  } else if (len <= 20) {
    size = 118;
  } else {
    size = 104;
  }
  // Portrait can wrap 2 lines — keep size closer to landscape punch.
  return portrait ? Math.round(size * 0.96) : size;
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
  const len = [...text.replace(/\n/g, "").trim()].length;
  if (portrait) {
    if (len <= 16) {
      return 44;
    }
    if (len <= 22) {
      return 40;
    }
    return 38;
  }
  if (len <= 28) {
    return 34;
  }
  if (len <= 48) {
    return 30;
  }
  if (len <= 72) {
    return 26;
  }
  return 24;
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
  const text = getActiveCue(lineCues, sceneMs, "", portrait ? 8 : 4);

  if (!text) {
    return null;
  }

  return (
    <div
      className="sceneSubtitleRegion"
      style={
        portrait
          ? {
              marginLeft: PORTRAIT_CAPTION_INSET.leftPx,
              marginRight: PORTRAIT_CAPTION_INSET.rightPx,
              marginBottom: PORTRAIT_CAPTION_INSET.bottomPx,
            }
          : undefined
      }
    >
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
  const site =
    video.locale === "en" ? "soloez.com" : "ezindie.com";

  return (
    <div className="header">
      <span>
        {video.headerTitle} {site}
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
  z: number;
};

/** Landscape magazine grids — mirrors weekly_cover._COVER_LAYOUTS (16:9). */
const LANDSCAPE_COVER_GRIDS: Record<number, CoverTileLayout[]> = {
  1: [
    {
      top: "0%",
      left: "0%",
      width: "100%",
      height: "100%",
      driftX: 12,
      driftY: -10,
      z: 1,
    },
  ],
  2: [
    {
      top: "4.5%",
      left: "3%",
      width: "54.5%",
      height: "91%",
      driftX: -14,
      driftY: 10,
      z: 2,
    },
    {
      top: "4.5%",
      left: "59.5%",
      width: "37.5%",
      height: "91%",
      driftX: 12,
      driftY: -8,
      z: 1,
    },
  ],
  3: [
    {
      top: "4.5%",
      left: "3%",
      width: "54.5%",
      height: "91%",
      driftX: -12,
      driftY: 10,
      z: 2,
    },
    {
      top: "4.5%",
      left: "59.5%",
      width: "37.5%",
      height: "43.5%",
      driftX: 10,
      driftY: -8,
      z: 1,
    },
    {
      top: "52%",
      left: "59.5%",
      width: "37.5%",
      height: "43.5%",
      driftX: 8,
      driftY: 12,
      z: 1,
    },
  ],
};

/** Portrait magazine grids — axis-swapped for 9:16 (big top + stacked bottom). */
const PORTRAIT_COVER_GRIDS: Record<number, CoverTileLayout[]> = {
  1: [
    {
      top: "0%",
      left: "0%",
      width: "100%",
      height: "100%",
      driftX: 8,
      driftY: -14,
      z: 1,
    },
  ],
  2: [
    {
      top: "3%",
      left: "4%",
      width: "92%",
      height: "45.5%",
      driftX: -8,
      driftY: 10,
      z: 2,
    },
    {
      top: "51%",
      left: "4%",
      width: "92%",
      height: "45.5%",
      driftX: 8,
      driftY: -8,
      z: 1,
    },
  ],
  3: [
    {
      top: "3%",
      left: "4%",
      width: "92%",
      height: "48%",
      driftX: -6,
      driftY: 10,
      z: 2,
    },
    {
      top: "53.5%",
      left: "4%",
      width: "44%",
      height: "43%",
      driftX: -8,
      driftY: 8,
      z: 1,
    },
    {
      top: "53.5%",
      left: "52%",
      width: "44%",
      height: "43%",
      driftX: 8,
      driftY: -6,
      z: 1,
    },
  ],
};

const CoverImageBackdrop: React.FC<{
  images: string[];
  portrait: boolean;
}> = ({ images, portrait }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const urls = images.map((src) => src.trim()).filter(Boolean).slice(0, 3);
  const n = urls.length;
  const grids = portrait ? PORTRAIT_COVER_GRIDS : LANDSCAPE_COVER_GRIDS;
  const layouts = grids[n] || grids[3];

  if (n === 0) {
    return <AbsoluteFill className="coverBackdrop coverBackdrop--empty" />;
  }

  const fullBleed = n === 1;

  return (
    <AbsoluteFill className="coverBackdrop">
      {urls.map((src, index) => {
        const layout = layouts[index % layouts.length];
        const zoom = interpolate(
          frame,
          [0, Math.max(durationInFrames - 1, 1)],
          [1.04, 1.12],
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
            className={
              fullBleed ? "coverTile coverTile--full" : "coverTile coverTile--mag"
            }
            style={{
              top: layout.top,
              left: layout.left,
              width: layout.width,
              height: layout.height,
              zIndex: layout.z,
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
  const isEn = video.locale === "en";
  const issueLabel = isEn
    ? `Issue ${video.issueNumber}`
    : `第${video.issueNumber}期`;
  const brand = isEn
    ? video.headerTitle || "Indie Maker Weekly"
    : video.headerTitle || "独立开发变现周刊";
  const mark = isEn ? "soloez" : "ezindie";
  const footerLabel = `${brand} · ${mark}`;

  const rawTheme = video.coverTitle.trim();
  const themeTitle =
    rawTheme &&
    stripIssueParen(rawTheme) !== brand &&
    rawTheme !== `${brand}（第${video.issueNumber}期）` &&
    rawTheme !== `${brand} (Issue ${video.issueNumber})`
      ? stripIssueParen(rawTheme)
          .replace(new RegExp(`^${brand}[：:\\s]*`), "")
          .trim() || rawTheme
      : "";
  const headline = themeTitle || issueLabel;
  const heroSize = fitCoverTitleSize(headline, portrait);
  const coverImages =
    video.coverImages && video.coverImages.length > 0
      ? video.coverImages
      : video.cases.map((item) => item.image).filter(Boolean).slice(0, 3);

  return (
    <AbsoluteFill className="coverSceneLayout">
      <CoverImageBackdrop images={coverImages} portrait={portrait} />
      <section className="coverScene">
        <div className="coverMain">
          <div className="coverBrandBlock">
            <p
              className="coverIssueLabel"
              style={{ fontSize: portrait ? 38 : 48 }}
            >
              {issueLabel}
            </p>
            <div
              className="coverBrandLine"
              style={{ width: portrait ? 120 : 160 }}
            />
            <div className="coverThemeBlock">
              <h1
                className="coverThemeTitle"
                style={{ fontSize: heroSize }}
              >
                {headline}
              </h1>
              {video.coverSubtitle && video.coverSubtitle !== headline ? (
                <span
                  className="coverThemeSub"
                  style={{ fontSize: portrait ? 38 : 48 }}
                >
                  {video.coverSubtitle}
                </span>
              ) : null}
            </div>
            <p
              className="coverFooterBrand"
              style={{ fontSize: portrait ? 26 : 34 }}
            >
              {footerLabel}
            </p>
          </div>
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

const caseImageSrcs = (item: WeeklyCase) => {
  const seen = new Set<string>();
  const srcs: string[] = [];
  for (const raw of [item.image, ...(item.images || [])]) {
    const src = String(raw || "").trim();
    if (!src || seen.has(src)) {
      continue;
    }
    seen.add(src);
    srcs.push(src);
  }
  return srcs;
};

const CaseImage: React.FC<{
  src: string;
  imageScale: number;
  imageY: number;
  onShape: (shape: ImageShape) => void;
  onBroken: () => void;
}> = ({ src, imageScale, imageY, onShape, onBroken }) => {

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

const CaseScene: React.FC<{
  item: WeeklyCase;
  portrait?: boolean;
  locale?: "zh" | "en";
  durationInFrames: number;
}> = ({ item, portrait = false, durationInFrames }) => {
  const frame = useCurrentFrame();
  const progress = sceneProgress(frame, durationInFrames);
  const imageScale = interpolate(progress, [0, 1], [1.04, 1.01]);
  const imageY = interpolate(progress, [0, 1], [0, -16]);
  const meta = [item.author, item.date]
    .filter((part) => part && part !== "Unknown")
    .join(" · ");
  const images = caseImageSrcs(item);
  const imageIndex =
    images.length <= 1
      ? 0
      : Math.min(
          images.length - 1,
          Math.floor((frame / Math.max(durationInFrames, 1)) * images.length),
        );
  const src = images[imageIndex] || "";
  const hasImageSrc = Boolean(src);
  const [imageShape, setImageShape] = useState<ImageShape>("unknown");
  const [imageBroken, setImageBroken] = useState(false);
  const [shownSrc, setShownSrc] = useState(src);
  if (shownSrc !== src) {
    setShownSrc(src);
    setImageBroken(false);
    setImageShape("unknown");
  }
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
              key={src}
              src={src}
              imageScale={imageScale}
              imageY={imageY}
              onShape={setImageShape}
              onBroken={() => setImageBroken(true)}
            />
          ) : (
            <div
              className="fallbackPoster fallbackPoster--solo"
              style={{ borderColor: item.color }}
            >
              <span style={{ color: item.color }}>{item.index}</span>
              <strong>{item.fallback || item.title}</strong>
              <small>{item.title}</small>
            </div>
          )}
        </div>
      </div>

      <div className="caseMetaStrip">
        <div className="caseIdentity">
          <span style={{ background: item.color }}>{item.index}</span>
          <div className="caseIdentityText">
            <h2 style={{ fontSize: fitCaseTitleSize(item.title, portrait) }}>
              {item.title}
            </h2>
            {meta ? <p>{meta}</p> : null}
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
  const continuous = Boolean(themedVideo.narrationAudioSrc);

  return (
    <AbsoluteFill
      className="scene"
      data-template={template.id}
      data-aspect={portrait ? "portrait" : "landscape"}
    >
      {themedVideo.narrationAudioSrc ? (
        <Audio src={assetSrc(themedVideo.narrationAudioSrc)} volume={0.95} />
      ) : !synthesized && themedVideo.audioSrc ? (
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
              {!continuous && themedVideo.introAudioSrc ? (
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
              {!continuous && item.audioSrc ? (
                <Audio src={assetSrc(item.audioSrc)} volume={0.95} />
              ) : null}
              <CaseScene
                item={item}
                portrait={portrait}
                locale={video.locale}
                durationInFrames={segment.durationFrames}
              />
            </Sequence>
          );
        }

        return (
          <Sequence
            key={segment.id}
            from={segment.startFrame}
            durationInFrames={segment.durationFrames}
          >
            {!continuous && themedVideo.closingAudioSrc ? (
              <Audio src={assetSrc(themedVideo.closingAudioSrc)} volume={0.95} />
            ) : null}
            <ClosingScene video={themedVideo} portrait={portrait} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
