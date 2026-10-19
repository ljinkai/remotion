import assert from "node:assert/strict";
import test from "node:test";
import {
  assignBeatTiming,
  compositionIdForProps,
  finalizeBeats,
  narrationLines,
  sanitizeSvg,
  validateBeats,
} from "./beat-spec.mjs";

const script = {
  intro: "这期看两个产品",
  cases: [
    {
      index: "01",
      title: "甲板笔记",
      narration: "一个月能到一万二\n打开就能看到产品页",
    },
  ],
  closing: "下周继续",
};

const props = {
  cases: [{ index: "01", title: "甲板笔记", image: "case-images/notes.png" }],
};

test("narration lines keep section and case index", () => {
  const lines = narrationLines(script);
  assert.equal(lines.length, 4);
  assert.deepEqual(
    lines.map((line) => line.section),
    ["intro", "case", "case", "closing"],
  );
  assert.equal(lines[1].caseIndex, 0);
  assert.equal(lines[2].say, "打开就能看到产品页");
});

test("two lines in one case can keep different elements", () => {
  const beats = validateBeats(
    [
      {},
      {
        headline: "一个月 $12,000",
        accent: "$12,000",
        host: "cheer",
        elements: [
          { type: "bar", label: "每月", to: 12000 },
          { type: "text", text: "$12,000", size: "xl" },
        ],
      },
      {
        headline: "打开产品页",
        accent: "产品页",
        elements: [{ type: "image", src: "case-images/notes.png", caption: "甲板笔记" }],
      },
    ],
    script,
    props,
  );
  assert.equal(beats[1].elements[0].type, "bar");
  assert.equal(beats[2].elements[0].type, "image");
  assert.notDeepEqual(beats[1].elements, beats[2].elements);
  assert.equal(beats.length, 4);
});

test("unknown elements and unsafe svg fall back to text", () => {
  const beats = validateBeats(
    [
      {
        headline: "还在讲",
        elements: [
          { type: "video", src: "nope.mp4" },
          {
            type: "svg",
            markup: `<svg><script>alert(1)</script><path d="M0 0 L10 10" fill="url(http://x)" /><rect width="10" height="10" fill="#ff4d1c" /></svg>`,
          },
          { type: "icon", name: "gavel" },
          { type: "image", src: "https://evil.example/a.png" },
        ],
      },
    ],
    { intro: "只有一句", cases: [], closing: "" },
    props,
  );
  assert.equal(beats.length, 1);
  assert.equal(beats[0].elements.some((item) => item.type === "video"), false);
  assert.equal(beats[0].elements.some((item) => item.type === "icon"), false);
  assert.equal(beats[0].elements.some((item) => item.type === "image"), false);
  const svg = beats[0].elements.find((item) => item.type === "svg");
  assert.ok(svg);
  assert.equal(svg.markup.includes("script"), false);
  assert.equal(svg.markup.includes("url("), false);
  assert.equal(svg.markup.includes("<rect"), true);
});

test("a beat with no surviving elements gets a content block", () => {
  const beats = validateBeats(
    [{ elements: [{ type: "icon", name: "nope" }] }],
    { intro: "这句话还在", cases: [], closing: "" },
    { cases: [] },
  );
  assert.equal(beats[0].elements[0].type, "card");
  assert.equal(beats[0].elements[0].title, "这句话还在");
});

test("an icon-only beat about posting becomes a phone, not a wave", () => {
  const beats = validateBeats(
    [
      {
        headline: "AI Agent 自动发推",
        accent: "AI Agent",
        elements: [{ type: "icon", name: "wave" }],
      },
    ],
    {
      intro: "",
      cases: [{ title: "OpenTweet", narration: "主打 AI Agent 发推能力" }],
      closing: "",
    },
    { cases: [{ title: "OpenTweet" }] },
  );
  assert.equal(beats[0].elements.some((item) => item.type === "icon"), false);
  assert.equal(beats[0].elements[0].type, "phone");
  assert.match(`${beats[0].elements[0].title}${beats[0].elements[0].body}`, /发推|AI Agent/);
  assert.equal(beats[0].elements[0].action, "发推");
});

test("extra model rows are dropped and missing rows are filled", () => {
  const beats = validateBeats(
    [
      { headline: "第一句", elements: [{ type: "text", text: "甲", size: "m" }] },
      { headline: "多余", elements: [{ type: "text", text: "乙", size: "m" }] },
    ],
    { intro: "只有一句", cases: [], closing: "" },
    { cases: [] },
  );
  assert.equal(beats.length, 1);
  assert.equal(beats[0].say, "只有一句");
  assert.equal(beats[0].elements.some((item) => item.text === "甲"), true);
});

test("sanitizeSvg removes script and foreignObject", () => {
  const markup = sanitizeSvg(
    `<svg viewBox="0 0 10 10"><foreignObject><div onclick="x">x</div></foreignObject><circle cx="4" cy="4" r="2" fill="#161616" /></svg>`,
  );
  assert.equal(/foreignObject|onclick/i.test(markup), false);
  assert.equal(markup.includes("<circle"), true);
});

test("without cues each line lasts 4 seconds", () => {
  const beats = assignBeatTiming(
    validateBeats([], script, props),
    props,
  );
  assert.deepEqual(
    beats.map((beat) => [beat.startMs, beat.endMs]),
    [
      [0, 4000],
      [4000, 8000],
      [8000, 12000],
      [12000, 16000],
    ],
  );
});

test("cues are applied in narration order", () => {
  const beats = finalizeBeats(
    {
      beats: [
        {},
        { elements: [{ type: "bar", to: 12000, label: "每月" }] },
        { elements: [{ type: "image", src: "case-images/notes.png" }] },
        {},
      ],
    },
    script,
    {
      ...props,
      introDurationMs: 1000,
      introCues: [{ text: "这期看两个产品", startMs: 0, endMs: 1000 }],
      cases: [
        {
          ...props.cases[0],
          durationMs: 2000,
          cues: [
            { text: "一个月能到一万二", startMs: 0, endMs: 900 },
            { text: "打开就能看到产品页", startMs: 900, endMs: 2000 },
          ],
        },
      ],
      closingDurationMs: 800,
      closingCues: [{ text: "下周继续", startMs: 0, endMs: 800 }],
    },
  );
  assert.equal(beats[0].startMs, 0);
  assert.equal(beats[0].endMs, 1000);
  assert.equal(beats[1].startMs, 1000);
  assert.equal(beats[1].endMs, 1900);
  assert.equal(beats[1].elements[0].type, "bar");
  assert.equal(beats[2].elements[0].type, "image");
  assert.equal(beats[3].startMs, 3000);
});

test("host template selects its composition and midnight does not", () => {
  assert.equal(
    compositionIdForProps({ templateId: "midnight", aspect: "landscape", beats: [{}] }),
    "IndieWeeklyMarkdown",
  );
  assert.equal(
    compositionIdForProps({ templateId: "midnight", aspect: "portrait" }),
    "IndieWeeklyMarkdownPortrait",
  );
  assert.equal(
    compositionIdForProps({ templateId: "host", aspect: "landscape" }),
    "HostExplainer",
  );
});
