import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from "remotion";
import {
  buildTimeline,
  defaultVideoProps,
  getDurationInFrames,
  normalizeVideoProps,
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

const sceneProgress = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], clamp);

const assetSrc = (src: string) => {
  if (/^(https?:|data:|blob:)/.test(src)) {
    return src;
  }
  return staticFile(src);
};

const Subtitle: React.FC<{ video: WeeklyVideoProps; timeline: number[] }> = ({
  video,
  timeline,
}) => {
  const frame = useCurrentFrame();
  const subtitles = [
    {
      start: timeline[0],
      end: timeline[1],
      text: video.introSubtitle,
    },
    ...video.cases.map((item, index) => ({
      start: timeline[index + 1],
      end: timeline[index + 2],
      text: item.subtitle,
    })),
    {
      start: timeline[timeline.length - 2],
      end: timeline[timeline.length - 1],
      text: video.closingSubtitle,
    },
  ];
  const active = subtitles.find(
    (subtitle) => frame >= subtitle.start && frame < subtitle.end,
  );

  if (!active) {
    return null;
  }

  return (
    <div
      className="subtitleBar"
      style={{ opacity: fade(frame, active.start, active.end) }}
    >
      {active.text}
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

const Cover: React.FC<{ video: WeeklyVideoProps; timeline: number[] }> = ({
  video,
  timeline,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });

  return (
    <section
      className="coverScene"
      style={{
        opacity: fade(frame, timeline[0], timeline[1]),
      }}
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

const CaseScene: React.FC<{
  item: WeeklyCase;
  start: number;
  end: number;
}> = ({ item, start, end }) => {
  const frame = useCurrentFrame();
  const progress = sceneProgress(frame, start, end);
  const imageScale = interpolate(progress, [0, 1], [1.06, 1.015]);
  const imageY = interpolate(progress, [0, 1], [0, -28]);
  const meta = [item.author, item.date].filter(Boolean).join(" · ");

  return (
    <section className="caseScene" style={{ opacity: fade(frame, start, end) }}>
      <div className="imageStage">
        <CaseImage item={item} imageScale={imageScale} imageY={imageY} />
        <div className="fallbackPoster" style={{ borderColor: item.color }}>
          <span style={{ color: item.color }}>{item.index}</span>
          <strong>{item.fallback}</strong>
          <small>{item.title}</small>
        </div>
        <div className="imageOverlay" />
      </div>

      <div className="caseCaption">
        <div className="caseIdentity">
          <span style={{ background: item.color }}>{item.index}</span>
          <div>
            <h2>{item.title}</h2>
            <p>{meta || "精选内容"}</p>
          </div>
        </div>
        <strong style={{ color: item.color }}>{item.metric}</strong>
      </div>
    </section>
  );
};

const Closing: React.FC<{ video: WeeklyVideoProps; timeline: number[] }> = ({
  video,
  timeline,
}) => {
  const frame = useCurrentFrame();

  return (
    <section
      className="closingScene"
      style={{
        opacity: fade(
          frame,
          timeline[timeline.length - 2],
          timeline[timeline.length - 1],
        ),
      }}
    >
      <p>{video.closingTitle}</p>
      <h2>{video.closingSubtitle}</h2>
    </section>
  );
};

export const MyComponent: React.FC<WeeklyVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const video = normalizeVideoProps(props);
  const timeline = buildTimeline(video);
  const duration = timeline[timeline.length - 1];

  return (
    <AbsoluteFill className="scene">
      {video.audioSrc ? (
        <Audio src={assetSrc(video.audioSrc)} volume={0.95} />
      ) : null}
      <AbsoluteFill className="softBackdrop" />
      <Header video={video} />
      <Cover video={video} timeline={timeline} />
      {video.cases.map((item, index) => (
        <CaseScene
          item={item}
          start={timeline[index + 1]}
          end={timeline[index + 2]}
          key={item.index}
        />
      ))}
      <Closing video={video} timeline={timeline} />
      <Subtitle video={video} timeline={timeline} />
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
