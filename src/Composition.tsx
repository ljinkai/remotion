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

type Props = {};

const calculateMetadata: CalculateMetadataFunction<Props> = () => {
  return {};
};

export const MyComposition = () => {
  return (
    <Composition
      id="IndieWeekly156"
      component={MyComponent}
      durationInFrames={1680}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={calculateMetadata}
    />
  );
};

const cases = [
  {
    index: "01",
    title: "小众产品重启记",
    author: "@farrux_hewson",
    date: "2026/09/02",
    metric: "3个月",
    image: "case-images/01-farrux.png",
    fallback: "真实流量",
    subtitle: "第一条，小众产品重启。很多项目不是没机会，而是死在太早放弃。",
    color: "#38d6c6",
  },
  {
    index: "02",
    title: "Honey Traffic",
    author: "@PashaBorsai",
    date: "2026/09/05",
    metric: "$5k MRR",
    image: "case-images/02-honey-traffic.png",
    fallback: "SEO Pipeline",
    subtitle: "第二条，Honey Traffic。AI 时代内容更多，关键词研究反而更刚需。",
    color: "#f6c95f",
  },
  {
    index: "03",
    title: "GojiberryAI",
    author: "@Dylan_txa_",
    date: "2026/09/03",
    metric: "$4M ARR",
    image: "case-images/03-gojiberryai.png",
    fallback: "单渠道突破",
    subtitle: "第三条，GojiberryAI。核心不是全渠道铺开，而是先打透一个渠道。",
    color: "#ff7b68",
  },
  {
    index: "04",
    title: "Clipur",
    author: "@youfadedwealth",
    date: "2026/09/05",
    metric: "5-10%",
    image: "case-images/04-clipur.png",
    fallback: "交易闭环",
    subtitle: "第四条，Clipur。真正有价值的流量，会进入交易，而不是只停在曝光。",
    color: "#7aa7ff",
  },
  {
    index: "05",
    title: "vorssaint-utils",
    author: "GitHub",
    date: "Open source",
    metric: "macOS Kit",
    image: "case-images/05-vorssaint-utils.png",
    fallback: "菜单栏工具包",
    subtitle: "第五条，vorssaint-utils。高频入口里的小工具，依然有开源机会。",
    color: "#b8f36b",
  },
];

const timeline = [0, 180, 450, 720, 990, 1260, 1530, 1680];
const subtitles = [
  {
    start: 0,
    end: 180,
    text: "这期独立开发变现周刊，主线是单渠道突破法。",
  },
  ...cases.map((item, index) => ({
    start: timeline[index + 1],
    end: timeline[index + 2],
    text: item.subtitle,
  })),
  {
    start: 1530,
    end: 1680,
    text: "最后记住三点：先打透一个渠道，盯成交质量，把脏活做成壁垒。",
  },
];

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const fade = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, start + 22, end - 24, end], [0, 1, 1, 0], clamp);

const sceneProgress = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], clamp);

const Subtitle: React.FC = () => {
  const frame = useCurrentFrame();
  const active = subtitles.find((subtitle) => frame >= subtitle.start && frame < subtitle.end);

  if (!active) {
    return null;
  }

  return (
    <div className="subtitleBar" style={{ opacity: fade(frame, active.start, active.end) }}>
      {active.text}
    </div>
  );
};

const Header: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 100], clamp);

  return (
    <div className="header">
      <span>独立开发变现周刊</span>
      <strong>156</strong>
      <div className="progressTrack">
        <div className="progressFill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

const Cover: React.FC = () => {
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
        <p>第156期</p>
        <h1>单渠道突破法</h1>
        <span>5 个独立开发案例</span>
      </div>
      <div className="coverBadge">400万美元年收</div>
    </section>
  );
};

const CaseScene: React.FC<{
  item: (typeof cases)[number];
  start: number;
  end: number;
}> = ({ item, start, end }) => {
  const frame = useCurrentFrame();
  const progress = sceneProgress(frame, start, end);
  const imageScale = interpolate(progress, [0, 1], [1.06, 1.015]);
  const imageY = interpolate(progress, [0, 1], [0, -28]);

  return (
    <section className="caseScene" style={{ opacity: fade(frame, start, end) }}>
      <div className="imageStage">
        <Img
          className="caseImageBg"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          src={staticFile(item.image)}
          style={{
            transform: `translateY(${imageY}px) scale(${imageScale})`,
          }}
        />
        <Img
          className="caseImage"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          src={staticFile(item.image)}
        />
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
            <p>
              {item.author} · {item.date}
            </p>
          </div>
        </div>
        <strong style={{ color: item.color }}>{item.metric}</strong>
      </div>
    </section>
  );
};

const Closing: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <section className="closingScene" style={{ opacity: fade(frame, timeline[6], timeline[7]) }}>
      <p>一句话总结</p>
      <h2>增长不是做更多动作，而是把一个动作做透。</h2>
    </section>
  );
};

export const MyComponent: React.FC<Props> = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill className="scene">
      <Audio src={staticFile("narration.wav")} volume={0.95} />
      <AbsoluteFill className="softBackdrop" />
      <Header />
      <Cover />
      {cases.map((item, index) => (
        <CaseScene item={item} start={timeline[index + 1]} end={timeline[index + 2]} key={item.title} />
      ))}
      <Closing />
      <Subtitle />
      <div className="ticker" style={{ transform: `translateX(${interpolate(frame, [0, 1680], [0, -640])}px)` }}>
        Indie Dev  Product  Revenue  Distribution  SaaS  Open Source
      </div>
    </AbsoluteFill>
  );
};
