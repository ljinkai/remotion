import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { transform } from "esbuild";
import ts from "typescript";

const source = await readFile(
  new URL("../src/host-explainer/host/hostAnimation.ts", import.meta.url),
  "utf8",
);
const { code } = await transform(source, { loader: "ts", format: "esm" });
const { hostAnimationState, hostFrameLayout } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

test("host keeps the original normal and rich-scene sizes", () => {
  assert.deepEqual(hostFrameLayout(), { width: 560, height: 747, bottom: -36 });
  assert.deepEqual(hostFrameLayout(true), {
    width: 360,
    height: 480,
    bottom: -24,
  });
});

test("beat-driven scenes all use the same default host layout", async () => {
  const content = await readFile(
    new URL("../src/host-explainer/HostFromBeats.tsx", import.meta.url),
    "utf8",
  );
  const tree = ts.createSourceFile(
    "HostFromBeats.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const hosts = [];
  const visit = (node) => {
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(tree) === "Host"
    )
      hosts.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(hosts.length, 1, "all scene kinds must share one host renderer");
  const attributes = hosts[0].attributes.properties;
  assert.equal(
    attributes.some((item) => ts.isJsxSpreadAttribute(item)),
    false,
    "scene-specific props cannot override host sizing",
  );
  assert.equal(
    attributes.some(
      (item) =>
        ts.isJsxAttribute(item) && item.name.getText(tree) === "compact",
    ),
    false,
    "rich scenes must not shrink the shared host",
  );
  assert.deepEqual(hostFrameLayout(), { width: 560, height: 747, bottom: -36 });
});
const state = (overrides = {}) =>
  hostAnimationState({
    frame: 0,
    fps: 30,
    localFrame: 0,
    speakFrom: 12,
    speakTo: 138,
    pose: "point",
    ...overrides,
  });

test("speaking interval includes start, excludes end, and rests outside", () => {
  assert.equal(state({ localFrame: 11 }).mouth, "closed");
  assert.equal(state({ localFrame: 12 }).mouth, "small");
  assert.equal(state({ localFrame: 137 }).speaking, true);
  assert.equal(state({ localFrame: 138 }).mouth, "closed");
  assert.equal(state({ localFrame: 200 }).speaking, false);
});

test("speaking interval reaches all four mouths without changing geometry", () => {
  const shapes = new Set(
    Array.from({ length: 100 }, (_, i) => state({ localFrame: 12 + i }).mouth),
  );
  assert.deepEqual([...shapes].sort(), ["closed", "open", "round", "small"]);
});

test("blink boundaries are deterministic across seeking and frame rates", () => {
  assert.equal(state({ frame: 47 }).blink, false);
  assert.equal(state({ frame: 48 }).blink, true);
  assert.equal(state({ frame: 51 }).blink, true);
  assert.equal(state({ frame: 52 }).blink, false);
  assert.equal(state({ frame: 96, fps: 60 }).blink, true);
  const expected = state({ frame: 49, localFrame: 49 });
  state({ frame: 200, localFrame: 200 });
  assert.deepEqual(state({ frame: 49, localFrame: 49 }), expected);
  assert.equal(state({ frame: 289 }).blink, true);
});

test("wrist is bounded and pose cues only vary timing on same pointing asset", () => {
  for (const pose of ["point", "cheer"]) {
    const angles = Array.from(
      { length: 240 },
      (_, frame) => state({ frame, pose }).arm,
    );
    assert.ok(Math.min(...angles) >= -4);
    assert.ok(Math.max(...angles) <= 3);
    assert.ok(Math.min(...angles) < -3.9);
    assert.ok(Math.max(...angles) > 2.9);
  }
  assert.notEqual(
    state({ frame: 45 }).arm,
    state({ frame: 45, pose: "cheer" }).arm,
  );
});
