import type { WeeklyVideoProps } from "./videoData";
import { normalizeVideoProps } from "./videoData";
import { optimizeNarrationForSubtitles } from "./subtitleLines";

/** Fixed CTA appended after the thematic closing summary (zh). */
export const FIXED_CLOSING_NARRATION = "觉得有用就关注一下，我们下周见！";

/** Fixed CTA for English weekly videos. */
export const FIXED_CLOSING_NARRATION_EN =
  "If this was useful, follow for more — see you next week.";

export type VideoLocale = "zh" | "en";

export const normalizeVideoLocale = (locale?: string | null): VideoLocale =>
  String(locale || "")
    .trim()
    .toLowerCase() === "en"
    ? "en"
    : "zh";

export const fixedClosingCtaForLocale = (locale?: string | null) =>
  normalizeVideoLocale(locale) === "en"
    ? FIXED_CLOSING_NARRATION_EN
    : FIXED_CLOSING_NARRATION;

export type NarrationScriptCase = {
  index: string;
  title: string;
  narration: string;
};

export type NarrationScript = {
  intro: string;
  cases: NarrationScriptCase[];
  closing: string;
  source: "ai" | "manual" | "markdown";
};

/** Keep the summary, then append the fixed CTA if missing. */
export const appendFixedClosingCta = (
  closing: string,
  locale?: string | null,
) => {
  const base = String(closing || "").trim();
  const cta = fixedClosingCtaForLocale(locale);
  const zhCta = FIXED_CLOSING_NARRATION;
  const enCta = FIXED_CLOSING_NARRATION_EN;
  if (!base) {
    return cta;
  }
  if (
    base.includes(cta) ||
    base.includes(zhCta) ||
    base.includes(enCta) ||
    base.includes("我们下周见") ||
    /see you next week/i.test(base)
  ) {
    return base;
  }
  return `${base}\n${cta}`;
};

/** Split closing text into thematic summary + fixed CTA for layout. */
export const splitClosingSummaryAndCta = (
  closing: string,
  locale?: string | null,
) => {
  const full = String(closing || "").trim();
  const defaultCta = fixedClosingCtaForLocale(locale);
  if (!full) {
    return { summary: "", cta: defaultCta };
  }

  for (const cta of [FIXED_CLOSING_NARRATION_EN, FIXED_CLOSING_NARRATION]) {
    const ctaIndex = full.indexOf(cta);
    if (ctaIndex >= 0) {
      return {
        summary: full.slice(0, ctaIndex).trim(),
        cta,
      };
    }
  }

  const softZh = full.indexOf("我们下周见");
  if (softZh >= 0) {
    const lineStart = full.lastIndexOf("\n", softZh);
    const cut = lineStart >= 0 ? lineStart : softZh;
    const summary = full.slice(0, cut).trim();
    const cta = full.slice(cut).trim() || FIXED_CLOSING_NARRATION;
    return { summary, cta };
  }

  const softEn = full.search(/see you next week/i);
  if (softEn >= 0) {
    const lineStart = full.lastIndexOf("\n", softEn);
    const cut = lineStart >= 0 ? lineStart : softEn;
    const summary = full.slice(0, cut).trim();
    const cta = full.slice(cut).trim() || FIXED_CLOSING_NARRATION_EN;
    return { summary, cta };
  }

  return { summary: full, cta: "" };
};

export const buildScriptFromProps = (
  props: WeeklyVideoProps,
  source: NarrationScript["source"] = "manual",
  locale?: string | null,
): NarrationScript => {
  const video = normalizeVideoProps(props);
  return {
    intro: video.introSubtitle.trim(),
    cases: video.cases.map((item) => ({
      index: item.index,
      title: item.title,
      narration: item.subtitle.trim(),
    })),
    closing: appendFixedClosingCta(video.closingSubtitle, locale),
    source,
  };
};

export const applyNarrationScript = (
  props: WeeklyVideoProps,
  script: NarrationScript,
  locale?: string | null,
): WeeklyVideoProps => {
  const video = normalizeVideoProps(props);
  const cases = video.cases.map((item, index) => {
    const narration =
      script.cases.find((entry) => entry.index === item.index)?.narration ??
      script.cases[index]?.narration ??
      item.subtitle;
    return {
      ...item,
      subtitle:
        optimizeNarrationForSubtitles(narration) ||
        narration.trim() ||
        item.subtitle,
    };
  });

  const closing = appendFixedClosingCta(script.closing, locale);

  return {
    ...video,
    introSubtitle:
      optimizeNarrationForSubtitles(script.intro) ||
      script.intro.trim() ||
      video.introSubtitle,
    closingSubtitle: optimizeNarrationForSubtitles(closing) || closing,
    cases,
  };
};

export const scriptIsComplete = (script: NarrationScript | null | undefined) => {
  if (!script) {
    return false;
  }
  if (!script.intro.trim() || !script.closing.trim()) {
    return false;
  }
  if (!Array.isArray(script.cases) || script.cases.length === 0) {
    return false;
  }
  return script.cases.every((item) => item.narration.trim().length > 0);
};
