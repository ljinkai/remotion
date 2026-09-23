import type { WeeklyVideoProps } from "./videoData";

export type XhsPublishCopy = {
  title: string;
  body: string;
  tags: string;
  /** Title + body + tags, ready to paste into Xiaohongshu caption. */
  full: string;
};

const DEFAULT_TAGS = [
  "独立开发",
  "indiehackers",
  "产品变现",
  "SaaS",
  "开源",
  "副业",
  "独立开发变现周刊",
  "程序员副业",
];

const trimLine = (value: string) => String(value || "").replace(/\s+/g, " ").trim();

const caseBullet = (title: string, index: number) => {
  const cleaned = trimLine(title)
    .replace(/^\d+[、.．]\s*/, "")
    .trim();
  return cleaned ? `• ${cleaned}` : `• 精选 ${String(index).padStart(2, "0")}`;
};

/**
 * Build Xiaohongshu-ready title / caption / tags from current video props.
 * Pure client-side helper — no platform API.
 */
export const buildXhsPublishCopy = (
  props: WeeklyVideoProps,
): XhsPublishCopy => {
  const issue = trimLine(props.issueNumber) || "";
  const theme =
    trimLine(props.coverTitle) ||
    trimLine(props.coverBadge) ||
    "独立开发精选";
  const count = props.cases?.length || 0;

  const title = trimLine(
    issue
      ? `独立开发变现周刊第${issue}期｜${theme}`
      : `独立开发变现周刊｜${theme}`,
  ).slice(0, 40);

  const bullets = (props.cases || [])
    .slice(0, 6)
    .map((item, index) => caseBullet(item.title, index + 1));

  const bodyLines = [
    `这期独立开发精选${count ? `（${count} 条）` : ""}：`,
    ...bullets,
    "",
    "关注 ezindie，每周五更新独立开发变现案例。",
  ];

  const tags = DEFAULT_TAGS.map((tag) => `#${tag}`).join(" ");
  const body = bodyLines.join("\n").trim();
  const full = `${title}\n\n${body}\n\n${tags}`;

  return { title, body, tags, full };
};
