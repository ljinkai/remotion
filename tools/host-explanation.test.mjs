import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { transform } from "esbuild";

const source = await readFile(
  new URL("../src/host-explainer/explanationContent.ts", import.meta.url),
  "utf8",
);
const { code } = await transform(source, { loader: "ts", format: "esm" });
const {
  explanationTextPages,
  explanationPageAt,
  explanationForElements,
  explanationFocus,
  explanationItemWindow,
  metricPresentation,
} = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

test("independent metric facts stay cards while supplied evidence charts retain priority", () => {
  const facts = {
    type: "explanation",
    layout: "features",
    title: "原文披露",
    items: [
      { label: "1.5万注册用户" },
      { label: "234付费用户" },
      { label: "月收入3700美元" },
    ],
  };
  const shown = metricPresentation([
    { type: "bar", label: "注册用户", to: 15000 },
    facts,
  ]);
  assert.equal(shown.type, "explanation");
  assert.deepEqual(shown.element.items, facts.items);
  const chart = {
    type: "chart",
    chartType: "milestones",
    unit: "MRR",
    title: "来源数据",
    data: [
      { label: "阶段A", value: 6000 },
      { label: "阶段B", value: 25000 },
    ],
  };
  assert.equal(metricPresentation([facts, chart]).element, chart);
  assert.equal(
    metricPresentation([{ type: "bar", to: 15000, label: "注册用户" }]).type,
    "legacy",
  );
});

test("authored source-backed layouts and text survive unchanged", () => {
  for (const layout of ["flow", "features", "contrast", "spotlight"]) {
    const element = {
      type: "explanation",
      layout,
      title: "原文内容",
      items: [
        { label: "通过 MCP/REST/CLI", detail: "直接发布内容，记录发布结果。" },
        { label: "同步到 LinkedIn" },
      ],
    };
    assert.deepEqual(explanationForElements([element]), element);
  }
});

test("long descriptions are paged losslessly, including complete REST and English product words", () => {
  const text =
    "只要一个 API Key 就能让 Claude、Codex 等 AI 代理通过 MCP/REST/CLI 直接发帖、安排定时内容、管理线程。同时将内容同步到 Bluesky 和 LinkedIn，记录每条发布结果。";
  const pages = explanationTextPages(text, 28);
  assert.ok(pages.length > 1);
  assert.equal(pages.join(""), text);
  for (const word of ["Claude", "Codex", "MCP/REST/CLI", "Bluesky", "LinkedIn"])
    assert.ok(
      pages.some((page) => page.includes(word)),
      word,
    );
  const seen = new Set(
    Array.from(
      { length: 240 },
      (_, frame) => explanationPageAt(text, 28, frame, 240).index,
    ),
  );
  assert.equal(seen.size, pages.length);
  assert.equal(explanationPageAt(text, 28, 239, 240).index, pages.length - 1);
  const expected = explanationPageAt(text, 28, 130, 240);
  explanationPageAt(text, 28, 0, 240);
  assert.deepEqual(explanationPageAt(text, 28, 130, 240), expected);
});

test("legacy single statements retain their full narration instead of clamping an excerpt", () => {
  const narration =
    "使用自己的 API Key，让 AI 代理通过 MCP 或 REST 接口发布内容，并记录真实的发布结果。";
  const result = explanationForElements(
    [{ type: "card", title: "AI代理发布", lines: ["使用自己的APIKey"] }],
    narration,
  );
  assert.equal(result.layout, "spotlight");
  assert.equal(
    result.items.map((item) => item.label + (item.detail || "")).join(""),
    narration,
  );
  assert.equal(result.items.length, 1);
});

test("legacy collections reveal every item across pages rather than truncating after four", () => {
  const phrases = Array.from(
    { length: 9 },
    (_, index) => `原文要点${index + 1}`,
  );
  const result = explanationForElements([
    { type: "card", title: "实际要点", lines: phrases },
  ]);
  assert.equal(result.layout, "features");
  const seen = new Map();
  for (let frame = 0; frame < 240; frame++) {
    const page = explanationItemWindow(result.items, result.layout, frame, 240);
    assert.ok(page.items.length <= 4);
    seen.set(
      page.index,
      page.items.map((item) => item.label + (item.detail || "")),
    );
  }
  assert.deepEqual([...seen.values()].flat(), phrases);
  const contrast = explanationItemWindow(result.items, "contrast", 120, 240);
  assert.ok(contrast.items.length <= 2);
  const spotlight = explanationItemWindow(result.items, "spotlight", 120, 240);
  assert.equal(spotlight.items.length, 1);
});

test("flow progressively focuses actual items then holds the final item", () => {
  const focused = new Set(
    Array.from({ length: 120 }, (_, frame) => explanationFocus(frame, 120, 4)),
  );
  assert.deepEqual([...focused], [0, 1, 2, 3]);
  assert.equal(explanationFocus(119, 120, 4), 3);
});
