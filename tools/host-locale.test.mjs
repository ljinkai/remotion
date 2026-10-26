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
    contents: `export {HostExplainer} from './HostFromBeats'; export * from './hostLocale'; export * from './hostCaptions'; export * from './hostTypes'; export {explanationTextPages} from './explanationContent'; export {relationshipLabelLines} from './richSceneMath';`,
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
        useVideoConfig: () => ({
          fps: 30,
          width: 1080,
          height: 1920,
          durationInFrames: 240,
        }),
        AbsoluteFill: ({ children, ...props }) =>
          React.createElement("div", props, children),
        Img: (props) =>
          React.createElement(
            "img",
            Object.fromEntries(
              Object.entries(props).filter(
                ([key]) => !["maxRetries", "onLoad", "onError"].includes(key),
              ),
            ),
          ),
      }
    : require(id);
new Function("require", "module", "exports", result.outputFiles[0].text)(
  runtime,
  module,
  module.exports,
);
const {
  HostExplainer,
  hostLabels,
  hostCaptionPages,
  hostCaptionPageAtFrame,
  enSampleHostProps,
  explanationTextPages,
  relationshipLabelLines,
} = module.exports;
const render = (props) =>
  renderToStaticMarkup(React.createElement(HostExplainer, props));
const beat = (section, elements = []) => ({
  section,
  elements,
  say: "Source text remains unchanged.",
  headline: "A complete English headline",
  accent: "English",
  host: "point",
  caseIndex: section === "case" ? 0 : null,
  startMs: 0,
  endMs: 8000,
});

test("English intro, closing, case chrome and empty states render without Chinese defaults", () => {
  assert.match(render({ locale: "en" }), /No scenes yet/);
  assert.match(render({}), /还没有分镜/);
  for (const [section, label] of [
    ["intro", "Intro"],
    ["closing", "Closing"],
    ["case", "Case"],
  ]) {
    const html = render({ locale: "en", beats: [beat(section)], cases: [{}] });
    assert.ok(html.includes(label));
    assert.ok(html.includes("Cases in this episode"));
    assert.doesNotMatch(html, /开场|结尾|本期案例|案例/);
  }
});

test("English source, relationship and evidence labels reach nested renderers; source captions stay original", () => {
  const nodes = render({
    locale: "en",
    beats: [
      {
        ...beat("case", [
          {
            type: "relationship",
            title: "Channels",
            nodes: ["LinkedIn", "OpenTweet"],
            mode: "focus",
          },
        ]),
        scene: "relationship",
      },
    ],
  });
  assert.match(nodes, /Channel options/);
  assert.match(nodes, /Overview/);
  const image = render({
    locale: "en",
    beats: [
      {
        ...beat("case", [
          { type: "image", src: "example.png", caption: "原文作者截图" },
        ]),
        scene: "product",
      },
    ],
  });
  assert.match(image, /原文作者截图/);
  assert.match(image, /Source detail/);
  const chart = render({
    locale: "en",
    beats: [
      {
        ...beat("case", [
          {
            type: "chart",
            chartType: "milestones",
            title: "Monthly revenue",
            unit: "MRR",
            data: [
              { label: "Start", value: 100 },
              { label: "Later", value: 200, display: "$200+" },
            ],
          },
        ]),
        scene: "metric",
      },
    ],
  });
  assert.match(chart, /Stages, not dates/);
  assert.match(chart, /lower bound/);
  assert.doesNotMatch(chart, /横轴|原文阶段/);
  assert.equal(hostLabels.en.unavailable, "Image unavailable");
});

test("long English headlines and captions preserve all text and complete brand words in at most two lines", () => {
  const text =
    "OpenTweet lets Claude and Codex publish through MCP/REST with LinkedIn scheduling and extraordinarily detailed publication records.";
  for (const layout of [undefined, { width: 952, paddingX: 0, fontSize: 56 }]) {
    const pages = hostCaptionPages(text, layout);
    assert.equal(pages.flatMap((page) => page.lines).join(""), text);
    assert.ok(pages.every((page) => page.lines.length <= 2));
    for (const word of [
      "OpenTweet",
      "Claude",
      "Codex",
      "MCP/REST",
      "LinkedIn",
      "extraordinarily",
    ])
      assert.ok(
        pages.some((page) => page.lines.some((line) => line.includes(word))),
        word,
      );
    assert.equal(
      hostCaptionPageAtFrame(pages, 239, 240).index,
      pages.length - 1,
    );
  }
  assert.equal(explanationTextPages(text, 24).join(""), text);
  assert.deepEqual(relationshipLabelLines("LinkedIn OpenTweet"), [
    "LinkedIn",
    "OpenTweet",
  ]);
});

test("English sample is entirely English while default Chinese labels remain available", () => {
  assert.equal(enSampleHostProps.locale, "en");
  assert.doesNotMatch(JSON.stringify(enSampleHostProps), /[\u4e00-\u9fff]/);
  assert.equal(hostLabels.zh.cases, "本期案例");
  assert.equal(hostLabels.zh.unavailable, "图片暂时无法载入");
});

test("currency, decimals, thousands separators and percentages remain indivisible", () => {
  const tokens = ["15,000", "$3,700", "1.5", "25%", "$15,000.50", "€3,700"];
  const text = `Reported ${tokens.join(" and ")} in the original source.`;
  for (const pages of [
    hostCaptionPages(text).flatMap((page) => page.lines),
    explanationTextPages(text, 14),
  ]) {
    assert.equal(pages.join(""), text);
    for (const token of tokens)
      assert.ok(
        pages.some((page) => page.includes(token)),
        token,
      );
  }
});

test("short English fact and full-width feature labels are visible together without premature pagination", () => {
  const html = render({
    locale: "en",
    beats: [
      {
        ...beat("case", [
          {
            type: "explanation",
            layout: "features",
            title: "Reported results",
            items: [
              { label: "The product had 15,000 registered users" },
              { label: "234 paying customers" },
              { label: "$3,700 in monthly revenue" },
            ],
          },
        ]),
        scene: "metric",
      },
    ],
  });
  assert.match(html, /The product had 15,000 registered users/);
  assert.match(html, /\$3,700 in monthly revenue/);
  const feature = render({
    locale: "en",
    beats: [
      beat("case", [
        {
          type: "explanation",
          layout: "features",
          title: "Features",
          items: [
            { label: "Publish directly" },
            { label: "Schedule posts" },
            { label: "Support publishing to multiple platforms." },
          ],
        },
      ]),
    ],
  });
  assert.match(feature, /Support publishing to multiple platforms\./);
});


test("single-post frame zero and full intro show the source image and static cover", () => {
  const props = {
    contentMode: "single_post",
    locale: "en",
    coverTitle: "Trustworthy SaaS solves real problems",
    introSubtitle: "Customers still pay for dependable tools.",
    sourceUrl: "https://www.reddit.com/r/indiehackers/post",
    sourceAuthor: "Original maker",
    cases: [{ images: ["https://example.com/original.png"] }],
    beats: [beat("intro"), { ...beat("case"), startMs: 8000, endMs: 16000 }],
  };
  try {
    for (const frame of [0, 30, 239]) {
      currentFrame = frame;
      const html = render(props);
      assert.match(html, /data-single-post-cover/);
      assert.match(html, /data-cover-content="source-image"/);
      assert.match(html, /https:\/\/example.com\/original.png/);
      assert.match(html, /Trustworthy SaaS solves real problems/);
      assert.match(html, /Original maker/);
      assert.doesNotMatch(html, /opacity:0|scale\(0.86\)/);
    }
    currentFrame = 240;
    assert.doesNotMatch(render(props), /data-single-post-cover/);
  } finally { currentFrame = 30; }
});

test("imageless single-post cover uses the actual English hook without invented metrics", () => {
  currentFrame = 0;
  try {
    const html = render({
      contentMode: "single_post", locale: "en", beats: [beat("intro")],
      coverTitle: "Build tools customers trust",
      introSubtitle: "Customers still pay for dependable tools.",
    });
    assert.match(html, /data-cover-content="key-point"/);
    assert.match(html, /Customers still pay for dependable tools/);
    assert.doesNotMatch(html, /<img|\$12,000|opacity:0/);
  } finally { currentFrame = 30; }
});
