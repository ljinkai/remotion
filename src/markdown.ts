import {
  CASE_COLORS,
  defaultVideoProps,
  type WeeklyCase,
  type WeeklyVideoProps,
} from "./videoData";
import type { NarrationScript } from "./narrationScript";
import { optimizeNarrationForSubtitles } from "./subtitleLines";

export const sampleMarkdown = `---
issue: 156
theme: 单渠道突破法
badge: 400万美元年收
ticker: Indie Dev  Product  Revenue  Distribution  SaaS  Open Source
audio: narration.wav
---

# 独立开发变现周刊（第156期）：单渠道突破法

这期独立开发变现周刊，主线是单渠道突破法。

## 小众产品重启记

作者：@farrux_hewson
日期：2026/09/02
指标：3个月
图片：case-images/01-farrux.png
标签：真实流量

第一条，小众产品重启。很多项目不是没机会，而是死在太早放弃。

## Honey Traffic

作者：@PashaBorsai
日期：2026/09/05
指标：$5k MRR
图片：case-images/02-honey-traffic.png
标签：SEO Pipeline

第二条，Honey Traffic。AI 时代内容更多，关键词研究反而更刚需。

## GojiberryAI

作者：@Dylan_txa_
日期：2026/09/03
指标：$4M ARR
图片：case-images/03-gojiberryai.png
标签：单渠道突破

第三条，GojiberryAI。核心不是全渠道铺开，而是先打透一个渠道。

## Clipur

作者：@youfadedwealth
日期：2026/09/05
指标：5-10%
图片：case-images/04-clipur.png
标签：交易闭环

第四条，Clipur。真正有价值的流量，会进入交易，而不是只停在曝光。

## vorssaint-utils

作者：GitHub
日期：Open source
指标：macOS Kit
图片：case-images/05-vorssaint-utils.png
标签：菜单栏工具包

第五条，vorssaint-utils。高频入口里的小工具，依然有开源机会。

## 一句话总结

增长不是做更多动作，而是把一个动作做透。`;

type Section = {
  title: string;
  body: string[];
};

const strip = (value: string) => value.replace(/^["']|["']$/g, "").trim();

const parseFrontmatter = (markdown: string) => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") {
    return { meta: {} as Record<string, string>, body: markdown };
  }

  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (end === -1) {
    return { meta: {} as Record<string, string>, body: markdown };
  }

  const meta: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    if (match) {
      meta[match[1].toLowerCase()] = strip(match[2]);
    }
  }

  return { meta, body: lines.slice(end + 1).join("\n") };
};

const splitSections = (body: string) => {
  const lines = body.split("\n");
  const intro: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  let h1 = "";

  for (const line of lines) {
    const heading1 = line.match(/^#\s+(.+)$/);
    if (heading1) {
      h1 = strip(heading1[1]);
      continue;
    }

    const heading2 = line.match(/^##\s+(.+)$/);
    if (heading2) {
      current = { title: strip(heading2[1]), body: [] };
      sections.push(current);
      continue;
    }

    if (current) {
      current.body.push(line);
    } else {
      intro.push(line);
    }
  }

  return { h1, intro, sections };
};

const fieldValue = (lines: string[], names: string[]) => {
  for (const line of lines) {
    const cleaned = line.replace(/^[-*]\s*/, "").trim();
    for (const name of names) {
      const match = cleaned.match(
        new RegExp(`^(?:${name})\\s*[:：]\\s*(.+)$`, "i"),
      );
      if (match) {
        return strip(match[1]);
      }
    }
  }
  return "";
};

const firstImage = (lines: string[]) => {
  const fromField = fieldValue(lines, ["图片", "image", "img"]);
  if (fromField) {
    return fromField;
  }

  for (const line of lines) {
    const image = line.match(/!\[[^\]]*]\(([^)]+)\)/);
    if (image) {
      return strip(image[1]);
    }
  }
  return "";
};

const bodyText = (lines: string[]) =>
  lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("!"))
    .filter(
      (line) =>
        !/^[-*]?\s*(作者|author|日期|date|指标|metric|图片|image|img|标签|fallback|副标题|subtitle|旁白|narration)\s*[:：]/i.test(
          line,
        ),
    )
    .join("\n")
    .trim();

const firstSentence = (text: string, fallback: string) => {
  const plain = text
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) {
    return fallback;
  }
  const sentence = plain.split(/[。！？!?\n]/)[0]?.trim() || plain;
  return sentence.length > 72 ? `${sentence.slice(0, 72)}…` : sentence;
};

const parseIssueNumber = (title: string, meta: Record<string, string>) => {
  if (meta.issue) {
    return meta.issue;
  }
  const match = title.match(/第\s*(\d+)\s*期/);
  return match ? match[1] : defaultVideoProps.issueNumber;
};

const parseCoverTitle = (title: string, meta: Record<string, string>) => {
  if (meta.theme) {
    return meta.theme;
  }
  const parts = title.split(/[：:]/);
  if (parts.length > 1) {
    return parts.slice(1).join("：").trim();
  }
  return title || defaultVideoProps.coverTitle;
};

const isClosingSection = (title: string) =>
  /总结|结尾|closing|takeaway/i.test(title);

export const parseMarkdownToVideo = (markdown: string): WeeklyVideoProps => {
  const source = markdown.trim() ? markdown : sampleMarkdown;
  const { meta, body } = parseFrontmatter(source);
  const { h1, intro, sections } = splitSections(body);
  const contentSections = sections.filter(
    (section) => !isClosingSection(section.title),
  );
  const closing = sections.find((section) => isClosingSection(section.title));

  const cases: WeeklyCase[] = contentSections.map((section, index) => {
    const text = bodyText(section.body);
    const title = section.title || `条目 ${index + 1}`;
    const fallback = fieldValue(section.body, ["标签", "fallback"]) || title;
    const narration =
      fieldValue(section.body, ["旁白", "narration"]) ||
      fieldValue(section.body, ["副标题", "subtitle"]) ||
      firstSentence(text, title);

    return {
      index: String(index + 1).padStart(2, "0"),
      title,
      author: fieldValue(section.body, ["作者", "author"]) || "Unknown",
      date: fieldValue(section.body, ["日期", "date"]) || "",
      metric: fieldValue(section.body, ["指标", "metric"]) || "精选",
      image: firstImage(section.body),
      fallback,
      subtitle: narration,
      sourceBody: text || undefined,
      color: CASE_COLORS[index % CASE_COLORS.length],
    };
  });

  const title = h1 || defaultVideoProps.headerTitle;
  const coverTitle = parseCoverTitle(title, meta);
  const introText = bodyText(intro);
  const introNarration =
    fieldValue(intro, ["旁白", "narration"]) ||
    firstSentence(
      introText,
      `这期${defaultVideoProps.headerTitle}，主线是${coverTitle}。`,
    );
  const closingBody = closing ? closing.body : [];
  const closingText = bodyText(closingBody);
  const closingNarration =
    fieldValue(closingBody, ["旁白", "narration"]) ||
    (closing
      ? firstSentence(closingText, defaultVideoProps.closingSubtitle)
      : defaultVideoProps.closingSubtitle);

  return {
    issueNumber: parseIssueNumber(title, meta),
    headerTitle: meta.header || defaultVideoProps.headerTitle,
    coverTitle,
    coverSubtitle:
      meta.subtitle ||
      `${cases.length || defaultVideoProps.cases.length} 个独立开发案例`,
    coverBadge:
      meta.badge ||
      cases.find((item) => item.metric !== "精选")?.metric ||
      defaultVideoProps.coverBadge,
    introSubtitle: introNarration,
    introSourceBody: introText || undefined,
    closingTitle: closing?.title || defaultVideoProps.closingTitle,
    closingSubtitle: closingNarration,
    closingSourceBody: closingText || undefined,
    ticker: meta.ticker || defaultVideoProps.ticker,
    audioSrc: meta.audio || "",
    cases: cases.length > 0 ? cases : defaultVideoProps.cases,
  };
};

/** Build a narration script only from explicit 旁白/narration fields. */
export const tryBuildScriptFromMarkdown = (
  markdown: string,
): NarrationScript | null => {
  const source = markdown.trim();
  if (!source) {
    return null;
  }
  const { body } = parseFrontmatter(source);
  const { intro, sections } = splitSections(body);
  const contentSections = sections.filter(
    (section) => !isClosingSection(section.title),
  );
  const closing = sections.find((section) => isClosingSection(section.title));

  const introNarration = fieldValue(intro, ["旁白", "narration"]);
  const closingNarration = closing
    ? fieldValue(closing.body, ["旁白", "narration"])
    : "";
  if (!introNarration || !closingNarration || contentSections.length === 0) {
    return null;
  }

  const cases = contentSections.map((section, index) => {
    const narration = fieldValue(section.body, ["旁白", "narration"]);
    return {
      index: String(index + 1).padStart(2, "0"),
      title: section.title || `条目 ${index + 1}`,
      narration: optimizeNarrationForSubtitles(narration || ""),
    };
  });

  if (cases.some((item) => !item.narration)) {
    return null;
  }

  return {
    intro: optimizeNarrationForSubtitles(introNarration),
    cases,
    closing: optimizeNarrationForSubtitles(closingNarration),
    source: "markdown",
  };
};
