export type HostPose = "point" | "cheer";

export type DemoBeat = {
  id: string;
  startFrame: number;
  chapter: string;
  progressLabel: string;
  progressValue: string;
  headline: string;
  accent: string;
  checklistIndex: number;
  pose: HostPose;
  subtitle: string;
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const BEAT_FRAMES = 150;
export const DURATION_IN_FRAMES = 450;

export const CHECKLIST_TITLE = "// 怎么读一条案例";
export const CHECKLIST_ITEMS = ["01  产品页", "02  收入", "03  打开看"];

export const BEATS: DemoBeat[] = [
  {
    id: "products",
    startFrame: 0,
    chapter: "// 01 – 产品页",
    progressLabel: "信号 ",
    progressValue: "1/3",
    headline: "先看它的产品长什么样",
    accent: "产品",
    checklistIndex: 0,
    pose: "point",
    subtitle: "先看产品页，知道它在卖什么。",
  },
  {
    id: "revenue",
    startFrame: 150,
    chapter: "// 02 – 收入",
    progressLabel: "信号 ",
    progressValue: "2/3",
    headline: "再看它一个月能到 $12,000",
    accent: "$12,000",
    checklistIndex: 1,
    pose: "cheer",
    subtitle: "再看收入，这款一个月一万二。",
  },
  {
    id: "phone",
    startFrame: 300,
    chapter: "// 03 – 打开看",
    progressLabel: "信号 ",
    progressValue: "3/3",
    headline: "最后打开手机，功能就在首屏",
    accent: "首屏",
    checklistIndex: 2,
    pose: "point",
    subtitle: "最后打开手机，功能就在首屏。",
  },
];

export const getBeatIndex = (frame: number) =>
  Math.min(Math.floor(frame / BEAT_FRAMES), BEATS.length - 1);

export const getLocalFrame = (frame: number) => {
  const beat = BEATS[getBeatIndex(frame)];
  return frame - beat.startFrame;
};
