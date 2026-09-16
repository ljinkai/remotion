import type { WeeklyVideoProps } from "./videoData";
import { normalizeVideoProps } from "./videoData";

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
    closing: video.closingSubtitle.trim(),
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
      subtitle: narration.trim() || item.subtitle,
    };
  });

  return {
    ...video,
    introSubtitle: script.intro.trim() || video.introSubtitle,
    closingSubtitle: script.closing.trim() || video.closingSubtitle,
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
