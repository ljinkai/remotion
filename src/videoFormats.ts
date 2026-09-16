export type VideoAspect = "landscape" | "portrait";

export type VideoFormat = {
  id: VideoAspect;
  label: string;
  blurb: string;
  compositionId: string;
  width: number;
  height: number;
};

export const DEFAULT_ASPECT: VideoAspect = "landscape";

export const VIDEO_FORMATS: VideoFormat[] = [
  {
    id: "landscape",
    label: "横屏 16:9",
    blurb: "1920×1080 · B 站 / YouTube",
    compositionId: "IndieWeeklyMarkdown",
    width: 1920,
    height: 1080,
  },
  {
    id: "portrait",
    label: "竖屏 9:16",
    blurb: "1080×1920 · 短视频 / 手机",
    compositionId: "IndieWeeklyMarkdownPortrait",
    width: 1080,
    height: 1920,
  },
];

export const isVideoAspect = (value: unknown): value is VideoAspect =>
  value === "landscape" || value === "portrait";

export const resolveAspect = (value?: string | null): VideoAspect =>
  isVideoAspect(value) ? value : DEFAULT_ASPECT;

export const getVideoFormat = (value?: string | null): VideoFormat => {
  const id = resolveAspect(value);
  return VIDEO_FORMATS.find((item) => item.id === id) ?? VIDEO_FORMATS[0];
};
