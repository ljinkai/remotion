import { assignBeatTiming, enrichBeatScenes } from "./beat-spec.mjs";

export const HOST_BEATS_CACHE_KEY = "remotion-host-beats-cache-v1";

export const hostBeatsContentKey = (markdown, locale, script) =>
  JSON.stringify([locale || "zh", String(markdown || ""), script || null]);

export const restoreHostBeats = (cache, contentKey) => {
  if (cache?.contentKey !== contentKey || !Array.isArray(cache?.beats)) {
    return null;
  }
  return cache.beats.length > 0 &&
    cache.beats.every(
      (beat) =>
        beat && typeof beat.say === "string" && Array.isArray(beat.elements),
    )
    ? cache.beats
    : null;
};

/** Preview and export share the exact same retimed beats; samples stay preview-only. */
export const hostWorkflowState = (props, beats, sampleProps) => {
  const canRender = Array.isArray(beats) && beats.length > 0;
  const timedBeats = canRender ? assignBeatTiming(enrichBeatScenes(beats, props), props) : [];
  return {
    canRender,
    isSample: !canRender,
    previewProps: canRender
      ? { ...props, beats: timedBeats, aspect: "portrait" }
      : { ...sampleProps, aspect: "portrait" },
  };
};
