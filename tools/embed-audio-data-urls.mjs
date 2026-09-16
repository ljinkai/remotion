import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Remotion CLI render serves the webpack bundle root, not always the live
 * public/ folder for bare "/.generated/..." URLs. Embedding synthesized WAV
 * as data URLs makes headless render independent of staticFile resolution.
 */
const toDataUrl = async (root, src) => {
  if (!src || typeof src !== "string") {
    return src;
  }
  const trimmed = src.trim();
  if (!trimmed || /^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  const cleaned = trimmed.replace(/^\/+/, "");
  const abs = path.join(root, "public", cleaned);
  const buf = await readFile(abs);
  return `data:audio/wav;base64,${buf.toString("base64")}`;
};

export const embedLocalAudioAsDataUrls = async (props, root) => {
  const next = structuredClone(props);
  if (next.introAudioSrc) {
    next.introAudioSrc = await toDataUrl(root, next.introAudioSrc);
  }
  if (next.closingAudioSrc) {
    next.closingAudioSrc = await toDataUrl(root, next.closingAudioSrc);
  }
  if (next.audioSrc) {
    next.audioSrc = await toDataUrl(root, next.audioSrc);
  }
  if (Array.isArray(next.cases)) {
    for (const item of next.cases) {
      if (item.audioSrc) {
        item.audioSrc = await toDataUrl(root, item.audioSrc);
      }
    }
  }
  return next;
};
