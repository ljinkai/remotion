import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "node:buffer";
import { URL, fileURLToPath } from "node:url";
import { build } from "esbuild";

const result = await build({
  entryPoints: [
    fileURLToPath(
      new URL("../src/host-explainer/richSceneMath.ts", import.meta.url),
    ),
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const {
  chartPresentation,
  continuousSceneWindow,
  imageFocusGeometry,
  relationshipLabelLines,
} = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);

test("monthly chart keeps the evidence scale and lower bound separate from annual values", () => {
  const chart = {
    type: "chart",
    chartType: "milestones",
    title: "MRR 阶段",
    unit: "USD / 月 · MRR",
    data: [0, 6000, 25000, 75000, 150000].map((value, index) => ({
      label: `阶段${index}`,
      value,
      display: index === 4 ? "$150k+" : `$${value}`,
    })),
  };
  const before = JSON.stringify(chart);
  const model = chartPresentation(chart);
  assert.equal(model.maximum, 150000);
  assert.equal(model.unit, "USD / 月 · MRR");
  assert.deepEqual(model.lowerBounds, [4]);
  assert.equal(chart.data[4].display, "$150k+");
  assert.equal(JSON.stringify(chart), before);
});

test("one disclosed number cannot become a growth trajectory", () => {
  for (const chartType of ["single", "milestones", "comparison"]) {
    const model = chartPresentation({
      type: "chart",
      chartType,
      title: "年度披露",
      unit: "ARR",
      data: [{ label: "当前披露", value: 4000000, display: "$4M ARR" }],
    });
    assert.equal(model.kind, "single");
    assert.equal(model.unit, "ARR");
  }
  assert.equal(
    chartPresentation({
      type: "chart",
      chartType: "proportion",
      unit: "%",
      data: [
        { label: "来源A", value: 60 },
        { label: "来源B", value: 30 },
      ],
    }).maximum,
    100,
  );
});

test("overview contains the whole source; focused image centers the actual normalized ROI", () => {
  const roi = { x: 0.5, y: 0.2, width: 0.47, height: 0.48 };
  const whole = imageFocusGeometry(1000, 1200, 948, 868, roi, 0);
  assert.equal(whole.scale, 1);
  assert.ok(whole.left >= -0.001 && whole.top >= -0.001);
  assert.ok(whole.left + whole.imageWidth <= 948 + 0.001);
  assert.ok(whole.top + whole.imageHeight <= 868 + 0.001);
  const focused = imageFocusGeometry(1000, 1200, 948, 868, roi, 1);
  assert.ok(focused.scale > 1);
  const centerX =
    focused.left + focused.imageWidth * (roi.x + roi.width / 2) * focused.scale;
  const centerY =
    focused.top +
    focused.imageHeight * (roi.y + roi.height / 2) * focused.scale;
  assert.ok(Math.abs(centerX - 948 / 2) < 0.001);
  assert.ok(Math.abs(centerY - 868 / 2) < 0.001);
  assert.ok(focused.imageWidth * roi.width * focused.scale <= 948 + 0.001);
  assert.ok(focused.imageHeight * roi.height * focused.scale <= 868 + 0.001);
});

const product = (caseIndex, startMs, endMs) => ({
  caseIndex,
  startMs,
  endMs,
  scene: "product",
  elements: [{ type: "image", src: "source.png" }],
});
test("adjacent subtitles do not restart a held image focus or relationship diagram", () => {
  const beats = [
    product(0, 0, 4000),
    product(0, 4300, 8000),
    product(1, 8000, 12000),
  ];
  assert.deepEqual(continuousSceneWindow(beats, 1, 144, 30), {
    frame: 144,
    duration: 240,
  });
  assert.deepEqual(continuousSceneWindow(beats, 2, 255, 30), {
    frame: 15,
    duration: 120,
  });
  const relation = (startMs, endMs, focus) => ({
    caseIndex: 0,
    startMs,
    endMs,
    scene: "relationship",
    elements: [
      {
        type: "relationship",
        nodes: ["主动外拓", "Reddit"],
        focus,
        mode: "focus",
      },
    ],
  });
  const relations = [relation(0, 4000, undefined), relation(4000, 8000, 0)];
  assert.deepEqual(continuousSceneWindow(relations, 1, 150, 30), {
    frame: 150,
    duration: 240,
  });
  continuousSceneWindow(relations, 0, 20, 30);
  assert.deepEqual(continuousSceneWindow(relations, 1, 150, 30), {
    frame: 150,
    duration: 240,
  });
});

test("relationship label wrapping retains full channel names", () => {
  const name = "Google Ads / 内容营销与搜索";
  const lines = relationshipLabelLines(name);
  assert.ok(lines.length > 1);
  assert.equal(lines.join("").replace(/\s/g, ""), name.replace(/\s/g, ""));
  for (const line of lines)
    assert.ok(
      [...line].reduce(
        (weight, char) => weight + (char.charCodeAt(0) > 255 ? 1 : 0.55),
        0,
      ) <= 6.001,
    );
});
