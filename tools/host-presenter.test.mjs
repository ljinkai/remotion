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
    contents: `export {Host} from './host/Host'; export * from './host/hostPresenter'; export * from './host/hostAnimation'; export {HostLocaleProvider} from './hostLocale'; export {HostExplainer} from './HostFromBeats'; export {HostExplainerDemo} from './HostExplainer';`,
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

test("female presenter stays anchored across timeline frames and seeking", () => {
  currentFrame = 48;
  const first = host("zh", 48);
  assert.doesNotMatch(first, /transform:rotate|transform-origin/);
  currentFrame = 160;
  assert.equal(host("zh", 48), first);
  currentFrame = 48;
  assert.equal(host("zh", 48), first);
  currentFrame = 0;
});
