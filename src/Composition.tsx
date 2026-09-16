import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";
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

const calculateMetadata: CalculateMetadataFunction<WeeklyVideoProps> = ({
  props,
}) => {
  return {
    durationInFrames: getDurationInFrames(props),
  };
};

export const MyComposition = () => {
  return (
    <Composition
      id="IndieWeeklyMarkdown"
      component={MyComponent}
      durationInFrames={getDurationInFrames(defaultVideoProps)}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={defaultVideoProps}
      calculateMetadata={calculateMetadata}
    />
  );
};

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const fade = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, start + 22, end - 24, end], [0, 1, 1, 0], clamp);

const sceneProgress = (frame: number, durationFrames: number) =>
  interpolate(frame, [0, Math.max(durationFrames - 1, 1)], [0, 1], clamp);

export const assetSrc = (src: string) => {
  if (/^(https?:|data:|blob:|\/)/.test(src)) {
    return src;
  }
  if (
    typeof window !== "undefined" &&
    (src.startsWith(".generated/") || src.startsWith("case-images/"))
  ) {
    return `/${src}`;
  }
  return staticFile(src);
};

const SceneSubtitles: React.FC<{
  cues?: SubtitleCue[];
  fallbackText: string;
}> = ({ cues, fallbackText }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneMs = (frame / fps) * 1000;
  const text = getActiveCue(cues, sceneMs, fallbackText);

  if (!text) {
    return null;
  }

  return (
    <div className="sceneSubtitleRegion">
      <p className="sceneSubtitleText">{text}</p>
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
      <span>{video.headerTitle}</span>
      <strong>{video.issueNumber}</strong>
      <div className="progressTrack">
        <div className="progressFill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

const CoverScene: React.FC<{ video: WeeklyVideoProps }> = ({ video }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });

  return (
    <AbsoluteFill className="coverSceneLayout">
      <section
        className="coverScene"
        style={{ opacity: fade(frame, 0, durationInFrames) }}
      >
        <div
          className="coverTitle"
          style={{
            transform: `translateY(${interpolate(entrance, [0, 1], [48, 0])}px)`,
          }}
        >
          <p>第{video.issueNumber}期</p>
          <h1>{video.coverTitle}</h1>
          <span>{video.coverSubtitle}</span>
        </div>
        <div className="coverBadge">{video.coverBadge}</div>
      </section>
      <SceneSubtitles cues={video.introCues} fallbackText={video.introSubtitle} />
    </AbsoluteFill>
  );
};

const CaseImage: React.FC<{
  item: WeeklyCase;
  imageScale: number;
  imageY: number;
}> = ({ item, imageScale, imageY }) => {
  const src = item.image.trim();

  if (!src) {
    return null;
  }

  return (
    <>
      <Img
        className="caseImageBg"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        src={assetSrc(src)}
        style={{
          transform: `translateY(${imageY}px) scale(${imageScale})`,
        }}
      />
      <Img
        className="caseImage"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        src={assetSrc(src)}
      />
    </>
  );
};

const CaseScene: React.FC<{ item: WeeklyCase }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = sceneProgress(frame, durationInFrames);
  const imageScale = interpolate(progress, [0, 1], [1.04, 1.01]);
  const imageY = interpolate(progress, [0, 1], [0, -16]);
  const meta = [item.author, item.date].filter(Boolean).join(" · ");

  return (
    <AbsoluteFill className="caseSceneLayout">
      <div className="caseImageRegion">
        <div className="imageStage">
          <CaseImage item={item} imageScale={imageScale} imageY={imageY} />
          <div className="fallbackPoster" style={{ borderColor: item.color }}>
            <span style={{ color: item.color }}>{item.index}</span>
            <strong>{item.fallback}</strong>
            <small>{item.title}</small>
          </div>
        </div>
      </div>

      <div className="caseMetaStrip">
        <div className="caseIdentity">
          <span style={{ background: item.color }}>{item.index}</span>
          <div>
            <h2>{item.title}</h2>
            <p>{meta || "精选内容"}</p>
          </div>
        </div>
        <strong style={{ color: item.color }}>{item.metric}</strong>
      </div>

      <SceneSubtitles cues={item.cues} fallbackText={item.subtitle} />
    </AbsoluteFill>
  );
};

const ClosingScene: React.FC<{ video: WeeklyVideoProps }> = ({ video }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill className="closingSceneLayout">
      <section
        className="closingScene"
        style={{ opacity: fade(frame, 0, durationInFrames) }}
      >
        <p>{video.closingTitle}</p>
        <h2>{video.closingSubtitle}</h2>
      </section>
      <SceneSubtitles
        cues={video.closingCues}
        fallbackText={video.closingSubtitle}
      />
    </AbsoluteFill>
  );
};

export const MyComponent: React.FC<WeeklyVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const video = normalizeVideoProps(props);
  const segments = buildSceneSegments(video);
  const duration = getDurationInFrames(video);
  const synthesized = hasSynthesizedTimeline(video);

  return (
    <AbsoluteFill className="scene">
      {!synthesized && video.audioSrc ? (
        <Audio src={assetSrc(video.audioSrc)} volume={0.95} />
      ) : null}
      <AbsoluteFill className="softBackdrop" />
      <Header video={video} />

      {segments.map((segment) => {
        if (segment.type === "intro") {
          return (
            <Sequence
              key={segment.id}
              from={segment.startFrame}
              durationInFrames={segment.durationFrames}
            >
              {video.introAudioSrc ? (
                <Audio src={assetSrc(video.introAudioSrc)} volume={0.95} />
              ) : null}
              <CoverScene video={video} />
            </Sequence>
          );
        }

        if (segment.type === "case" && segment.caseIndex !== undefined) {
          const item = video.cases[segment.caseIndex];
          return (
            <Sequence
              key={segment.id}
              from={segment.startFrame}
              durationInFrames={segment.durationFrames}
            >
              {item.audioSrc ? (
                <Audio src={assetSrc(item.audioSrc)} volume={0.95} />
              ) : null}
              <CaseScene item={item} />
            </Sequence>
          );
        }

        return (
          <Sequence
            key={segment.id}
            from={segment.startFrame}
            durationInFrames={segment.durationFrames}
          >
            {video.closingAudioSrc ? (
              <Audio src={assetSrc(video.closingAudioSrc)} volume={0.95} />
            ) : null}
            <ClosingScene video={video} />
          </Sequence>
        );
      })}

      <div
        className="ticker"
        style={{
          transform: `translateX(${interpolate(frame, [0, duration], [0, -640])}px)`,
        }}
      >
        {video.ticker}
      </div>
    </AbsoluteFill>
  );
};
