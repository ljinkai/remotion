import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { readNarrationCache, writeNarrationCache } from "./tts-cache.mjs";

const scenes = [
  { id: "intro", text: "开场。" },
  { id: "case-0", text: "案例。" },
  { id: "closing", text: "结尾。" },
];

const timings = [
  {
    id: "intro",
    startMs: 0,
    durationMs: 1000,
    cues: [{ text: "开场", startMs: 0, endMs: 1000 }],
  },
  {
    id: "case-0",
    startMs: 1000,
    durationMs: 1200,
    cues: [{ text: "案例", startMs: 0, endMs: 1200 }],
  },
  {
    id: "closing",
    startMs: 2200,
    durationMs: 800,
    cues: [{ text: "结尾", startMs: 0, endMs: 800 }],
  },
];

test("narration cache hits the same script and misses one edited line", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "narration-cache-"));
  try {
    const sourceAudioPath = path.join(root, "src.wav");
    await writeFile(sourceAudioPath, "RIFF");
    const written = await writeNarrationCache(
      root,
      scenes,
      "zh-CN-YunxiNeural",
      400,
      { durationMs: 3000, timings, sourceAudioPath },
    );
    const hit = await readNarrationCache(root, scenes, "zh-CN-YunxiNeural", 400);
    assert.equal(hit.relativePublicPath, written.relativePublicPath);
    assert.equal(hit.durationMs, 3000);
    assert.equal(hit.timings[1].cues[0].text, "案例");

    const edited = scenes.map((scene, index) =>
      index === 1 ? { ...scene, text: "改了一行。" } : scene,
    );
    assert.equal(
      await readNarrationCache(root, edited, "zh-CN-YunxiNeural", 400),
      null,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
