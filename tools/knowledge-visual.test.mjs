import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { Buffer } from "node:buffer";
import { transform, build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const source = await readFile(
  new URL("../src/knowledge/knowledgeVisualPlan.ts", import.meta.url),
  "utf8",
);
const { code } = await transform(source, { loader: "ts", format: "esm" });
const { knowledgeVisualPlan, knowledgeChapterWindow, knowledgeVisualFocus } =
  await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );

test("semantics choose a diagram independent of chapter order or video title", () => {
  const examples = [
    [
      "持续协作中，AI获取资料，提取待办，使用工具，交回结果，让人检查。",
      "collaboration",
    ],
    ["先选反复出现的工作，明确资料和输出，人工确认后检查。", "practice"],
    [
      "项目看板里，AI参与协作。有的项目等待结果，有的整理资料，需要人判断。",
      "hub",
    ],
    ["AI帮助版本开发、用户反馈和内容推广，需要工作台汇总。", "workbench"],
    ["加速让同一任务更快，编排衔接，并行同时推进。", "timelines"],
    [
      "Anthropic 收购了 Mithril Medicine。Cody Tranbarger与Claude及专业顾问协作。",
      "acquisition",
    ],
  ];
  for (const [text, expected] of examples)
    assert.equal(knowledgeVisualPlan(text).kind, expected);
  assert.equal(
    knowledgeVisualPlan(
      "Acceleration, orchestration and parallel work are different.",
      "en",
    ).kind,
    "timelines",
  );
});
test("unknown prose and negated acquisitions cannot invent an organization or chart", () => {
  for (const text of [
    "Pipeline in a Person",
    "这一章介绍昨天的读书感受。",
    "Anthropic没有收购Mithril Medicine。",
    "Acme did not acquire Beta.",
  ])
    assert.equal(knowledgeVisualPlan(text), null);
  const plan = knowledgeVisualPlan(
    "Acme acquired Beta. Consultants helped.",
    "en",
  );
  assert.deepEqual(plan.labels.slice(0, 2), ["Acme", "Beta"]);
  assert.ok(!JSON.stringify(plan).includes("Anthropic"));
  assert.match(
    knowledgeVisualPlan("加速、编排和并行").qualifier,
    /无真实时间刻度/,
  );
});
test("practice remains practice when its conclusion mentions an acquisition", () => {
  assert.equal(
    knowledgeVisualPlan(
      "先选反复出现的工作，明确资料、输出，人工确认后检查。回到Anthropic收购的案例。",
    ).kind,
    "practice",
  );
});
test("adjacent spoken beats share one chapter clock; seeking is deterministic", () => {
  const beats = [
    { caseIndex: 0, startMs: 0, endMs: 4000 },
    { caseIndex: 1, startMs: 4000, endMs: 8000 },
    { caseIndex: 1, startMs: 8000, endMs: 14000 },
  ];
  assert.deepEqual(knowledgeChapterWindow(beats, 1, 240, 30), {
    frame: 120,
    duration: 300,
  });
  assert.deepEqual(knowledgeChapterWindow(beats, 1, 241, 30), {
    frame: 121,
    duration: 300,
  });
  assert.deepEqual(knowledgeChapterWindow(beats, 1, 240, 30), {
    frame: 120,
    duration: 300,
  });
});
test("source images remain rendered alongside diagrams and authored evidence keeps priority", async () => {
  const require = createRequire(import.meta.url);
  const result = await build({
    stdin: {
      contents:
        "export { KnowledgeExplainer } from './KnowledgeExplainer'; export {KnowledgeVisualScene} from './KnowledgeVisualScene'; export * from './knowledgeMotion';",
      resolveDir: fileURLToPath(new URL("../src/knowledge", import.meta.url)),
    },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    packages: "external",
    plugins: [
      {
        name: "host-fixture",
        setup(builder) {
          builder.onResolve({ filter: /\/host\/Host$/ }, () => ({
            path: "host",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: "export const Host = () => null;",
          }));
        },
      },
    ],
  });
  const module = { exports: {} };
  let currentFrame = 30;
  const runtime = (id) =>
    id === "remotion"
      ? {
          ...require(id),
          useCurrentFrame: () => currentFrame,
          useVideoConfig: () => ({ fps: 30 }),
          AbsoluteFill: ({ children, ...props }) =>
            React.createElement("div", props, children),
          Img: ({ src, alt }) => React.createElement("img", { src, alt }),
        }
      : require(id);
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    runtime,
    module,
    module.exports,
  );
  const props = {
    knowledge: {
      title: "Example",
      chapters: [{ title: "Compare concepts", narration: "加速、编排和并行" }],
    },
    beats: [
      {
        caseIndex: 0,
        section: "case",
        startMs: 0,
        endMs: 8000,
        say: "加速、编排和并行",
        headline: "Compare",
        elements: [
          { type: "image", src: "first.png" },
          { type: "image", src: "second.png" },
        ],
      },
    ],
  };
  const render = () =>
    renderToStaticMarkup(
      React.createElement(module.exports.KnowledgeExplainer, props),
    );
  const html = render();
  assert.match(html, /data-knowledge-diagram="timelines"/);
  assert.match(html, /原耗时（示意）/);
  assert.match(html, /缩短后（示意）/);
  assert.match(html, /工作 A/);
  assert.match(html, /工作 C/);
  currentFrame = 0;
  const firstFrame = render();
  const opacity = firstFrame.match(
    /data-knowledge-visual="timelines"[^>]*opacity:([0-9.]+)/,
  );
  assert.ok(
    opacity && Number(opacity[1]) >= 0.7,
    "the initial preview must show the diagram",
  );
  assert.match(html, /first\.png/);
  assert.match(html, /second\.png/);
  props.beats[0].elements.push({
    type: "chart",
    chartType: "comparison",
    title: "Actual evidence",
    unit: "USD",
    data: [
      { label: "A", value: 10 },
      { label: "B", value: 20 },
    ],
  });
  const evidence = render();
  assert.match(evidence, /Actual evidence/);
  assert.doesNotMatch(evidence, /data-knowledge-diagram/);
  assert.match(evidence, /second\.png/);
  props.knowledge.chapters[0].narration =
    "Acme acquired Beta. Claude was mentioned.";
  props.beats[0].elements = [];
  const acquisition = render();
  assert.match(acquisition, /Acme/);
  assert.match(acquisition, /Beta/);
  assert.doesNotMatch(acquisition, /核心操作者|Core operator/);
  const longName =
    "International Biomedical Research Development Partnership and Advanced Scientific Operations Corporation";
  const longPlan = {
    kind: "acquisition",
    title: "Source relationship",
    labels: [longName, "Beta"],
    qualifier: "Source",
  };
  const labelPages = new Map();
  for (let frame = 0; frame < 120; frame++) {
    const longHtml = renderToStaticMarkup(
      React.createElement(module.exports.KnowledgeVisualScene, {
        plan: longPlan,
        frame,
        duration: 120,
        narration: "",
        locale: "en",
      }),
    );
    const label = longHtml.match(
      /<text data-knowledge-box-label="true" data-label-page="(\d+)"[^>]*>(.*?)<\/text>/,
    );
    assert.ok(label);
    const lines = [...label[2].matchAll(/<tspan[^>]*>(.*?)<\/tspan>/g)].map(
      (match) => match[1],
    );
    assert.ok(lines.length <= 2);
    assert.ok(lines.every((line) => line.length <= 30));
    labelPages.set(Number(label[1]), lines.join(""));
  }
  assert.ok(labelPages.size > 1);
  assert.equal([...labelPages.values()].join(""), longName);

  const hubPlan = knowledgeVisualPlan(
    "项目看板里AI协作，等待结果，整理资料，作出判断。",
  );
  const hub = (frame) =>
    renderToStaticMarkup(
      React.createElement(module.exports.KnowledgeVisualScene, {
        plan: hubPlan,
        frame,
        duration: 1000,
        narration: hubPlan.labels.join(" "),
        locale: "zh",
      }),
    );
  for (const [index, [x, y]] of [
    [150, 105],
    [930, 105],
    [150, 345],
    [930, 345],
  ].entries()) {
    const geometry = module.exports.hubBranchGeometry(x, y);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const point = module.exports.quadraticBezierPoint(geometry, t);
      assert.ok(
        Math.abs(
          point.x -
            (664 * (1 - t) ** 2 + (x + 110) * (2 * t * (1 - t) + t * t)),
        ) < 1e-8,
      );
      assert.ok(
        Math.abs(point.y - (260 * (1 - t * t) + (y + 56) * t * t)) < 1e-8,
      );
      const frame = (t * 105 - index * 24 + 105) % 105;
      const html = hub(frame);
      const branch = html.slice(html.indexOf(`data-hub-branch="${index}"`));
      const actualPath = branch.match(
        /<path d="M([\d.-]+) ([\d.-]+) Q([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"/,
      );
      const actualDot = branch.match(
        new RegExp(
          `data-hub-packet="${index}" cx="([0-9.-]+)" cy="([0-9.-]+)"`,
        ),
      );
      assert.ok(actualPath && actualDot);
      const [sx, sy, cx, cy, ex, ey] = actualPath.slice(1).map(Number);
      const phase = ((frame + index * 24) % 105) / 105;
      assert.ok(
        Math.abs(
          Number(actualDot[1]) -
            ((1 - phase) ** 2 * sx +
              2 * (1 - phase) * phase * cx +
              phase ** 2 * ex),
        ) < 1e-8,
      );
      assert.ok(
        Math.abs(
          Number(actualDot[2]) -
            ((1 - phase) ** 2 * sy +
              2 * (1 - phase) * phase * cy +
              phase ** 2 * ey),
        ) < 1e-8,
      );
      assert.equal(html, hub(frame), "Bezier seeking must be deterministic");
    }
    assert.deepEqual(
      module.exports.quadraticBezierPoint(geometry, 0),
      geometry.start,
    );
    assert.deepEqual(
      module.exports.quadraticBezierPoint(geometry, 1),
      geometry.end,
    );
  }
  for (const text of [
    "项目看板里AI协作，等待结果，整理资料，作出判断。",
    "AI帮助版本开发、用户反馈和内容推广。",
    "AI持续协作，读取资料，提取待办，使用工具执行，返回结果供人检查。",
  ]) {
    const plan = knowledgeVisualPlan(text);
    const scene = (frame) =>
      renderToStaticMarkup(
        React.createElement(module.exports.KnowledgeVisualScene, {
          plan,
          frame,
          duration: 240,
          narration: text,
          locale: "zh",
        }),
      );
    assert.notEqual(
      scene(180),
      scene(195),
      `${plan.kind} should keep moving after halfway`,
    );
    assert.equal(scene(180), scene(180), "seeking must be deterministic");
  }
});

test("spoken concepts override timeline focus without restarting the chapter clock", () => {
  const plan = knowledgeVisualPlan("加速、编排、并行");
  assert.deepEqual(
    knowledgeVisualFocus(plan, "眼下的机会在编排和并行", 0.1),
    [1, 2],
  );
  assert.deepEqual(knowledgeVisualFocus(plan, "接着来看", 0.5), [1]);
  for (const text of [
    "Acme plans to acquire Beta.",
    "Anthropic拟收购Mithril Medicine",
    "未证实的收购传闻",
  ])
    assert.equal(knowledgeVisualPlan(text), null);
});

test("uncertain acquisitions and unsupported AI workflows stay in the source explanation", () => {
  for (const text of [
    "Anthropic不会收购Mithril Medicine。",
    "Acme is seeking to acquire Beta.",
    "If Acme acquires Beta, the plan changes.",
    "Acme could acquire Beta.",
    "Acme denies plans to acquire Beta.",
    "项目看板只记录项目，没有AI参与。",
    "AI持续协作，读取资料后给出结果。",
    "项目看板里有AI，但没有材料或决策状态。",
  ])
    assert.equal(knowledgeVisualPlan(text), null, text);
  assert.equal(
    knowledgeVisualPlan("Acme acquired Beta.", "en").operator,
    undefined,
  );
  assert.equal(
    knowledgeVisualPlan("Acme acquired Beta. Claude was mentioned.", "en")
      .operator,
    undefined,
  );
  assert.equal(
    knowledgeVisualPlan(
      "Anthropic收购了Mithril Medicine，创始人是Cody Tranbarger。Claude参与协作。",
    ).operator,
    "Cody Tranbarger",
  );
});
