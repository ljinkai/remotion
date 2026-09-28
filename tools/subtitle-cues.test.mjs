import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTimedSubtitleCues,
  ensureSingleLineCues,
  narrationForSpeech,
  speechLineRanges,
  splitSubtitleLines,
} from "./subtitle-lines.mjs";

const RAW = "独立开发者做成了这件事。收入已经超过一万刀。";

test("speechLineRanges follow narrationForSpeech UTF-16 offsets", () => {
  const lines = splitSubtitleLines(RAW);
  assert.deepEqual(lines, ["独立开发者做成了这件事", "收入已经超过一万刀"]);
  const spoken = narrationForSpeech(RAW);
  const ranges = speechLineRanges(lines);
  assert.equal(spoken.slice(ranges[0].start, ranges[0].end), lines[0]);
  assert.equal(spoken.slice(ranges[1].start, ranges[1].end), lines[1]);
  assert.equal(spoken[ranges[0].end], "。");
});

test("buildTimedSubtitleCues cuts at the next line first word", () => {
  const lines = splitSubtitleLines(RAW);
  const ranges = speechLineRanges(lines);
  const boundaries = [
    ...[...lines[0]].map((text, index) => ({
      text,
      textOffset: ranges[0].start + index,
      audioOffsetMs: index * 100,
      durationMs: 100,
    })),
    ...[...lines[1]].map((text, index) => ({
      text,
      textOffset: ranges[1].start + index,
      audioOffsetMs: 800 + index * 100,
      durationMs: 100,
    })),
  ];

  const cues = buildTimedSubtitleCues(RAW, 2400, boundaries);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, lines[0]);
  assert.equal(cues[1].text, lines[1]);
  assert.equal(cues[0].startMs, 0);
  assert.equal(cues[0].endMs, 800);
  assert.equal(cues[1].startMs, 800);
  assert.equal(cues[1].endMs, 2400);
  assert.equal(cues[0].endMs, cues[1].startMs);
});

test("ensureSingleLineCues splits leftover sentences by character weight", () => {
  const pieces = ensureSingleLineCues(
    [{ text: RAW, startMs: 0, endMs: 2000 }],
    RAW,
    2000,
  );
  assert.equal(pieces.length, 2);
  assert.equal(pieces[0].endMs, pieces[1].startMs);
  assert.equal(pieces[0].startMs, 0);
  assert.equal(pieces[1].endMs, 2000);
  const splitAt = pieces[1].startMs;
  assert.notEqual(splitAt, 1000);
  assert.ok(splitAt > 1000);
});
