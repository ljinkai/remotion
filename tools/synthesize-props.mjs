import { mkdir } from "node:fs/promises";
import path from "node:path";
import { getAzureSpeechConfig, synthesizeNarrationTrack } from "./azure-tts.mjs";
import { DEFAULT_AZURE_VOICE, resolveVoiceId } from "./azure-voices.mjs";
import {
  SCENE_BREAK_MS,
  assignSceneTimings,
  buildNarrationPlan,
  buildNarrationSsml,
  planHasSpeech,
} from "./continuous-narration.mjs";
import { retimeKnowledgeProps } from "./knowledge-content.mjs";
import { readNarrationCache, writeNarrationCache } from "./tts-cache.mjs";

const synthId = () =>
  new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

const applyTrack = (enriched, publicPath, timings) => {
  enriched.useSynthesizedTimeline = true;
  enriched.narrationAudioSrc = publicPath;
  enriched.audioSrc = undefined;
  enriched.introAudioSrc = undefined;
  enriched.closingAudioSrc = undefined;
  if (enriched.contentMode === "knowledge" || enriched.templateId === "knowledge") {
    enriched.introDurationMs = Math.max(0, timings[0]?.startMs || 0);
    enriched.closingDurationMs = 0;
  }
  if (Array.isArray(enriched.cases)) {
    for (const item of enriched.cases) {
      item.audioSrc = undefined;
    }
  }

  for (const scene of timings) {
    if (scene.id === "intro") {
      enriched.introDurationMs = scene.durationMs;
      enriched.introCues = scene.cues;
      continue;
    }
    if (scene.id === "closing") {
      enriched.closingDurationMs = scene.durationMs;
      enriched.closingCues = scene.cues;
      continue;
    }
    if (!scene.id.startsWith("case-") || !Array.isArray(enriched.cases)) {
      continue;
    }
    const index = Number(scene.id.slice("case-".length));
    const item = enriched.cases[index];
    if (!item) {
      continue;
    }
    item.durationMs = scene.durationMs;
    item.cues = scene.cues;
    item.audioSrc = undefined;
  }
};

export const synthesizeVideoProps = async (props, { root, voice: voiceOpt } = {}) => {
  const id = synthId();
  const voice = resolveVoiceId(
    voiceOpt || process.env.AZURE_SPEECH_VOICE,
    DEFAULT_AZURE_VOICE,
  );
  const rawPlan = buildNarrationPlan(props);
  const knowledge = props?.contentMode === "knowledge" || props?.templateId === "knowledge";
  const plan = knowledge ? { ...rawPlan, scenes: rawPlan.scenes.filter((scene) => scene.id.startsWith("case-")) } : rawPlan;
  const enriched = structuredClone(props);

  if (!planHasSpeech(plan)) {
    enriched.useSynthesizedTimeline = false;
    enriched.narrationAudioSrc = undefined;
    return {
      synthId: id,
      props: knowledge ? retimeKnowledgeProps(enriched) : enriched,
      paddingMs: 0,
      cache: { hits: 0, misses: 0, voice },
    };
  }

  const cached = await readNarrationCache(
    root,
    plan.scenes,
    voice,
    SCENE_BREAK_MS,
  );
  if (cached) {
    applyTrack(enriched, cached.relativePublicPath, cached.timings);
    if (knowledge) enriched.narrationDurationMs = cached.durationMs;
    return {
      synthId: id,
      props: knowledge ? retimeKnowledgeProps(enriched) : enriched,
      paddingMs: 0,
      cache: { hits: 1, misses: 0, voice },
    };
  }

  getAzureSpeechConfig({ voice });
  const ssml = buildNarrationSsml(plan, { voice });
  const workDir = path.join(root, ".workbench", `synth-${id}`);
  await mkdir(workDir, { recursive: true });
  const workPath = path.join(workDir, "narration.wav");
  const result = await synthesizeNarrationTrack(ssml, workPath, { voice });
  const timings = assignSceneTimings({
    scenes: plan.scenes,
    bookmarks: result.bookmarks,
    boundaries: result.boundaries,
    audioDurationMs: result.durationMs,
  });
  const stored = await writeNarrationCache(
    root,
    plan.scenes,
    voice,
    SCENE_BREAK_MS,
    {
      durationMs: result.durationMs,
      timings,
      sourceAudioPath: workPath,
    },
  );
  if (!stored?.relativePublicPath) {
    throw new Error("整轨语音写入缓存失败");
  }
  applyTrack(enriched, stored.relativePublicPath, timings);
  if (knowledge) enriched.narrationDurationMs = result.durationMs;

  return {
    synthId: id,
    props: knowledge ? retimeKnowledgeProps(enriched) : enriched,
    paddingMs: 0,
    cache: { hits: 0, misses: 1, voice },
  };
};
