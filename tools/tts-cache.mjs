import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile, cp } from "node:fs/promises";
import path from "node:path";

const CACHE_VERSION = 2;
const NARRATION_CACHE_VERSION = 3;

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const ttsCacheKey = (text, voice) => {
  const payload = JSON.stringify({
    v: CACHE_VERSION,
    voice: String(voice || "").trim(),
    text: String(text || "").trim(),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
};

const cachePaths = (root, key) => {
  const dir = path.join(root, ".workbench", "tts-cache", key);
  const publicDir = path.join(root, "public", "generated", "tts-cache");
  return {
    dir,
    metaPath: path.join(dir, "meta.json"),
    audioPath: path.join(dir, "audio.wav"),
    publicDir,
    publicAudioPath: path.join(publicDir, `${key}.wav`),
    relativePublicPath: `generated/tts-cache/${key}.wav`,
  };
};

export const readTtsCache = async (root, text, voice) => {
  const narration = String(text || "").trim();
  if (!narration) {
    return null;
  }

  const key = ttsCacheKey(narration, voice);
  const paths = cachePaths(root, key);

  if (!(await exists(paths.metaPath)) || !(await exists(paths.audioPath))) {
    return null;
  }

  let meta;
  try {
    meta = JSON.parse(await readFile(paths.metaPath, "utf8"));
  } catch {
    return null;
  }

  if (
    meta?.v !== CACHE_VERSION ||
    meta.text !== narration ||
    meta.voice !== String(voice || "").trim() ||
    typeof meta.durationMs !== "number" ||
    !Array.isArray(meta.cues)
  ) {
    return null;
  }

  await mkdir(paths.publicDir, { recursive: true });
  if (!(await exists(paths.publicAudioPath))) {
    await cp(paths.audioPath, paths.publicAudioPath);
  }

  return {
    key,
    durationMs: meta.durationMs,
    cues: meta.cues,
    audioPath: paths.publicAudioPath,
    relativePublicPath: paths.relativePublicPath,
    fromCache: true,
  };
};

export const writeTtsCache = async (
  root,
  text,
  voice,
  { durationMs, cues, sourceAudioPath },
) => {
  const narration = String(text || "").trim();
  if (!narration || !sourceAudioPath) {
    return null;
  }

  const key = ttsCacheKey(narration, voice);
  const paths = cachePaths(root, key);
  await mkdir(paths.dir, { recursive: true });
  await mkdir(paths.publicDir, { recursive: true });

  await cp(sourceAudioPath, paths.audioPath);
  await cp(sourceAudioPath, paths.publicAudioPath);
  await writeFile(
    paths.metaPath,
    JSON.stringify(
      {
        v: CACHE_VERSION,
        text: narration,
        voice: String(voice || "").trim(),
        durationMs,
        cues,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    key,
    durationMs,
    cues,
    audioPath: paths.publicAudioPath,
    relativePublicPath: paths.relativePublicPath,
    fromCache: false,
  };
};

const narrationScenes = (scenes) =>
  (Array.isArray(scenes) ? scenes : []).map((scene) => ({
    id: String(scene?.id || ""),
    text: String(scene?.text || "").trim(),
  }));

export const narrationCacheKey = (scenes, voice, breakMs) => {
  const payload = JSON.stringify({
    v: NARRATION_CACHE_VERSION,
    mode: "continuous",
    voice: String(voice || "").trim(),
    breakMs: Number(breakMs),
    scenes: narrationScenes(scenes),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
};

const sameNarrationScenes = (left, right) => {
  const a = narrationScenes(left);
  const b = narrationScenes(right);
  return (
    a.length === b.length &&
    a.every((scene, index) => scene.id === b[index].id && scene.text === b[index].text)
  );
};

export const readNarrationCache = async (root, scenes, voice, breakMs) => {
  const normalized = narrationScenes(scenes);
  if (normalized.length === 0) {
    return null;
  }

  const key = narrationCacheKey(normalized, voice, breakMs);
  const paths = cachePaths(root, key);
  if (!(await exists(paths.metaPath)) || !(await exists(paths.audioPath))) {
    return null;
  }

  let meta;
  try {
    meta = JSON.parse(await readFile(paths.metaPath, "utf8"));
  } catch {
    return null;
  }

  if (
    meta?.v !== NARRATION_CACHE_VERSION ||
    meta.mode !== "continuous" ||
    meta.voice !== String(voice || "").trim() ||
    meta.breakMs !== Number(breakMs) ||
    !sameNarrationScenes(meta.scenes, normalized) ||
    typeof meta.durationMs !== "number" ||
    !Array.isArray(meta.timings)
  ) {
    return null;
  }

  await mkdir(paths.publicDir, { recursive: true });
  if (!(await exists(paths.publicAudioPath))) {
    await cp(paths.audioPath, paths.publicAudioPath);
  }

  return {
    key,
    durationMs: meta.durationMs,
    timings: meta.timings,
    audioPath: paths.publicAudioPath,
    relativePublicPath: paths.relativePublicPath,
    fromCache: true,
  };
};

export const writeNarrationCache = async (
  root,
  scenes,
  voice,
  breakMs,
  { durationMs, timings, sourceAudioPath },
) => {
  const normalized = narrationScenes(scenes);
  if (normalized.length === 0 || !sourceAudioPath || !Array.isArray(timings)) {
    return null;
  }

  const key = narrationCacheKey(normalized, voice, breakMs);
  const paths = cachePaths(root, key);
  await mkdir(paths.dir, { recursive: true });
  await mkdir(paths.publicDir, { recursive: true });
  await cp(sourceAudioPath, paths.audioPath);
  await cp(sourceAudioPath, paths.publicAudioPath);
  await writeFile(
    paths.metaPath,
    JSON.stringify(
      {
        v: NARRATION_CACHE_VERSION,
        mode: "continuous",
        voice: String(voice || "").trim(),
        breakMs: Number(breakMs),
        scenes: normalized,
        durationMs,
        timings,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    key,
    durationMs,
    timings,
    audioPath: paths.publicAudioPath,
    relativePublicPath: paths.relativePublicPath,
    fromCache: false,
  };
};
