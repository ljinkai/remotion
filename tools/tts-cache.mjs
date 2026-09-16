import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile, cp } from "node:fs/promises";
import path from "node:path";

const CACHE_VERSION = 1;

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
