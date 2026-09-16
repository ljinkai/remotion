import { mkdir, cp } from "node:fs/promises";
import path from "node:path";
import { synthesizeScene } from "./azure-tts.mjs";

const SCENE_PADDING_MS = 300;
const SILENT_DURATION_MS = 2000;

const synthId = () =>
  new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

export const synthesizeVideoProps = async (props, { root }) => {
  const id = synthId();
  const workDir = path.join(root, ".workbench", `synth-${id}`);
  const publicDir = path.join(root, "public", ".generated", `synth-${id}`);
  await mkdir(workDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });

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
        enriched.cases[index].durationMs = result.durationMs || SILENT_DURATION_MS;
        enriched.cases[index].cues = result.cues;
        enriched.cases[index].audioSrc = result.audioPath ? publicPath : undefined;
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

  for (const scene of scenes) {
    const workPath = path.join(workDir, scene.filename);
    const publicPath = path.join(publicDir, scene.filename);
    const result = await synthesizeScene(scene.text, workPath);
    if (result.audioPath) {
      await cp(workPath, publicPath);
    }
    const relativePublicPath = `.generated/synth-${id}/${scene.filename}`;
    scene.apply(result, relativePublicPath);
  }

  return {
    synthId: id,
    props: enriched,
    paddingMs: SCENE_PADDING_MS,
  };
};
