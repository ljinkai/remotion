import { resolveTemplateId } from "./videoTemplates";
import { resolveAspect } from "./videoFormats";

export type SubtitleCue = {
  text: string;
  startMs: number;
  endMs: number;
};

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
  durationMs?: number;
  audioSrc?: string;
  cues?: SubtitleCue[];
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
  /** Visual template id — see videoTemplates.ts */
  templateId?: string;
  /** Output aspect — landscape 16:9 or portrait 9:16 */
  aspect?: string;
  audioSrc?: string;
  useSynthesizedTimeline?: boolean;
  introDurationMs?: number;
  introAudioSrc?: string;
  introCues?: SubtitleCue[];
  closingDurationMs?: number;
  closingAudioSrc?: string;
  closingCues?: SubtitleCue[];
  cases: WeeklyCase[];
};

export const FPS = 30;
export const SCENE_PADDING_MS = 300;
export const SILENT_DURATION_MS = 2000;

export const LEGACY_INTRO_FRAMES = 180;
export const LEGACY_CASE_FRAMES = 270;
export const LEGACY_CLOSING_FRAMES = 150;

export const CASE_COLORS = [
  "#38d6c6",
  "#f6c95f",
  "#ff7b68",
  "#7aa7ff",
  "#b8f36b",
];

export type SceneSegment = {
  id: string;
  type: "intro" | "case" | "closing";
  startFrame: number;
  durationFrames: number;
  caseIndex?: number;
};

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

const normalizeCues = (cues: unknown): SubtitleCue[] | undefined => {
  if (!Array.isArray(cues)) {
    return undefined;
  }
  const normalized = cues
    .map((cue) => {
      if (!cue || typeof cue !== "object") {
        return null;
      }
      const item = cue as Partial<SubtitleCue>;
      const text = typeof item.text === "string" ? item.text.trim() : "";
      const startMs =
        typeof item.startMs === "number" ? Math.max(0, item.startMs) : NaN;
      const endMs =
        typeof item.endMs === "number" ? Math.max(0, item.endMs) : NaN;
      if (!text || Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        return null;
      }
      return { text, startMs, endMs };
    })
    .filter((cue): cue is SubtitleCue => cue !== null);
  return normalized.length > 0 ? normalized : undefined;
};

export const hasSynthesizedTimeline = (props?: Partial<WeeklyVideoProps>) =>
  props?.useSynthesizedTimeline === true;

export const msToFrames = (ms: number) =>
  Math.max(1, Math.ceil((ms / 1000) * FPS));

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
    templateId: resolveTemplateId(source.templateId),
    aspect: resolveAspect(source.aspect),
    useSynthesizedTimeline: source.useSynthesizedTimeline === true,
    introDurationMs:
      typeof source.introDurationMs === "number"
        ? Math.max(0, source.introDurationMs)
        : undefined,
    introAudioSrc:
      typeof source.introAudioSrc === "string"
        ? source.introAudioSrc.trim() || undefined
        : undefined,
    introCues: normalizeCues(source.introCues),
    closingDurationMs:
      typeof source.closingDurationMs === "number"
        ? Math.max(0, source.closingDurationMs)
        : undefined,
    closingAudioSrc:
      typeof source.closingAudioSrc === "string"
        ? source.closingAudioSrc.trim() || undefined
        : undefined,
    closingCues: normalizeCues(source.closingCues),
    audioSrc:
      typeof source.audioSrc === "string"
        ? source.audioSrc.trim() || undefined
        : hasSynthesizedTimeline(source)
          ? undefined
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
      durationMs:
        typeof item.durationMs === "number"
          ? Math.max(0, item.durationMs)
          : undefined,
      audioSrc:
        typeof item.audioSrc === "string"
          ? item.audioSrc.trim() || undefined
          : undefined,
      cues: normalizeCues(item.cues),
    })),
  };
};

const sceneDurationMs = (
  durationMs: number | undefined,
  legacyFrames: number,
  synthesized: boolean,
) => {
  if (synthesized) {
    return (durationMs ?? SILENT_DURATION_MS) + SCENE_PADDING_MS;
  }
  return (legacyFrames / FPS) * 1000;
};

export const getDurationInFrames = (props?: Partial<WeeklyVideoProps>) => {
  const video = normalizeVideoProps(props);
  const synthesized = hasSynthesizedTimeline(video);

  if (synthesized) {
    let totalMs = sceneDurationMs(
      video.introDurationMs,
      LEGACY_INTRO_FRAMES,
      true,
    );
    for (const item of video.cases) {
      totalMs += sceneDurationMs(item.durationMs, LEGACY_CASE_FRAMES, true);
    }
    totalMs += sceneDurationMs(
      video.closingDurationMs,
      LEGACY_CLOSING_FRAMES,
      true,
    );
    return msToFrames(totalMs);
  }

  return (
    LEGACY_INTRO_FRAMES +
    video.cases.length * LEGACY_CASE_FRAMES +
    LEGACY_CLOSING_FRAMES
  );
};

export const buildTimeline = (props?: Partial<WeeklyVideoProps>) => {
  const video = normalizeVideoProps(props);
  const synthesized = hasSynthesizedTimeline(video);
  const timeline = [0];

  const pushScene = (durationMs: number | undefined, legacyFrames: number) => {
    const ms = sceneDurationMs(durationMs, legacyFrames, synthesized);
    timeline.push(timeline[timeline.length - 1] + msToFrames(ms));
  };

  pushScene(video.introDurationMs, LEGACY_INTRO_FRAMES);
  for (const item of video.cases) {
    pushScene(item.durationMs, LEGACY_CASE_FRAMES);
  }
  pushScene(video.closingDurationMs, LEGACY_CLOSING_FRAMES);

  return timeline;
};

export const buildSceneSegments = (
  props?: Partial<WeeklyVideoProps>,
): SceneSegment[] => {
  const video = normalizeVideoProps(props);
  const timeline = buildTimeline(video);
  const segments: SceneSegment[] = [];

  segments.push({
    id: "intro",
    type: "intro",
    startFrame: timeline[0],
    durationFrames: timeline[1] - timeline[0],
  });

  for (let i = 0; i < video.cases.length; i += 1) {
    segments.push({
      id: `case-${video.cases[i].index}`,
      type: "case",
      caseIndex: i,
      startFrame: timeline[i + 1],
      durationFrames: timeline[i + 2] - timeline[i + 1],
    });
  }

  const closingStart = timeline[timeline.length - 2];
  const closingEnd = timeline[timeline.length - 1];
  segments.push({
    id: "closing",
    type: "closing",
    startFrame: closingStart,
    durationFrames: closingEnd - closingStart,
  });

  return segments;
};

export type CueTimelineEntry = {
  id: string;
  sceneId: string;
  sceneLabel: string;
  sceneType: "intro" | "case" | "closing";
  cueIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  globalStartFrame: number;
  globalEndFrame: number;
  globalStartMs: number;
  globalEndMs: number;
};

export const formatCueMs = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }
  return `${seconds}.${String(millis).padStart(3, "0")}s`;
};

export const buildCueTimeline = (
  props?: Partial<WeeklyVideoProps>,
): CueTimelineEntry[] => {
  const video = normalizeVideoProps(props);
  const segments = buildSceneSegments(video);
  const entries: CueTimelineEntry[] = [];

  for (const segment of segments) {
    let sceneLabel = "";
    let cues: SubtitleCue[] | undefined;
    let fallbackText = "";
    let sceneDurationMs = (segment.durationFrames / FPS) * 1000;

    if (segment.type === "intro") {
      sceneLabel = "封面 / 导语";
      cues = video.introCues;
      fallbackText = video.introSubtitle;
      if (video.introDurationMs) {
        sceneDurationMs = video.introDurationMs + SCENE_PADDING_MS;
      }
    } else if (segment.type === "closing") {
      sceneLabel = "结尾";
      cues = video.closingCues;
      fallbackText = video.closingSubtitle;
      if (video.closingDurationMs) {
        sceneDurationMs = video.closingDurationMs + SCENE_PADDING_MS;
      }
    } else if (segment.caseIndex !== undefined) {
      const item = video.cases[segment.caseIndex];
      sceneLabel = `案例 ${item.index} · ${item.title}`;
      cues = item.cues;
      fallbackText = item.subtitle;
      if (item.durationMs) {
        sceneDurationMs = item.durationMs + SCENE_PADDING_MS;
      }
    }

    const sceneStartMs = (segment.startFrame / FPS) * 1000;
    const normalizedCues =
      cues && cues.length > 0
        ? cues
        : fallbackText.trim()
          ? [{ text: fallbackText.trim(), startMs: 0, endMs: sceneDurationMs }]
          : [];

    normalizedCues.forEach((cue, cueIndex) => {
      const globalStartMs = sceneStartMs + cue.startMs;
      const globalEndMs = sceneStartMs + cue.endMs;
      entries.push({
        id: `${segment.id}-${cueIndex}`,
        sceneId: segment.id,
        sceneLabel,
        sceneType: segment.type,
        cueIndex,
        text: cue.text,
        startMs: cue.startMs,
        endMs: cue.endMs,
        globalStartFrame: msToFrames(globalStartMs),
        globalEndFrame: msToFrames(globalEndMs),
        globalStartMs,
        globalEndMs,
      });
    });
  }

  return entries;
};

export const getActiveCueTimelineEntry = (
  entries: CueTimelineEntry[],
  globalFrame: number,
  fps: number = FPS,
): CueTimelineEntry | null => {
  const globalMs = (globalFrame / fps) * 1000;
  return (
    entries.find(
      (entry) => globalMs >= entry.globalStartMs && globalMs < entry.globalEndMs,
    ) ?? null
  );
};

export const getActiveCue = (
  cues: SubtitleCue[] | undefined,
  sceneMs: number,
  fallbackText: string,
): string => {
  const singleLine = (value: string) =>
    String(value || "")
      .split(/\n+/)
      .map((item) => item.trim())
      .find(Boolean) || "";

  if (!cues || cues.length === 0) {
    return singleLine(fallbackText);
  }
  const active = cues.find(
    (cue) => sceneMs >= cue.startMs && sceneMs < cue.endMs,
  );
  if (active) {
    return singleLine(active.text);
  }
  const last = cues[cues.length - 1];
  if (sceneMs >= last.endMs) {
    return singleLine(last.text);
  }
  return singleLine(cues[0]?.text || fallbackText);
};
