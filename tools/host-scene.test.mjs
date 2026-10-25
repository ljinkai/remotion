import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { transform } from "esbuild";

const source = await readFile(
  new URL("../src/host-explainer/sceneContent.ts", import.meta.url),
  "utf8",
);
const { code } = await transform(source, { loader: "ts", format: "esm" });
const { deriveHostScene, sceneMetric, sceneSteps } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

test("legacy beats retain useful layouts, including source images alongside metrics", () => {
  const image = { type: "image", src: "case-images/03-gojiberryai.png" };
  const metric = { type: "bar", label: "年收入", to: 4000000 };
  assert.equal(deriveHostScene([image, metric]), "product");
  assert.equal(deriveHostScene([metric]), "metric");
  assert.equal(
    deriveHostScene([{ type: "phone", title: "产品", body: "打开产品" }]),
    "steps",
  );
  assert.equal(
    deriveHostScene([{ type: "card", title: "持续打磨产品" }]),
    "statement",
  );
  assert.equal(deriveHostScene([image, metric], "metric"), "metric");
  assert.equal(
    deriveHostScene([
      image,
      {
        type: "chart",
        chartType: "milestones",
        unit: "MRR",
        title: "阶段",
        data: [],
      },
    ]),
    "metric",
  );
  assert.equal(
    deriveHostScene([
      image,
      {
        type: "relationship",
        title: "渠道选项",
        nodes: ["Reddit", "内容营销"],
        mode: "focus",
      },
    ]),
    "relationship",
  );
});

test("metric hero preserves full authored currencies, multipliers and duration units", () => {
  for (const text of ["$5k MRR", "$4M ARR", "400万美元", "3个月"]) {
    const value = sceneMetric([
      { type: "bar", label: "原文数据", to: 4 },
      { type: "text", text, size: "xl" },
    ]);
    assert.equal(value.value, text);
  }
  assert.equal(
    sceneMetric([
      { type: "text", text: "案例 3", size: "m" },
      { type: "text", text: "$4M ARR", size: "xl" },
    ]).value,
    "$4M ARR",
  );
});

test("progressive steps contain supplied content without invented product actions", () => {
  assert.deepEqual(
    sceneSteps([
      {
        type: "card",
        title: "原文操作",
        lines: ["打开产品", "输入内容", "发布结果"],
      },
    ]),
    ["打开产品", "输入内容", "发布结果"],
  );
  assert.deepEqual(
    sceneSteps([
      {
        type: "phone",
        title: "实际产品名称",
        body: "输入内容",
        action: "发布",
      },
    ]),
    ["输入内容", "发布"],
  );
  assert.deepEqual(
    sceneSteps([{ type: "phone", title: "实际产品名称", body: "打开产品" }]),
    ["打开产品"],
  );
});
