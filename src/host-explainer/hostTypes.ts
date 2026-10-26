export type HostIconName =
  | "chart"
  | "phone"
  | "coin"
  | "user"
  | "arrow"
  | "check"
  | "wave";

export type HostElement =
  | { type: "text"; text: string; size: "m" | "l" | "xl" }
  | { type: "bar"; label: string; to: number; max?: number; note?: string }
  | {
      type: "image";
      src: string;
      caption?: string;
      focus?: {
        x: number;
        y: number;
        width: number;
        height: number;
        label?: string;
      };
    }
  | {
      type: "chart";
      chartType: "milestones" | "comparison" | "proportion" | "single";
      title: string;
      unit: string;
      data: { label: string; value: number; display?: string; note?: string }[];
      source?: string;
    }
  | {
      type: "relationship";
      title: string;
      nodes: string[];
      focus?: number;
      mode: "focus" | "flow";
    }
  | { type: "phone"; title: string; body: string; action?: string }
  | { type: "card"; title: string; lines?: string[]; bars?: number[] }
  | {
      type: "explanation";
      layout: "flow" | "features" | "contrast" | "spotlight";
      title: string;
      items: { label: string; detail?: string }[];
    }
  | { type: "icon"; name: HostIconName }
  | { type: "svg"; markup: string };

export type HostSceneType =
  | "product"
  | "metric"
  | "steps"
  | "statement"
  | "relationship";

export type HostBeat = {
  say: string;
  section: "intro" | "case" | "closing";
  caseIndex: number | null;
  headline: string;
  accent: string;
  host: "point" | "cheer";
  scene?: HostSceneType;
  elements: HostElement[];
  startMs: number;
  endMs: number;
};

export type HostCaseRef = {
  index?: string;
  title?: string;
};

export type HostExplainerProps = {
  locale?: "zh" | "en";
  beats?: HostBeat[];
  cases?: HostCaseRef[];
  narrationAudioSrc?: string;
};

export const HOST_FPS = 30;

export const hostDurationInFrames = (beats?: HostBeat[], fps = HOST_FPS) => {
  if (!beats || beats.length === 0) {
    return 120;
  }
  const end = Math.max(...beats.map((beat) => Number(beat.endMs) || 0));
  return Math.max(1, Math.round((end / 1000) * fps));
};

export const sampleHostProps: HostExplainerProps = {
  cases: [
    { index: "01", title: "甲板笔记（演示）" },
    { index: "02", title: "Farrux 的制作记录" },
  ],
  beats: [
    {
      say: "这款一个月能到一万二。",
      section: "case",
      caseIndex: 0,
      headline: "一个月 $12,000",
      accent: "$12,000",
      host: "cheer",
      scene: "metric",
      startMs: 0,
      endMs: 4000,
      elements: [
        { type: "bar", label: "每月", to: 12000, note: "上月 $2,400" },
        { type: "text", text: "$12,000", size: "xl" },
      ],
    },
    {
      say: "打开手机就能看到产品页。",
      section: "case",
      caseIndex: 0,
      headline: "打开就能看",
      accent: "打开",
      host: "point",
      scene: "steps",
      startMs: 4000,
      endMs: 8000,
      elements: [
        {
          type: "phone",
          title: "甲板笔记（演示）",
          body: "打开手机",
          action: "查看产品页",
        },
      ],
    },
    {
      say: "Farrux 分享了持续打磨产品的记录。",
      section: "case",
      caseIndex: 1,
      headline: "持续打磨自己的产品",
      accent: "持续打磨",
      host: "point",
      scene: "product",
      startMs: 8000,
      endMs: 12000,
      elements: [
        {
          type: "image",
          src: "case-images/01-farrux.png",
          caption: "Farrux 原文截图",
        },
        {
          type: "card",
          title: "制作记录",
          lines: ["专注打磨已做出的产品", "至少坚持两到三个月"],
        },
      ],
    },
    {
      say: "最难的，是日复一日地坚持。",
      section: "closing",
      caseIndex: null,
      headline: "日复一日地坚持",
      accent: "坚持",
      host: "point",
      scene: "statement",
      startMs: 12000,
      endMs: 16000,
      elements: [
        {
          type: "card",
          title: "从制作记录得到的启发",
          lines: ["专注现有产品", "持续投入", "日复一日地坚持"],
        },
      ],
    },
  ],
};

/** English preview fixture only; never replaces generated user beats. */
export const enSampleHostProps: HostExplainerProps = {
  locale: "en",
  cases: [
    { index: "01", title: "Deck Notes (demo)" },
    { index: "02", title: "Farrux's build log" },
  ],
  beats: [
    {
      say: "This demo product reports twelve thousand dollars in monthly revenue.",
      section: "case",
      caseIndex: 0,
      headline: "$12,000 per month",
      accent: "$12,000",
      host: "cheer",
      scene: "metric",
      startMs: 0,
      endMs: 4000,
      elements: [
        {
          type: "bar",
          label: "Monthly revenue",
          to: 12000,
          note: "Previous month: $2,400",
        },
        { type: "text", text: "$12,000", size: "xl" },
      ],
    },
    {
      say: "Open the app on your phone to view the product page.",
      section: "case",
      caseIndex: 0,
      headline: "Open the product page",
      accent: "Open",
      host: "point",
      scene: "steps",
      startMs: 4000,
      endMs: 8000,
      elements: [
        {
          type: "phone",
          title: "Deck Notes (demo)",
          body: "Open the app",
          action: "View the product page",
        },
      ],
    },
    {
      say: "Farrux shared a record of consistently improving an existing product.",
      section: "case",
      caseIndex: 1,
      headline: "Keep improving your product",
      accent: "improving",
      host: "point",
      scene: "product",
      startMs: 8000,
      endMs: 12000,
      elements: [
        {
          type: "image",
          src: "case-images/01-farrux.png",
          caption: "Farrux — original source",
        },
        {
          type: "card",
          title: "Build log",
          lines: [
            "Focus on the product already built",
            "Keep working for two to three months",
          ],
        },
      ],
    },
    {
      say: "The hardest part is showing up and doing the work every day.",
      section: "closing",
      caseIndex: null,
      headline: "Keep showing up every day",
      accent: "every day",
      host: "point",
      scene: "statement",
      startMs: 12000,
      endMs: 16000,
      elements: [
        {
          type: "card",
          title: "Lessons from the build log",
          lines: [
            "Focus on the existing product",
            "Keep investing effort",
            "Show up every day",
          ],
        },
      ],
    },
  ],
};
