import {
  CASE_COLORS,
  defaultVideoProps,
  type WeeklyCase,
  type WeeklyVideoProps,
} from "./videoData";
import type { NarrationScript } from "./narrationScript";
import {
  appendFixedClosingCta,
  normalizeVideoLocale,
  type VideoLocale,
} from "./narrationScript";
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

/** Match italic meta lines like `*@handle · 2026/09/13*` from weekly MD. */
const AUTHOR_META_LINE =
  /^\*{1,2}\s*@([A-Za-z0-9._]+)\s*(?:[·•|]\s*([^*=\n]+?))?\s*\*{1,2}$/;
const AUTHOR_PLAIN_LINE =
  /^@([A-Za-z0-9._]+)\s*(?:[·•|]\s*([^\n]+))?$/;

const isAuthorMetaLine = (line: string) => {
  const cleaned = line.trim();
  return AUTHOR_META_LINE.test(cleaned) || AUTHOR_PLAIN_LINE.test(cleaned);
};

const parseAuthorMetaLine = (lines: string[]) => {
  for (const line of lines) {
    const cleaned = line.trim();
    const match =
      cleaned.match(AUTHOR_META_LINE) || cleaned.match(AUTHOR_PLAIN_LINE);
    if (!match) {
      continue;
    }
    const author = `@${match[1]}`;
    const date = strip(match[2] || "")
      .replace(/\*{1,2}$/g, "")
      .trim();
    return { author, date };
  }
  return { author: "", date: "" };
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
    .filter((line) => !isAuthorMetaLine(line))
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
  const zh = title.match(/第\s*(\d+)\s*期/);
  if (zh) {
    return zh[1];
  }
  const en = title.match(/Issue\s+#?\s*(\d+)/i);
  return en ? en[1] : defaultVideoProps.issueNumber;
};

const stripIssueParen = (text: string) =>
  String(text || "")
    .replace(/[（(]\s*第\s*\d+\s*期\s*[）)]/g, "")
    .replace(/\(\s*Issue\s+#?\s*\d+\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const isBrandLikeTitle = (text: string, headerTitle: string) => {
  const cleaned = stripIssueParen(text);
  if (!cleaned) {
    return true;
  }
  return (
    cleaned === headerTitle ||
    cleaned === "独立开发变现周刊" ||
    cleaned === "独立开发周刊" ||
    cleaned === "Indie Maker Weekly"
  );
};

/** Theme line under the issue headline — never the brand/issue title itself. */
const parseCoverTitle = (title: string, meta: Record<string, string>) => {
  const headerTitle = meta.header || defaultVideoProps.headerTitle;
  if (meta.theme && !isBrandLikeTitle(meta.theme, headerTitle)) {
    return meta.theme.trim();
  }
  const parts = title.split(/[：:]/);
  if (parts.length > 1) {
    const theme = parts.slice(1).join("：").trim();
    if (theme && !isBrandLikeTitle(theme, headerTitle)) {
      return theme;
    }
  }
  return "";
};

const isClosingSection = (title: string) =>
  /总结|结尾|closing|takeaway|in one line/i.test(title);

const resolveParseLocale = (
  meta: Record<string, string>,
  optionsLocale?: string | null,
): VideoLocale => {
  if (optionsLocale != null && String(optionsLocale).trim() !== "") {
    return normalizeVideoLocale(optionsLocale);
  }
  return normalizeVideoLocale(meta.locale);
};

export type ParseMarkdownOptions = {
  locale?: string | null;
};

export const parseMarkdownToVideo = (
  markdown: string,
  options: ParseMarkdownOptions = {},
): WeeklyVideoProps => {
  const source = markdown.trim() ? markdown : sampleMarkdown;
  const { meta, body } = parseFrontmatter(source);
  const locale = resolveParseLocale(meta, options.locale);
  const isEn = locale === "en";
  const { h1, intro, sections } = splitSections(body);
  const contentSections = sections.filter(
    (section) => !isClosingSection(section.title),
  );
  const closing = sections.find((section) => isClosingSection(section.title));

  const metricFallback = isEn ? "Featured" : "精选";
  const headerDefault = isEn ? "Indie Maker Weekly" : defaultVideoProps.headerTitle;
  const closingTitleDefault = isEn ? "Takeaway" : defaultVideoProps.closingTitle;

  const cases: WeeklyCase[] = contentSections.map((section, index) => {
    const text = bodyText(section.body);
    const title = section.title || (isEn ? `Item ${index + 1}` : `条目 ${index + 1}`);
    const fallback = fieldValue(section.body, ["标签", "tag", "fallback"]) || title;
    const narration =
      fieldValue(section.body, ["旁白", "narration"]) ||
      fieldValue(section.body, ["副标题", "subtitle"]) ||
      firstSentence(text, title);
    const metaFromLine = parseAuthorMetaLine(section.body);

    return {
      index: String(index + 1).padStart(2, "0"),
      title,
      author:
        fieldValue(section.body, ["作者", "author"]) ||
        metaFromLine.author ||
        "Unknown",
      date:
        fieldValue(section.body, ["日期", "date"]) || metaFromLine.date || "",
      metric:
        fieldValue(section.body, ["指标", "metric"]) || metricFallback,
      image: firstImage(section.body),
      fallback,
      subtitle: narration,
      sourceBody: text || undefined,
      color: CASE_COLORS[index % CASE_COLORS.length],
    };
  });

  const title = h1 || headerDefault;
  const coverTitle = parseCoverTitle(title, meta);
  const introText = bodyText(intro);
  const introFallback = isEn
    ? `This issue of Indie Maker Weekly focuses on ${coverTitle || "indie makers"}.`
    : `这期${defaultVideoProps.headerTitle}，主线是${coverTitle}。`;
  const introNarration =
    fieldValue(intro, ["旁白", "narration"]) ||
    firstSentence(introText, introFallback);
  const closingBody = closing ? closing.body : [];
  const closingText = bodyText(closingBody);
  const closingFallback = isEn
    ? "Growth is doing one thing deeply, not everything lightly."
    : defaultVideoProps.closingSubtitle;
  const closingNarration = appendFixedClosingCta(
    fieldValue(closingBody, ["旁白", "narration"]) ||
      (closing
        ? firstSentence(closingText, closingFallback)
        : closingFallback),
    locale,
  );

  const coverSubtitleDefault = isEn
    ? `${cases.length || 5} indie picks`
    : `${cases.length || defaultVideoProps.cases.length} 个独立开发精选`;

  return {
    issueNumber: parseIssueNumber(title, meta),
    headerTitle: meta.header || headerDefault,
    coverTitle,
    coverSubtitle: meta.subtitle || coverSubtitleDefault,
    coverBadge:
      meta.badge ||
      cases.find((item) => item.metric !== metricFallback)?.metric ||
      (isEn ? "Featured" : defaultVideoProps.coverBadge),
    introSubtitle: introNarration,
    introSourceBody: introText || undefined,
    closingTitle: closing?.title || closingTitleDefault,
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
  options: ParseMarkdownOptions = {},
): NarrationScript | null => {
  const source = markdown.trim();
  if (!source) {
    return null;
  }
  const { meta, body } = parseFrontmatter(source);
  const locale = resolveParseLocale(meta, options.locale);
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
    closing: optimizeNarrationForSubtitles(
      appendFixedClosingCta(closingNarration, locale),
    ),
    source: "markdown",
  };
};
