import assert from "node:assert/strict";
import test from "node:test";
import {
  hostBeatsContentKey,
  restoreHostBeats,
  hostWorkflowState,
} from "./workbench-host.mjs";

const beats = [
  {
    say: "同一个人物",
    headline: "人物",
    elements: [{ type: "card", title: "人物" }],
    startMs: 0,
    endMs: 4000,
  },
];
const sample = {
  beats: [{ ...beats[0], say: "效果示例" }],
  cases: [{ title: "示例" }],
};

test("preview-only sample leaves real script/audio/beat inputs unchanged and cannot export", () => {
  const props = {
    narrationAudioSrc: "/existing-audio.wav",
    templateId: "host",
    cases: [{ title: "自己的案例" }],
  };
  const before = JSON.stringify(props);
  const result = hostWorkflowState(props, null, sample);
  assert.equal(result.isSample, true);
  assert.equal(result.canRender, false);
  assert.equal(result.previewProps.narrationAudioSrc, undefined);
  assert.equal(result.previewProps.beats[0].say, "效果示例");
  assert.equal(JSON.stringify(props), before);
});

test("cached beats restore only for the same content, locale and script", () => {
  const script = { intro: "你好", cases: [], closing: "再见" };
  const key = hostBeatsContentKey("原文", "zh", script);
  const cache = { contentKey: key, beats };
  assert.deepEqual(restoreHostBeats(cache, key), beats);
  for (const changed of [
    hostBeatsContentKey("新原文", "zh", script),
    hostBeatsContentKey("原文", "en", script),
    hostBeatsContentKey("原文", "zh", { ...script, intro: "新稿" }),
  ]) {
    assert.equal(restoreHostBeats(cache, changed), null);
  }
  assert.equal(restoreHostBeats({ contentKey: key, beats: [] }, key), null);
  assert.equal(restoreHostBeats({ contentKey: key, beats: [{}] }, key), null);
});

test("own beats export through host and preserve original assets and script timing inputs", () => {
  const props = {
    templateId: "host",
    narrationAudioSrc: "/existing.wav",
    cases: [{ title: "自己的案例" }],
  };
  const frozen = JSON.stringify(beats);
  const result = hostWorkflowState(props, beats, sample);
  assert.equal(result.canRender, true);
  assert.equal(result.isSample, false);
  assert.equal(result.previewProps.aspect, "portrait");
  assert.equal(result.previewProps.narrationAudioSrc, "/existing.wav");
  assert.equal(result.previewProps.cases[0].title, "自己的案例");
  assert.equal(result.previewProps.beats[0].say, "同一个人物");
  assert.equal(JSON.stringify(beats), frozen);
});

test("speech synthesized after planning retimes the same beats from cues", () => {
  const props = {
    introDurationMs: 3000,
    introCues: [{ text: "同一个人物", startMs: 200, endMs: 1600 }],
    cases: [],
    closingDurationMs: 1000,
  };
  const result = hostWorkflowState(props, beats, sample);
  assert.equal(result.previewProps.beats[0].startMs, 200);
  assert.equal(result.previewProps.beats[0].endMs, 1600);
  assert.equal(beats[0].endMs, 4000);
});

test("existing cached case beats gain scenes and original images without changing the cache or audio", () => {
  const legacy = [{ say: "这是用户的产品", section: "case", caseIndex: 0, elements: [{ type: "card", title: "产品" }], startMs: 0, endMs: 4000 }];
  const key = hostBeatsContentKey("原文", "zh", { cases: [{ narration: "这是用户的产品" }] });
  const cache = { contentKey: key, beats: legacy };
  const before = JSON.stringify(cache);
  const result = hostWorkflowState({ narrationAudioSrc: "original.wav", cases: [{ title: "产品", image: "original.png" }] }, restoreHostBeats(cache, key), sample);
  assert.equal(result.previewProps.beats[0].scene, "product");
  assert.equal(result.previewProps.beats[0].elements[0].src, "original.png");
  assert.equal(result.previewProps.narrationAudioSrc, "original.wav");
  assert.equal(result.previewProps.beats[0].say, legacy[0].say);
  assert.equal(JSON.stringify(cache), before);
});
