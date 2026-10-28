import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const result = await build({
  stdin: {
    contents: `export {Host} from './host/Host'; export * from './host/hostPresenter'; export * from './host/hostAnimation'; export * from './host/femaleHostAnimation'; export {HostLocaleProvider} from './hostLocale'; export {HostExplainer} from './HostFromBeats'; export {HostExplainerDemo} from './HostExplainer';`,
    resolveDir: fileURLToPath(
      new URL("../src/host-explainer", import.meta.url),
    ),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  format: "cjs",
  platform: "node",
  packages: "external",
});
let currentFrame = 0;
const runtime = (id) =>
  id === "remotion"
    ? {
        ...require(id),
        useCurrentFrame: () => currentFrame,
        useVideoConfig: () => ({
          fps: 30,
          width: 1080,
          height: 1920,
          durationInFrames: 450,
        }),
        staticFile: (src) => `/assets/${src}`,
        AbsoluteFill: ({ children, ...props }) =>
          React.createElement("div", props, children),
        Sequence: ({ children }) => children,
        Img: (props) => React.createElement("img", props),
      }
    : require(id);
const module = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(
  runtime,
  module,
  module.exports,
);
const {
  Host,
  HostLocaleProvider,
  HostExplainer,
  HostExplainerDemo,
  femaleHostSprite,
  femaleHostMouthCell,
  hostAnimationState,
  femaleHostAnimation,
  FEMALE_BLINK_STARTS,
} = module.exports;
const render = (element) => renderToStaticMarkup(element);
const host = (locale, localFrame = 0) =>
  render(
    React.createElement(
      HostLocaleProvider,
      { value: locale },
      React.createElement(Host, {
        pose: "point",
        localFrame,
        speakFrom: 12,
        speakTo: 138,
      }),
    ),
  );

test("Chinese uses the Asian female sprite and English retains the SVG male", () => {
  const chinese = host("zh");
  assert.match(chinese, /data-host-character="asian-female"/);
  assert.match(chinese, /asian-female-host-sprite.png/);
  assert.match(chinese, /data-host-mouth="closed"/);
  const english = host("en");
  assert.match(english, /data-host-character="svg"/);
  assert.doesNotMatch(english, /asian-female-host-sprite/);
});

test("female sprite maps each mouth to exactly one quadrant and rests outside narration", () => {
  const w = femaleHostSprite.width / 2;
  const h = femaleHostSprite.height / 2;
  for (const [mouth, x, y] of [
    ["closed", 0, 0],
    ["small", w, 0],
    ["open", 0, h],
    ["round", w, h],
  ])
    assert.deepEqual(femaleHostMouthCell(mouth), { x, y, width: w, height: h });
  for (const localFrame of [0, 11, 138, 200])
    assert.match(host("zh", localFrame), /data-host-mouth="closed"/);
  for (const localFrame of [12, 17, 30]) {
    const state = hostAnimationState({
      frame: 0,
      fps: 30,
      localFrame,
      speakFrom: 12,
      speakTo: 138,
      pose: "point",
    });
    const cell = femaleHostMouthCell(state.mouth);
    assert.ok(
      host("zh", localFrame).includes(
        `viewBox="${cell.x} ${cell.y} ${w} ${h}"`,
      ),
    );
  }
});

const beat = (section) => ({
  section,
  startMs: 0,
  endMs: 8000,
  say: "An independent maker shares useful lessons.",
  headline: "Build useful products",
  accent: "useful",
  host: "point",
  caseIndex: section === "case" ? 0 : null,
  elements: [],
});

test("beat scenes and single-post intro covers share the locale-selected character", () => {
  for (const locale of ["zh", "en"]) {
    const expected = locale === "zh" ? "asian-female" : "svg";
    for (const contentMode of ["weekly", "single_post"]) {
      const html = render(
        React.createElement(HostExplainer, {
          locale,
          contentMode,
          beats: [beat("intro")],
        }),
      );
      assert.ok(html.includes(`data-host-character="${expected}"`));
    }
  }
});

test("Chinese demo explicitly selects the female host, independent of its parent locale", () => {
  const html = render(
    React.createElement(
      HostLocaleProvider,
      { value: "en" },
      React.createElement(HostExplainerDemo),
    ),
  );
  assert.match(html, /data-host-character="asian-female"/);
});

test("female body and framing remain anchored while local face animation changes", () => {
  currentFrame = 48;
  const first = host("zh", 48);
  currentFrame = 165;
  const nodded = host("zh", 48);
  const body = (html) =>
    html.match(/<g data-female-part="anchored-body"[^>]*>(.*?)<\/g>/)[0];
  const frame = (html) =>
    html.match(/data-host-presenter="true" style="([^"]+)"/)[1];
  assert.equal(body(first), body(nodded));
  assert.equal(frame(first), frame(nodded));
  assert.doesNotMatch(body(nodded), /transform=/);
  assert.doesNotMatch(frame(nodded), /rotate|translate|scale/);
  assert.notEqual(first, nodded);
  currentFrame = 48;
  assert.equal(host("zh", 48), first);
  currentFrame = 0;
});
const face = (frame, extra = {}) =>
  femaleHostAnimation({
    frame,
    fps: 30,
    localFrame: 50,
    speakFrom: 0,
    speakTo: 300,
    ...extra,
  });
test("blink has continuous closing, hold and opening with open endpoints", () => {
  for (const start of FEMALE_BLINK_STARTS) {
    assert.ok(Math.abs(face(start * 30).blink) < 1e-8);
    assert.ok(Math.abs(face((start + 0.28) * 30).blink) < 1e-8);
    assert.ok(
      face((start + 0.05) * 30).blink > 0 &&
        face((start + 0.05) * 30).blink < 1,
    );
    assert.equal(face((start + 0.11) * 30).blink, 1);
    assert.ok(
      face((start + 0.2) * 30).blink > 0 && face((start + 0.2) * 30).blink < 1,
    );
  }
  for (let frame = 0; frame < 930; frame++) {
    const state = face(frame);
    assert.ok(state.blink >= 0 && state.blink <= 1);
    assert.equal(state.bodyX, 0);
    assert.equal(state.bodyY, 0);
    assert.equal(state.bodyAngle, 0);
    assert.equal(state.bodyScale, 1);
  }
});
test("head movement is bounded and smooth, follows absolute time and never restarts a beat", () => {
  let previous = face(0);
  for (let frame = 1; frame < 930; frame++) {
    const state = face(frame);
    assert.ok(Math.abs(state.headAngle) <= 0.18 + 1e-8);
    assert.ok(Math.abs(state.headY) <= 0.65 + 1e-8);
    assert.ok(Math.abs(state.headAngle - previous.headAngle) < 0.04);
    assert.ok(Math.abs(state.headY - previous.headY) < 0.1);
    previous = state;
  }
  const first = face(165);
  assert.deepEqual(face(165, { localFrame: 80 }), first);
  face(0);
  assert.deepEqual(face(165), first);
  assert.deepEqual(
    face(330, { fps: 60, localFrame: 100, speakTo: 600 }),
    first,
  );
  const still = face(165, { enabled: false });
  assert.equal(still.headAngle, 0);
  assert.equal(still.headY, 0);
  assert.equal(still.blink, 0);
});
test("pause window stays closed while expression intensity settles smoothly", () => {
  assert.equal(face(165, { localFrame: 301 }).speaking, false);
  assert.equal(face(165, { localFrame: 301 }).intensity, 0);
  assert.ok(
    face(165, { localFrame: 2 }).intensity <
      face(165, { localFrame: 6 }).intensity,
  );
  currentFrame = 72;
  const eyesClosed = host("zh", 150);
  assert.match(eyesClosed, /data-host-mouth="closed"/);
  assert.match(eyesClosed, /data-female-part="eyelids"/);
  assert.match(eyesClosed, /linearGradient/);
  assert.doesNotMatch(eyesClosed, /data-female-part="eyelids"[^>]*fill="#000/);
  currentFrame = 0;
});
