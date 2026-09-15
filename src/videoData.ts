export type WeeklyCase = {
  index: string;
  title: string;
  author: string;
  date: string;
  metric: string;
  image: string;
  fallback: string;
  subtitle: string;
  color: string;
};

export type WeeklyVideoProps = {
  issueNumber: string;
  headerTitle: string;
  coverTitle: string;
  coverSubtitle: string;
  coverBadge: string;
  introSubtitle: string;
  closingTitle: string;
  closingSubtitle: string;
  ticker: string;
  audioSrc?: string;
  cases: WeeklyCase[];
};

export const CASE_COLORS = [
  "#38d6c6",
  "#f6c95f",
  "#ff7b68",
  "#7aa7ff",
  "#b8f36b",
];

export const defaultVideoProps: WeeklyVideoProps = {
  issueNumber: "156",
  headerTitle: "独立开发变现周刊",
  coverTitle: "单渠道突破法",
  coverSubtitle: "5 个独立开发案例",
  coverBadge: "400万美元年收",
  introSubtitle: "这期独立开发变现周刊，主线是单渠道突破法。",
  closingTitle: "一句话总结",
  closingSubtitle: "增长不是做更多动作，而是把一个动作做透。",
  ticker: "Indie Dev  Product  Revenue  Distribution  SaaS  Open Source",
  audioSrc: "narration.wav",
  cases: [
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
      subtitle:
        "第二条，Honey Traffic。AI 时代内容更多，关键词研究反而更刚需。",
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
      subtitle:
        "第四条，Clipur。真正有价值的流量，会进入交易，而不是只停在曝光。",
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
  ],
};

const clean = (value: unknown, fallback: string) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

export const normalizeVideoProps = (
  props?: Partial<WeeklyVideoProps>,
): WeeklyVideoProps => {
  const source = props ?? {};
  const cases =
    Array.isArray(source.cases) && source.cases.length > 0
      ? source.cases
      : defaultVideoProps.cases;

  return {
    issueNumber: clean(source.issueNumber, defaultVideoProps.issueNumber),
    headerTitle: clean(source.headerTitle, defaultVideoProps.headerTitle),
    coverTitle: clean(source.coverTitle, defaultVideoProps.coverTitle),
    coverSubtitle: clean(
      source.coverSubtitle,
      `${cases.length} 个独立开发案例`,
    ),
    coverBadge: clean(source.coverBadge, defaultVideoProps.coverBadge),
    introSubtitle: clean(source.introSubtitle, defaultVideoProps.introSubtitle),
    closingTitle: clean(source.closingTitle, defaultVideoProps.closingTitle),
    closingSubtitle: clean(
      source.closingSubtitle,
      defaultVideoProps.closingSubtitle,
    ),
    ticker: clean(source.ticker, defaultVideoProps.ticker),
    audioSrc:
      typeof source.audioSrc === "string"
        ? source.audioSrc.trim()
        : defaultVideoProps.audioSrc,
    cases: cases.map((item, index) => ({
      index: clean(item.index, String(index + 1).padStart(2, "0")),
      title: clean(item.title, `条目 ${index + 1}`),
      author: clean(item.author, "Unknown"),
      date: clean(item.date, ""),
      metric: clean(item.metric, "精选"),
      image: clean(item.image, ""),
      fallback: clean(item.fallback, item.title || `条目 ${index + 1}`),
      subtitle: clean(item.subtitle, item.title || `第 ${index + 1} 条内容`),
      color: clean(item.color, CASE_COLORS[index % CASE_COLORS.length]),
    })),
  };
};

export const getDurationInFrames = (props?: Partial<WeeklyVideoProps>) => {
  const video = normalizeVideoProps(props);
  return 180 + video.cases.length * 270 + 150;
};

export const buildTimeline = (props?: Partial<WeeklyVideoProps>) => {
  const video = normalizeVideoProps(props);
  const timeline = [0, 180];
  for (let i = 0; i < video.cases.length; i += 1) {
    timeline.push(180 + (i + 1) * 270);
  }
  timeline.push(timeline[timeline.length - 1] + 150);
  return timeline;
};
