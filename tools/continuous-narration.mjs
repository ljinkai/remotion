import {
  buildTimedSubtitleCues,
  narrationForSpeech,
} from "./subtitle-lines.mjs";

export const SCENE_BREAK_MS = 400;
export const SILENT_DURATION_MS = 2000;
export const SSML_MAX_BYTES = 60000;

const sceneText = (value) => String(value || "").trim();

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const isPunctuationEvent = (text) =>
  /^[。！？!?，、；;：:\s]+$/u.test(String(text || "").trim());

export const buildNarrationPlan = (props) => {
  const locale = props?.locale === "en" ? "en" : "zh";
  const rawScenes = [
    { id: "intro", text: sceneText(props?.introSubtitle) },
    ...(Array.isArray(props?.cases) ? props.cases : []).map((item, index) => ({
      id: `case-${index}`,
      text: sceneText(item?.subtitle),
    })),
    { id: "closing", text: sceneText(props?.closingSubtitle) },
  ];

  return {
    locale,
    scenes: rawScenes.map((scene) => ({
      ...scene,
      speakText: narrationForSpeech(scene.text),
    })),
  };
};

export const planHasSpeech = (plan) =>
  plan.scenes.some((scene) => String(scene.speakText || "").trim());

export const buildNarrationSsml = (plan, { voice }) => {
  const lang = plan.locale === "en" ? "en-US" : "zh-CN";
  const parts = [];
  plan.scenes.forEach((scene, index) => {
    parts.push(`<bookmark mark="${scene.id}"/>`);
    if (scene.speakText) {
      parts.push(escapeXml(scene.speakText));
      if (index < plan.scenes.length - 1) {
        parts.push(`<break time="${SCENE_BREAK_MS}ms"/>`);
      }
      return;
    }
    parts.push(`<break time="${SILENT_DURATION_MS}ms"/>`);
  });

  const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${escapeXml(voice)}">${parts.join("")}</voice></speak>`;
  if (Buffer.byteLength(ssml, "utf8") > SSML_MAX_BYTES) {
    throw new Error(`口播稿过长，SSML 超过 ${SSML_MAX_BYTES} 字节`);
  }
  return ssml;
};

export const rebaseWordOffsets = (speakText, words, sceneStartMs = 0) => {
  const spoken = String(speakText || "");
  let cursor = 0;
  const rebased = [];

  for (const event of words || []) {
    const token = String(event?.text || "").trim();
    if (!token || isPunctuationEvent(token)) {
      continue;
    }
    const index = spoken.indexOf(token, cursor);
    if (index < 0) {
      continue;
    }
    rebased.push({
      ...event,
      text: token,
      textOffset: index,
      wordLength: token.length,
      audioOffsetMs: Math.max(0, Number(event.audioOffsetMs) - sceneStartMs),
    });
    cursor = index + token.length;
  }

  return rebased;
};

export const assignSceneTimings = ({
  scenes,
  bookmarks,
  boundaries,
  audioDurationMs,
}) => {
  const offsets = new Map(
    (bookmarks || []).map((bookmark) => [
      bookmark.name,
      Number(bookmark.audioOffsetMs),
    ]),
  );
  const ordered = scenes.map((scene) => {
    if (!offsets.has(scene.id) || !Number.isFinite(offsets.get(scene.id))) {
      throw new Error(`缺少场景 bookmark：${scene.id}`);
    }
    return { ...scene, startMs: offsets.get(scene.id) };
  });

  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].startMs < ordered[index - 1].startMs) {
      throw new Error(`场景 bookmark 乱序：${ordered[index].id}`);
    }
  }

  const total = Number(audioDurationMs);
  return ordered.map((scene, index) => {
    const endMs = index === ordered.length - 1 ? total : ordered[index + 1].startMs;
    const durationMs = endMs - scene.startMs;
    if (!Number.isFinite(durationMs) || durationMs < 200) {
      throw new Error(`场景时长过短：${scene.id}`);
    }
    const windowWords = (boundaries || []).filter((word) => {
      const at = Number(word?.audioOffsetMs);
      return at >= scene.startMs && at < endMs;
    });
    const cues = scene.speakText
      ? buildTimedSubtitleCues(
          scene.text,
          durationMs,
          rebaseWordOffsets(scene.speakText, windowWords, scene.startMs),
        )
      : [];
    return {
      id: scene.id,
      startMs: scene.startMs,
      durationMs,
      cues,
    };
  });
};

/** Cumulative frame bounds. Keep in sync with src/videoData.ts. */
export const continuousTimelineFrames = (durationsMs, fps = 30) => {
  const cumulative = [0];
  for (const ms of durationsMs) {
    cumulative.push(
      cumulative[cumulative.length - 1] + Math.max(0, Number(ms) || 0),
    );
  }
  const bounds = cumulative.map((ms) =>
    Math.max(0, Math.round((ms / 1000) * fps)),
  );
  for (let index = 1; index < bounds.length - 1; index += 1) {
    if (bounds[index] <= bounds[index - 1]) {
      bounds[index] = bounds[index - 1] + 1;
    }
  }
  const last = bounds.length - 1;
  if (last > 0 && bounds[last] <= bounds[last - 1]) {
    bounds[last] = bounds[last - 1] + 1;
  }
  return bounds;
};
