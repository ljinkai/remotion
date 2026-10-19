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
  | { type: "image"; src: string; caption?: string }
  | { type: "phone"; title: string; body: string; action?: string }
  | { type: "card"; title: string; lines?: string[]; bars?: number[] }
  | { type: "icon"; name: HostIconName }
  | { type: "svg"; markup: string };

export type HostBeat = {
  say: string;
  section: "intro" | "case" | "closing";
  caseIndex: number | null;
  headline: string;
  accent: string;
  host: "point" | "cheer";
  elements: HostElement[];
  startMs: number;
  endMs: number;
};

export type HostCaseRef = {
  index?: string;
  title?: string;
};

export type HostExplainerProps = {
  beats?: HostBeat[];
  cases?: HostCaseRef[];
  narrationAudioSrc?: string;
};

export const HOST_FPS = 30;

export const hostDurationInFrames = (
  beats?: HostBeat[],
  fps = HOST_FPS,
) => {
  if (!beats || beats.length === 0) {
    return 120;
  }
  const end = Math.max(...beats.map((beat) => Number(beat.endMs) || 0));
  return Math.max(1, Math.round((end / 1000) * fps));
};

export const sampleHostProps: HostExplainerProps = {
  cases: [{ index: "01", title: "甲板笔记" }],
  beats: [
    {
      say: "这款一个月能到一万二。",
      section: "case",
      caseIndex: 0,
      headline: "一个月 $12,000",
      accent: "$12,000",
      host: "cheer",
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
      startMs: 4000,
      endMs: 8000,
      elements: [
        { type: "phone", title: "本周上线", body: "甲板笔记", action: "打开" },
      ],
    },
  ],
};
