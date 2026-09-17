import { mkdir, cp } from "node:fs/promises";
import path from "node:path";
import { getAzureSpeechConfig, synthesizeScene } from "./azure-tts.mjs";
import { DEFAULT_AZURE_VOICE, resolveVoiceId } from "./azure-voices.mjs";
import { readTtsCache, writeTtsCache } from "./tts-cache.mjs";

const SCENE_PADDING_MS = 300;
const SILENT_DURATION_MS = 2000;

const synthId = () =>
  new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

export const synthesizeVideoProps = async (props, { root, voice: voiceOpt } = {}) => {
  const id = synthId();
  const workDir = path.join(root, ".workbench", `synth-${id}`);
  // Use public/generated (no leading dot) so Remotion staticFile / public copy
  // reliably picks up TTS assets during CLI render.
  const publicDir = path.join(root, "public", "generated", `synth-${id}`);
  await mkdir(workDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });

  const voice = resolveVoiceId(
    voiceOpt || process.env.AZURE_SPEECH_VOICE,
    DEFAULT_AZURE_VOICE,
  );

  const enriched = structuredClone(props);
  enriched.useSynthesizedTimeline = true;
  enriched.audioSrc = undefined;

  const scenes = [
    {
      key: "intro",
      text: props.introSubtitle,
      filename: "scene_00_intro.wav",
      apply: (result, publicPath) => {
        enriched.introDurationMs = result.durationMs || SILENT_DURATION_MS;
        enriched.introCues = result.cues;
        enriched.introAudioSrc = result.audioPath ? publicPath : undefined;
      },
    },
    ...props.cases.map((item, index) => ({
      key: `case-${index}`,
      text: item.subtitle,
      filename: `scene_${String(index + 1).padStart(2, "0")}_case.wav`,
      caseIndex: index,
      apply: (result, publicPath) => {
        enriched.cases[index].durationMs =
          result.durationMs || SILENT_DURATION_MS;
        enriched.cases[index].cues = result.cues;
        enriched.cases[index].audioSrc = result.audioPath
          ? publicPath
          : undefined;
      },
    })),
    {
      key: "closing",
      text: props.closingSubtitle,
      filename: `scene_${String(props.cases.length + 1).padStart(2, "0")}_closing.wav`,
      apply: (result, publicPath) => {
        enriched.closingDurationMs = result.durationMs || SILENT_DURATION_MS;
        enriched.closingCues = result.cues;
        enriched.closingAudioSrc = result.audioPath ? publicPath : undefined;
      },
    },
  ];

  let cacheHits = 0;
  let cacheMisses = 0;
  let ensuredAzure = false;

  for (const scene of scenes) {
    const narration = String(scene.text || "").trim();
    if (!narration) {
      scene.apply(
        { durationMs: SILENT_DURATION_MS, cues: [], audioPath: null },
        undefined,
      );
      continue;
    }

    const cached = await readTtsCache(root, narration, voice);
    if (cached) {
      cacheHits += 1;
      scene.apply(
        {
          durationMs: cached.durationMs,
          cues: cached.cues,
          audioPath: cached.audioPath,
        },
        cached.relativePublicPath,
      );
      continue;
    }

    if (!ensuredAzure) {
      // Validate credentials only when we actually need Azure.
      getAzureSpeechConfig({ voice });
      ensuredAzure = true;
    }

    cacheMisses += 1;
    const workPath = path.join(workDir, scene.filename);
    const result = await synthesizeScene(scene.text, workPath, { voice });
    if (result.audioPath) {
      const stored = await writeTtsCache(root, narration, voice, {
        durationMs: result.durationMs,
        cues: result.cues,
        sourceAudioPath: workPath,
      });
      // Keep a per-run copy for debugging / job artifacts.
      const publicPath = path.join(publicDir, scene.filename);
      await cp(workPath, publicPath);
      scene.apply(result, stored?.relativePublicPath);
    } else {
      scene.apply(result, undefined);
    }
  }

  return {
    synthId: id,
    props: enriched,
    paddingMs: SCENE_PADDING_MS,
    cache: { hits: cacheHits, misses: cacheMisses, voice },
  };
};
