export const DEFAULT_TEMPLATE_ID = "midnight";

export type VideoTemplateId =
  | "midnight"
  | "noir"
  | "ocean"
  | "ember"
  | "studio";

export type VideoTemplate = {
  id: VideoTemplateId;
  label: string;
  blurb: string;
  caseColors: string[];
};

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: "midnight",
    label: "Midnight",
    blurb: "深色青绿 · 现默认风格",
    caseColors: ["#38d6c6", "#f6c95f", "#ff7b68", "#7aa7ff", "#b8f36b"],
  },
  {
    id: "noir",
    label: "Noir",
    blurb: "高对比黑金 · 杂志感",
    caseColors: ["#e8c547", "#f5f5f5", "#c9a227", "#b0b0b0", "#d4af37"],
  },
  {
    id: "ocean",
    label: "Ocean",
    blurb: "深蓝冰蓝 · 冷静科技",
    caseColors: ["#5ec8ff", "#7ad7c5", "#8aa4ff", "#4fd1c5", "#93c5fd"],
  },
  {
    id: "ember",
    label: "Ember",
    blurb: "暖橙炭黑 · 更强冲击",
    caseColors: ["#ff8a5b", "#ffc857", "#ff6b6b", "#f4a261", "#e9c46a"],
  },
  {
    id: "studio",
    label: "Studio",
    blurb: "扁平深灰 · 干净面板",
    caseColors: ["#64d2ff", "#a78bfa", "#34d399", "#fbbf24", "#fb7185"],
  },
];

export const isVideoTemplateId = (value: unknown): value is VideoTemplateId =>
  typeof value === "string" &&
  VIDEO_TEMPLATES.some((item) => item.id === value);

export const resolveTemplateId = (value?: string | null): VideoTemplateId =>
  isVideoTemplateId(value) ? value : DEFAULT_TEMPLATE_ID;

export const getVideoTemplate = (value?: string | null): VideoTemplate => {
  const id = resolveTemplateId(value);
  return VIDEO_TEMPLATES.find((item) => item.id === id) ?? VIDEO_TEMPLATES[0];
};
