import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAzureSpeechConfig, synthesizeScene } from "./azure-tts.mjs";
import { DEFAULT_AZURE_VOICE, resolveVoiceId } from "./azure-voices.mjs";
import {
  SCENE_BREAK_MS,
  SILENT_DURATION_MS,
  buildNarrationPlan,
  planHasSpeech,
} from "./continuous-narration.mjs";
import { retimeKnowledgeProps } from "./knowledge-content.mjs";
import { readNarrationCache, writeNarrationCache } from "./tts-cache.mjs";

const synthId = () =>
  new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;

const pcmFromWav = (buffer) => {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "data") {
      return buffer.subarray(offset + 8, offset + 8 + size);
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("语音文件缺少音频数据");
};

const silencePcm = (durationMs) =>
  Buffer.alloc(
    Math.round((SAMPLE_RATE * BYTES_PER_SAMPLE * Math.max(0, durationMs)) / 1000),
  );

const writePcmWav = async (pcm, outputPath) => {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * BYTES_PER_SAMPLE, 28);
  header.writeUInt16LE(BYTES_PER_SAMPLE, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  await writeFile(outputPath, Buffer.concat([header, pcm]));
  return Math.round((pcm.length / (SAMPLE_RATE * BYTES_PER_SAMPLE)) * 1000);
};

/** One Azure call per scene, then join with the same pause the old single track used. */
const synthesizePlanByScene = async (plan, workDir, voice) => {
  const pieces = [];
  const timings = [];
  let cursor = 0;

  for (let index = 0; index < plan.scenes.length; index += 1) {
    const scene = plan.scenes[index];
    const last = index === plan.scenes.length - 1;
    if (!scene.speakText) {
      pieces.push(silencePcm(SILENT_DURATION_MS));
      timings.push({
        id: scene.id,
        startMs: cursor,
        durationMs: SILENT_DURATION_MS,
        cues: [],
      });
      cursor += SILENT_DURATION_MS;
      continue;
    }

    const scenePath = path.join(workDir, `${scene.id}.wav`);
    const result = await synthesizeScene(scene.text, scenePath, { voice });
    const pcm = pcmFromWav(await readFile(scenePath));
    pieces.push(pcm);
    const gap = last ? 0 : SCENE_BREAK_MS;
    if (gap > 0) {
      pieces.push(silencePcm(gap));
    }
    const durationMs = result.durationMs + gap;
    timings.push({
      id: scene.id,
      startMs: cursor,
      durationMs,
      cues: result.cues,
    });
    cursor += durationMs;
  }

  const outputPath = path.join(workDir, "narration.wav");
  const durationMs = await writePcmWav(Buffer.concat(pieces), outputPath);
  return { outputPath, durationMs, timings };
};

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
  const workDir = path.join(root, ".workbench", `synth-${id}`);
  await mkdir(workDir, { recursive: true });
  const result = await synthesizePlanByScene(plan, workDir, voice);
  const stored = await writeNarrationCache(
    root,
    plan.scenes,
    voice,
    SCENE_BREAK_MS,
    {
      durationMs: result.durationMs,
      timings: result.timings,
      sourceAudioPath: result.outputPath,
    },
  );
  if (!stored?.relativePublicPath) {
    throw new Error("整轨语音写入缓存失败");
  }
  applyTrack(enriched, stored.relativePublicPath, result.timings);
  if (knowledge) enriched.narrationDurationMs = result.durationMs;

  return {
    synthId: id,
    props: knowledge ? retimeKnowledgeProps(enriched) : enriched,
    paddingMs: 0,
    cache: { hits: 0, misses: 1, voice },
  };
};
