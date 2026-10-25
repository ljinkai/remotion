import assert from "node:assert/strict";
import test from "node:test";
import { buildContentExplanation, enrichContentVisuals } from "./host-content-visuals.mjs";
import { enrichBeatScenes, finalizeBeats } from "./beat-spec.mjs";
import { hostWorkflowState } from "./workbench-host.mjs";

const explanation = (beat) => beat.elements.find((element) => element.type === "explanation");
const sourceBacked = (visual, source) => {
  assert.ok(source.includes(visual.title));
  for (const item of visual.items) {
    assert.ok(source.includes(item.label), `label must be a source span: ${item.label}`);
    if (item.detail) assert.ok(source.includes(item.detail), `detail must be a source span: ${item.detail}`);
  }
};

test("distinct tool, customer acquisition and open-source viewpoints get content-specific source-backed layouts", () => {
  const examples = [
    ["先输入 API Key，然后通过 MCP 调用助手，最后发布内容", "flow"],
    ["支持邮件触达、意向线索筛选和客户记录", "features"],
    ["不是追逐所有热点，而是解决自己的高频痛点", "contrast"],
    ["开源工具仍然存在清晰的机会", "spotlight"],
  ];
  const results = examples.map(([say, layout]) => {
    const result = buildContentExplanation({ say });
    assert.equal(result.layout, layout);
    sourceBacked(result, say);
    return result;
  });
  assert.notDeepEqual(results[0].items, results[1].items);
  assert.equal(JSON.stringify(results).includes("虚构增长"), false);
});

test("technical chain preserves all source actors, interfaces and final operations without a product-specific mapping", () => {
  const say = "只要一个 API Key 就能让 Claude、Codex 等 AI 代理通过 MCP 或 REST 接口直接发帖、安排定时内容、管理线程";
  const result = buildContentExplanation({ say });
  assert.equal(result.layout, "flow");
  assert.equal(result.items.length, 4);
  sourceBacked(result, say);
  for (const token of ["API Key", "Claude", "Codex", "MCP", "REST", "发帖", "定时", "线程"]) {
    assert.ok(result.items.some((item) => `${item.label}${item.detail || ""}`.includes(token)), token);
  }
  const long = "先打开工具，然后输入正文，接着选择格式，最后生成预览，再保存草稿，再发布文章";
  const many = buildContentExplanation({ say: long });
  assert.ok(many.items.some((item) => item.label.includes("发布文章")));
  sourceBacked(many, long);
});

test("negated capabilities and unordered alternatives do not become positive features or directional pipelines", () => {
  for (const say of ["不支持邮件和短信", "不能提供线索筛选和客户记录", "不兼容 Claude 和 Codex", "没有 API 接口和自动同步"]) {
    const result = buildContentExplanation({ say });
    assert.equal(result.layout, "spotlight");
    sourceBacked(result, say);
  }
  assert.equal(buildContentExplanation({ say: "支持 Claude 和 Codex" }).layout, "features");
  assert.equal(buildContentExplanation({ say: "收入和成本都需要核对" }).layout, "spotlight");
  assert.equal(buildContentExplanation({ say: "上传文档，生成摘要" }).layout, "flow");
  assert.equal(buildContentExplanation({ say: "上传文档，未必生成摘要" }).layout, "spotlight");
  assert.equal(buildContentExplanation({ say: "支持输入和输出" }).layout, "features");
});

test("only explicitly linked adjacent same-case lines participate in a contrast", () => {
  const beats = [
    { say: "不是把线索全部铺开", caseIndex: 0, elements: [] },
    { say: "而是先解决最明确的痛点", caseIndex: 0, elements: [] },
    { say: "支持文档和图片", caseIndex: 1, elements: [] },
    { say: "采用原生接口而非简单丢链接", caseIndex: 1, elements: [] },
    { say: "并记录每次结果", caseIndex: 1, elements: [] },
  ];
  const result = enrichContentVisuals(beats);
  assert.equal(explanation(result[0]).layout, "contrast");
  assert.equal(explanation(result[1]).layout, "contrast");
  assert.equal(explanation(result[2]).layout, "features");
  assert.equal(explanation(result[3]).layout, "contrast");
  assert.equal(explanation(result[4]).layout, "spotlight");
  assert.equal(JSON.stringify(explanation(result[2])).includes("线索"), false);
});

test("cached statement beats enrich idempotently, preserving input, timing, narration and initial source image", () => {
  const beats = [
    { say: "这是一个内容工具", section: "case", caseIndex: 0, scene: "product", headline: "内容工具", startMs: 0, endMs: 1700, elements: [{ type: "image", src: "source.png" }] },
    { say: "支持笔记和文档", section: "case", caseIndex: 0, scene: "statement", headline: "功能", startMs: 1700, endMs: 4800, elements: [{ type: "text", text: "小引用", size: "m" }, { type: "image", src: "source.png" }] },
  ];
  const props = { cases: [{ title: "内容工具", image: "source.png" }], narrationAudioSrc: "source.wav" };
  const before = JSON.stringify({ beats, props });
  const first = enrichBeatScenes(beats, props);
  assert.equal(first[0].scene, "product");
  assert.equal(first[0].elements[0].src, "source.png");
  assert.equal(first[1].scene, "statement");
  assert.equal(explanation(first[1]).layout, "features");
  assert.equal(first[1].elements.some((element) => element.src === "source.png"), true);
  assert.deepEqual(enrichBeatScenes(first, props), first);
  assert.deepEqual(first.map((beat) => [beat.say, beat.startMs, beat.endMs]), beats.map((beat) => [beat.say, beat.startMs, beat.endMs]));
  assert.equal(JSON.stringify({ beats, props }), before);
  const workflow = hostWorkflowState(props, beats, {});
  assert.equal(explanation(workflow.previewProps.beats[1]).layout, "features");
  assert.equal(workflow.previewProps.narrationAudioSrc, "source.wav");
});

test("malformed or unsupported explanations fall back to source content and authored valid explanations survive repeated enrichment", () => {
  const say = "支持图片和文档";
  const authored = { type: "explanation", layout: "features", title: "图片和文档", items: [{ label: "图片" }, { label: "文档", detail: "支持图片和文档" }] };
  const [valid] = enrichBeatScenes([{ say, caseIndex: null, scene: "statement", elements: [authored] }], {});
  assert.deepEqual(explanation(valid), authored);
  assert.deepEqual(enrichBeatScenes([valid], {}), [valid]);
  for (const invalid of [
    { ...authored, layout: "flow" },
    { ...authored, layout: "dashboard" },
    { ...authored, items: [{ label: "增加1000用户" }, { label: "文档" }] },
    { ...authored, items: "bad" },
  ]) {
    const [result] = enrichBeatScenes([{ say, caseIndex: null, elements: [invalid] }], {});
    assert.equal(explanation(result).layout, "features");
    sourceBacked(explanation(result), say);
  }
  const script = { intro: say };
  const generated = finalizeBeats({ beats: [{ elements: [authored] }] }, script, {});
  assert.deepEqual(explanation(generated[0]), authored);
});

test("existing real charts and source images are retained without turning single values into trends", () => {
  const [beat] = enrichBeatScenes([{ say: "月收入达到3700美元", caseIndex: 0, elements: [] }], { cases: [{ image: "source.png" }] });
  assert.equal(beat.scene, "metric");
  assert.equal(beat.elements.find((element) => element.type === "chart").chartType, "single");
  assert.equal(beat.elements.some((element) => element.src === "source.png"), true);
  assert.equal(explanation(beat), undefined);
});

test("authored explanations cannot remove negation or draw an arrow between alternative tools", () => {
  const [negated] = enrichBeatScenes([{ say: "不支持邮件和短信", caseIndex: null, elements: [{ type: "explanation", layout: "spotlight", title: "不支持邮件和短信", items: [{ label: "支持邮件" }] }] }], {});
  assert.equal(explanation(negated).items[0].label, "不支持邮件和短信");
  const say = "只要一个 API Key 就能让 Claude、Codex 代理通过 MCP 接口直接发帖";
  const [alternatives] = enrichBeatScenes([{ say, caseIndex: null, elements: [{ type: "explanation", layout: "flow", title: "API Key", items: [{ label: "Claude" }, { label: "Codex" }] }] }], {});
  assert.equal(explanation(alternatives).items.length, 4);
  assert.ok(explanation(alternatives).items[1].label.includes("Claude、Codex"));
  assert.equal(buildContentExplanation({ say: "不要先输入密码然后发布" }).layout, "spotlight");
});

test("multiple disclosed quantities keep their full source labels without combining different units on a chart", () => {
  const say = "上线一年做到 1.5 万注册用户、234 付费用户、月收入 3700 美元";
  const original = [{ say, caseIndex: 0, section: "case", scene: "metric", headline: "已披露数据", startMs: 200, endMs: 4200, elements: [{ type: "bar", to: 3700 }] }];
  const props = { cases: [{ image: "original.png" }] };
  const before = JSON.stringify(original);
  const [result] = enrichBeatScenes(original, props);
  assert.equal(result.scene, "metric");
  assert.equal(explanation(result).layout, "features");
  assert.deepEqual(explanation(result).items.map((item) => item.label), ["1.5 万注册用户", "234 付费用户", "月收入 3700 美元"]);
  sourceBacked(explanation(result), say);
  assert.equal(result.elements.some((element) => element.type === "chart"), false);
  assert.equal(result.elements.some((element) => element.src === "original.png"), true);
  assert.equal(result.elements.some((element) => element.type === "bar" && element.to === 3700), true);
  assert.deepEqual(enrichBeatScenes([result], props), [result]);
  assert.deepEqual([result.say, result.startMs, result.endMs], [say, 200, 4200]);
  assert.equal(JSON.stringify(original), before);
  const [qualified] = enrichBeatScenes([{ say: "至少100注册用户、预计月收入3700美元", caseIndex: null, scene: "metric", elements: [] }], {});
  assert.deepEqual(explanation(qualified).items.map((item) => item.label), ["至少100注册用户", "预计月收入3700美元"]);
  const [legacySingle] = enrichBeatScenes([{ say: "注册用户100用户、月收入3700美元", caseIndex: null, scene: "metric", elements: [{ type: "chart", chartType: "single", title: "注册用户", unit: "用户", data: [{ label: "注册用户", value: 100, display: "100用户" }] }] }], {});
  assert.equal(legacySingle.elements.some((element) => element.type === "chart"), false);
  assert.equal(explanation(legacySingle).items.length, 2);
});
