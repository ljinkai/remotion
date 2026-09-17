import type { WeeklyVideoProps } from "./videoData";
import { normalizeVideoProps } from "./videoData";
import { optimizeNarrationForSubtitles } from "./subtitleLines";

/** Fixed CTA appended after the thematic「一句话总结」. */
export const FIXED_CLOSING_NARRATION = "觉得有用就关注一下，我们下周见！";

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
export const appendFixedClosingCta = (closing: string) => {
  const base = String(closing || "").trim();
  const cta = FIXED_CLOSING_NARRATION;
  if (!base) {
    return cta;
  }
  if (base.includes(cta) || base.includes("我们下周见")) {
    return base;
  }
  return `${base}\n${cta}`;
};

/** Split closing text into thematic summary + fixed CTA for layout. */
export const splitClosingSummaryAndCta = (closing: string) => {
  const full = String(closing || "").trim();
  if (!full) {
    return { summary: "", cta: FIXED_CLOSING_NARRATION };
  }

  const ctaIndex = full.indexOf(FIXED_CLOSING_NARRATION);
  if (ctaIndex >= 0) {
    return {
      summary: full.slice(0, ctaIndex).trim(),
      cta: FIXED_CLOSING_NARRATION,
    };
  }

  const softIndex = full.indexOf("我们下周见");
  if (softIndex >= 0) {
    // Prefer splitting at the start of the CTA sentence when possible.
    const lineStart = full.lastIndexOf("\n", softIndex);
    const cut = lineStart >= 0 ? lineStart : softIndex;
    const summary = full.slice(0, cut).trim();
    const cta = full.slice(cut).trim() || FIXED_CLOSING_NARRATION;
    return { summary, cta };
  }

  return { summary: full, cta: "" };
};

export const buildScriptFromProps = (
  props: WeeklyVideoProps,
  source: NarrationScript["source"] = "manual",
): NarrationScript => {
  const video = normalizeVideoProps(props);
  return {
    intro: video.introSubtitle.trim(),
    cases: video.cases.map((item) => ({
      index: item.index,
      title: item.title,
      narration: item.subtitle.trim(),
    })),
    closing: appendFixedClosingCta(video.closingSubtitle),
    source,
  };
};

export const applyNarrationScript = (
  props: WeeklyVideoProps,
  script: NarrationScript,
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

  const closing = appendFixedClosingCta(script.closing);

  return {
    ...video,
    introSubtitle:
      optimizeNarrationForSubtitles(script.intro) ||
      script.intro.trim() ||
      video.introSubtitle,
    closingSubtitle:
      optimizeNarrationForSubtitles(closing) || closing,
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
