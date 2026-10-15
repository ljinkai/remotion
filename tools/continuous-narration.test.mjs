import assert from "node:assert/strict";
import test from "node:test";
import {
  SCENE_BREAK_MS,
  SILENT_DURATION_MS,
  SSML_MAX_BYTES,
  assignSceneTimings,
  buildNarrationPlan,
  buildNarrationSsml,
  continuousTimelineFrames,
  rebaseWordOffsets,
} from "./continuous-narration.mjs";
import { narrationForSpeech, splitSubtitleLines } from "./subtitle-lines.mjs";

const voice = "zh-CN-YunxiNeural";

const spokenPlan = () =>
  buildNarrationPlan({
    locale: "zh",
    introSubtitle: "这期讲单渠道突破法。",
    cases: [{ subtitle: "收入超过 A&B。" }],
    closingSubtitle: "下周见。",
  });

test("SSML places bookmarks, spoken text, and breaks in order", () => {
  const plan = spokenPlan();
  const ssml = buildNarrationSsml(plan, { voice });
  const intro = narrationForSpeech(plan.scenes[0].text);
  const caseText = narrationForSpeech(plan.scenes[1].text).replaceAll(
    "&",
    "&amp;",
  );
  const closing = narrationForSpeech(plan.scenes[2].text);
  const introAt = ssml.indexOf('<bookmark mark="intro"/>');
  const introTextAt = ssml.indexOf(intro);
  const caseAt = ssml.indexOf('<bookmark mark="case-0"/>');
  const caseTextAt = ssml.indexOf(caseText);
  const closingAt = ssml.indexOf('<bookmark mark="closing"/>');
  const closingTextAt = ssml.indexOf(closing);
  assert.ok(introAt >= 0 && introTextAt > introAt);
  assert.ok(caseAt > introTextAt && caseTextAt > caseAt);
  assert.ok(closingAt > caseTextAt && closingTextAt > closingAt);
  assert.equal(ssml.includes("&amp;"), true);
  assert.equal(ssml.includes("A&B"), false);
  assert.equal(
    ssml.split(`<break time="${SCENE_BREAK_MS}ms"/>`).length - 1,
    2,
  );
  assert.match(ssml, /xml:lang="zh-CN"/);
  assert.match(ssml, new RegExp(`<voice name="${voice}">`));
});

test("empty middle scene is a silent break with no spoken text", () => {
  const plan = buildNarrationPlan({
    introSubtitle: "开场白。",
    cases: [{ subtitle: "   " }],
    closingSubtitle: "结尾语。",
  });
  const ssml = buildNarrationSsml(plan, { voice });
  const caseAt = ssml.indexOf('<bookmark mark="case-0"/>');
  const closingAt = ssml.indexOf('<bookmark mark="closing"/>');
  const between = ssml.slice(caseAt, closingAt);
  assert.match(between, new RegExp(`<break time="${SILENT_DURATION_MS}ms"/>`));
  assert.equal(between.includes(`<break time="${SCENE_BREAK_MS}ms"/>`), false);
  assert.equal(between.includes("开场白"), false);
  assert.equal(between.includes("结尾语"), false);
});

test("scene durations follow bookmark offsets", () => {
  const plan = spokenPlan();
  const timings = assignSceneTimings({
    scenes: plan.scenes,
    bookmarks: [
      { name: "intro", audioOffsetMs: 0 },
      { name: "case-0", audioOffsetMs: 3200 },
      { name: "closing", audioOffsetMs: 8000 },
    ],
    boundaries: [],
    audioDurationMs: 11000,
  });
  assert.deepEqual(
    timings.map((scene) => scene.durationMs),
    [3200, 4800, 3000],
  );
});

test("cue times are relative to the scene start", () => {
  const raw = "收入超过一万。关键词研究更刚需。";
  const lines = splitSubtitleLines(raw);
  const plan = buildNarrationPlan({
    introSubtitle: "开场。",
    cases: [{ subtitle: raw }],
    closingSubtitle: "结尾。",
  });
  const sceneStart = 3200;
  const timings = assignSceneTimings({
    scenes: plan.scenes,
    bookmarks: [
      { name: "intro", audioOffsetMs: 0 },
      { name: "case-0", audioOffsetMs: sceneStart },
      { name: "closing", audioOffsetMs: 8000 },
    ],
    boundaries: [
      {
        text: lines[1],
        textOffset: 500,
        audioOffsetMs: sceneStart + 400,
        durationMs: 400,
      },
    ],
    audioDurationMs: 11000,
  });
  const caseScene = timings[1];
  assert.equal(caseScene.cues[1].startMs, 400);
  assert.ok(caseScene.cues.every((cue) => cue.startMs >= 0));
  assert.ok(caseScene.cues.every((cue) => cue.startMs < caseScene.durationMs));
});

test("word offsets are remapped onto the scene speech, ignoring SSML offsets", () => {
  const raw = "独立开发者做成了这件事。收入已经超过一万刀。";
  const lines = splitSubtitleLines(raw);
  const plan = buildNarrationPlan({
    introSubtitle: "开场。",
    cases: [{ subtitle: raw }],
    closingSubtitle: "结尾。",
  });
  const spoken = narrationForSpeech(raw);
  const sceneStart = 3200;
  const secondLineAt = 800;
  const rebased = rebaseWordOffsets(
    spoken,
    [
      { text: lines[0], textOffset: 120, audioOffsetMs: sceneStart },
      {
        text: lines[1],
        textOffset: 120,
        audioOffsetMs: sceneStart + secondLineAt,
      },
    ],
    sceneStart,
  );
  assert.equal(rebased[0].textOffset, spoken.indexOf(lines[0]));
  assert.equal(rebased[1].textOffset, spoken.indexOf(lines[1]));
  assert.ok(rebased.every((word) => word.textOffset !== 120));
  assert.ok(rebased.every((word) => word.textOffset < spoken.length));

  const timings = assignSceneTimings({
    scenes: plan.scenes,
    bookmarks: [
      { name: "intro", audioOffsetMs: 0 },
      { name: "case-0", audioOffsetMs: sceneStart },
      { name: "closing", audioOffsetMs: 9000 },
    ],
    boundaries: [
      { text: lines[0], textOffset: 120, audioOffsetMs: sceneStart, durationMs: 700 },
      {
        text: lines[1],
        textOffset: 120,
        audioOffsetMs: sceneStart + secondLineAt,
        durationMs: 700,
      },
    ],
    audioDurationMs: 11000,
  });
  assert.equal(timings[1].cues[1].startMs, secondLineAt);
  assert.equal(timings[1].cues[0].startMs, 0);
});

test("missing or out-of-order bookmarks fail the synthesis", () => {
  const plan = spokenPlan();
  assert.throws(
    () =>
      assignSceneTimings({
        scenes: plan.scenes,
        bookmarks: [
          { name: "intro", audioOffsetMs: 0 },
          { name: "closing", audioOffsetMs: 5000 },
        ],
        boundaries: [],
        audioDurationMs: 8000,
      }),
    /bookmark/,
  );
  assert.throws(
    () =>
      assignSceneTimings({
        scenes: plan.scenes,
        bookmarks: [
          { name: "intro", audioOffsetMs: 5000 },
          { name: "case-0", audioOffsetMs: 0 },
          { name: "closing", audioOffsetMs: 8000 },
        ],
        boundaries: [],
        audioDurationMs: 11000,
      }),
    /乱序/,
  );
});

test("SSML over the byte limit fails before synthesis", () => {
  const plan = buildNarrationPlan({
    introSubtitle: "长".repeat(SSML_MAX_BYTES),
    cases: [{ subtitle: "案例。" }],
    closingSubtitle: "结尾。",
  });
  assert.throws(() => buildNarrationSsml(plan, { voice }), /60000|过长/);
});

test("continuous frames follow cumulative milliseconds", () => {
  const frames = continuousTimelineFrames([50, 50, 50], 30);
  assert.deepEqual(frames, [0, 2, 3, 5]);
  const squeezed = continuousTimelineFrames([10, 10, 1000], 30);
  assert.equal(squeezed[0], 0);
  assert.equal(squeezed[1] - squeezed[0], 1);
  assert.equal(squeezed[2] - squeezed[1], 1);
  assert.equal(squeezed[3], 31);
});
