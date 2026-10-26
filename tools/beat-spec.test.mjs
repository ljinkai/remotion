import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import {
  assignBeatTiming,
  compositionIdForProps,
  finalizeBeats,
  narrationLines,
  sanitizeSvg,
  validateBeats,
} from "./beat-spec.mjs";
import { buildBeatPrompt, planBeats } from "./beat-planner.mjs";

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
  cases: [{ index: "01", title: "甲板笔记", metric: "$12,000", image: "case-images/notes.png" }],
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
  assert.equal(beats[1].elements[0].type, "image");
  assert.equal(beats[2].elements.some((element) => element.type === "image"), true);
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
  const markup = svg?.markup || sanitizeSvg(`<svg><script>alert(1)</script><path fill="url(http://x)" /><rect width="10" /></svg>`);
  assert.equal(markup.includes("script"), false);
  assert.equal(markup.includes("url("), false);
  assert.equal(markup.includes("<rect"), true);
});

test("a beat with no surviving elements gets a content block", () => {
  const beats = validateBeats(
    [{ elements: [{ type: "icon", name: "nope" }] }],
    { intro: "这句话还在", cases: [], closing: "" },
    { cases: [] },
  );
  assert.equal(beats[0].scene, "statement");
  assert.equal(beats[0].elements[0].items[0].label, "这句话还在");
});

test("a posting keyword alone becomes a statement instead of an invented phone workflow", () => {
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
  assert.equal(beats[0].elements[0].type, "explanation");
  assert.equal(beats[0].scene, "statement");
  assert.match(beats[0].elements[0].items[0].label, /发推|AI Agent/);
  assert.equal(beats[0].elements.some((element) => element.type === "phone"), false);
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
  assert.equal(beats[0].elements[0].type, "explanation");
  assert.equal(beats[0].elements[0].items[0].label, "只有一句");
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
  assert.equal(beats[1].elements[0].type, "image");
  assert.equal(beats[2].elements.some((element) => element.type === "image"), true);
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

test("first case introduction always shows its own content image even after four decorations", () => {
  const localScript = { cases: [{ narration: "这是一个笔记产品\n它可以记录灵感" }, { narration: "另一个产品" }] };
  const localProps = { cases: [{ title: "甲", image: "a.png" }, { title: "乙", image: "b.png" }] };
  const [first, second, third] = validateBeats([
    { elements: [...Array.from({ length: 4 }, () => ({ type: "text", text: "笔记" })), { type: "image", src: "a.png" }] },
    { elements: [{ type: "image", src: "a.png", caption: "已有图片" }, { type: "image", src: "b.png" }, { type: "image", src: "https://unknown/image.png" }] },
  ], localScript, localProps);
  assert.equal(first.scene, "product");
  assert.equal(first.elements.length, 4);
  assert.equal(first.elements[0].src, "a.png");
  assert.deepEqual(second.elements.filter((element) => element.type === "image"), [{ type: "image", src: "a.png", caption: "已有图片" }]);
  assert.equal(third.elements[0].src, "b.png");
});

test("scene routing is factual and keeps exact narration order and default timing", () => {
  const localScript = { cases: [{ narration: "产品介绍\n每月收入 $12,000\n先打开产品，然后上传文档，最后生成摘要\n自动发布很方便" }] };
  const result = finalizeBeats({ beats: [{}, {}, { scene: "steps" }, { scene: "invalid" }] }, localScript, { cases: [{ image: "product.png" }] });
  assert.deepEqual(result.map((beat) => beat.scene), ["product", "metric", "statement", "statement"]);
  assert.deepEqual(result.map((beat) => beat.say), narrationLines(localScript).map((line) => line.say));
  assert.deepEqual(result.map((beat) => [beat.startMs, beat.endMs]), [[0, 4000], [4000, 8000], [8000, 12000], [12000, 16000]]);
  assert.equal(result[1].elements.find((element) => element.type === "text").text, "$12,000");
  assert.equal(result[2].elements[0].layout, "flow");
  assert.deepEqual(result[2].elements[0].items.map((item) => item.label), ["先打开产品", "然后上传文档", "最后生成摘要"]);
  assert.equal(result[3].elements.some((element) => element.type === "phone"), false);
});

test("unsupported figures and invented sparkline series are removed without fabricating data", () => {
  const [metric, statement] = validateBeats([
    { scene: "metric", elements: [{ type: "bar", to: 12000, max: 99999 }, { type: "bar", to: 42000 }, { type: "card", title: "月收入", bars: [10, 20, 30] }, { type: "text", text: "$99999" }] },
    { scene: "steps", elements: [{ type: "card", title: "使用方法", lines: ["打开应用", "输入内容", "点击生成"] }] },
  ], { intro: "月收入 $12,000\n这是一个产品结论" }, { cases: [] });
  assert.equal(metric.scene, "metric");
  assert.equal(metric.elements.some((element) => element.to === 42000 || element.text === "$99999"), false);
  assert.equal(metric.elements.find((element) => element.type === "bar").max, undefined);
  assert.equal(metric.elements.find((element) => element.type === "bar").note, "$12,000");
  assert.equal(metric.elements.some((element) => element.bars), false);
  assert.equal(statement.scene, "statement");
  assert.equal(statement.elements.some((element) => element.lines?.includes("点击生成")), false);
});

test("an existing metric scene keeps the real source metric prominent while adding the case image", () => {
  const [beat] = validateBeats([{ elements: [{ type: "bar", to: 4000000 }, { type: "text", text: "400万元" }] }], { cases: [{ narration: "GojiberryAI年收入达到400万美元" }] }, { cases: [{ image: "goji.png" }] });
  assert.equal(beat.scene, "metric");
  assert.equal(beat.elements.some((element) => element.src === "goji.png"), true);
  assert.equal(beat.elements.some((element) => element.text === "400万美元"), true);
  assert.equal(beat.elements.some((element) => element.text === "400万元"), false);
  assert.equal(beat.elements.find((element) => element.type === "bar").note, "400万美元");
});

test("source metrics preserve compact money multipliers, accounting periods and complete duration units", () => {
  for (const [metric, expanded] of [["$5k MRR", 5000], ["$4M ARR", 4000000], ["3个月", 3]]) {
    const [beat] = validateBeats([{ scene: "metric", elements: [{ type: "bar", to: expanded }] }], { cases: [{ narration: "产品已经盈利" }] }, { cases: [{ metric }] });
    assert.equal(beat.scene, "metric");
    assert.equal(beat.elements.find((element) => element.type === "text").text, metric);
    assert.equal(beat.elements.find((element) => element.type === "bar").note, metric);
  }
  const [direct] = validateBeats([], { intro: "持续运营3个月后达到$5k MRR" }, { cases: [] });
  assert.equal(direct.elements[0].text, "3个月");
});

test("legacy truncated numeric headlines regain their source unit while nonnumeric headlines stay intact", () => {
  const [legacy, authored, compact] = validateBeats([
    { headline: "GojiberryAI年收入400" },
    { headline: "可持续的产品收入" },
    { headline: "月收入5" },
  ], { intro: "GojiberryAI年收入达到400万美元\n年收入达到400万美元\n月收入达到$5k MRR" }, { cases: [] });
  assert.equal(legacy.headline, "年收入400万美元");
  assert.equal(authored.headline, "可持续的产品收入");
  assert.equal(compact.headline, "月收入$5k MRR");
});

test("malformed model output falls back conservatively and intro cannot borrow a case image", () => {
  const result = validateBeats([null, { scene: "metric", elements: "bad" }], { intro: "开场\n只有结论" }, { cases: [{ image: "case.png" }] });
  assert.deepEqual(result.map((beat) => beat.scene), ["statement", "statement"]);
  assert.equal(result.some((beat) => beat.elements.some((element) => element.type === "image")), false);
  const prompt = buildBeatPrompt({ cases: [{ narration: "产品介绍" }] }, { cases: [{ image: "case.png" }] });
  assert.match(prompt, /第一行/);
  assert.match(prompt, /1到4/);
  assert.match(prompt, /不生成 card.bars/);
  assert.equal(prompt.includes("case.png"), true);
});

test("malformed model JSON retries then returns deterministic source-backed scenes", async (context) => {
  const originalKey = process.env.SCRIPT_LLM_API_KEY;
  process.env.SCRIPT_LLM_API_KEY = "test-only";
  context.after(() => {
    if (originalKey === undefined) delete process.env.SCRIPT_LLM_API_KEY;
    else process.env.SCRIPT_LLM_API_KEY = originalKey;
  });
  let requests = 0;
  context.mock.method(globalThis, "fetch", async () => {
    requests++;
    return new globalThis.Response(JSON.stringify({ choices: [{ message: { content: "malformed output" } }] }), { status: 200 });
  });
  const result = await planBeats({ cases: [{ narration: "介绍产品" }] }, { cases: [{ image: "source.png" }] });
  assert.equal(requests, 2);
  assert.equal(result[0].scene, "product");
  assert.equal(result[0].say, "介绍产品");
  assert.equal(result[0].elements[0].src, "source.png");
});

test("English numbers preserve count units, revenue periods and exact source magnitudes", () => {
  for (const [say, token, value] of [
    ["The tool has 234 paying customers.", "234 paying customers", 234],
    ["We reached 15,000 registered users.", "15,000 registered users", 15000],
    ["Monthly revenue is $3,700.", "$3,700", 3700],
    ["MRR of $5k is disclosed.", "MRR of $5k", 5000],
    ["Revenue reached $4M ARR.", "$4M ARR", 4000000],
    ["The service has 1.5 million users.", "1.5 million users", 1500000],
    ["Customers: 234", "Customers: 234", 234],
  ]) {
    const [beat] = validateBeats([], { intro: say }, { locale: "en", cases: [] });
    assert.equal(beat.scene, "metric", say);
    const chart = beat.elements.find((element) => element.type === "chart");
    assert.equal(chart.chartType, "single");
    assert.equal(chart.data[0].value, value);
    assert.equal(chart.data[0].display, token);
    assert.equal(/[\u3400-\u9fff]/.test(`${chart.data[0].label} ${chart.source} ${chart.unit}`), false);
  }
  const [negative] = validateBeats([], { intro: "There are no 100 paying customers." }, { locale: "en", cases: [] });
  assert.equal(negative.elements.some((element) => element.type === "chart"), false);
});

test("English headlines end on complete source words and planner asks for English display fields", () => {
  const say = "An exceptionally useful independent developer tool makes the entire publishing workflow easier to understand and operate";
  const [beat] = validateBeats([], { intro: say }, { locale: "en", cases: [] });
  assert.ok(beat.headline.length > 18);
  assert.ok(say.startsWith(beat.headline));
  assert.ok(say[beat.headline.length] === " " || beat.headline.length === say.length);
  const prompt = buildBeatPrompt({ intro: say }, { locale: "en", cases: [] });
  assert.match(prompt, /LANGUAGE: English/);
  assert.match(prompt, /whole-word boundary/);
  assert.match(prompt, /Do not translate English narration/);
});
