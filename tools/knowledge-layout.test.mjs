import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { createKnowledgeOutline, buildKnowledgeProps } from "./knowledge-content.mjs";

const require = createRequire(import.meta.url);
const result = await build({ stdin: { contents: "export {KnowledgeExplainer} from './KnowledgeExplainer'; export * from './knowledgeLayout';", resolveDir: fileURLToPath(new URL("../src/knowledge", import.meta.url)), loader: "tsx" }, bundle: true, write: false, format: "cjs", platform: "node", packages: "external" });
let frame = 45;
const module = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(id => id === "remotion" ? { ...require(id), useCurrentFrame: () => frame, useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080 }), staticFile: src => `/assets/${src}`, AbsoluteFill: ({ children, ...props }) => React.createElement("div", props, children), Img: props => React.createElement("img", props), Audio: props => React.createElement("audio", props) } : require(id), module, module.exports);
const { KnowledgeExplainer, knowledgeDuration, knowledgeBeatIndex, KNOWLEDGE_VIDEO, KNOWLEDGE_STAGE, KNOWLEDGE_CAPTIONS } = module.exports;

test("knowledge frames preserve chapter boundaries and ceiling-rounded export duration", () => {
  const beats = [{ startMs: 0, endMs: 1234 }, { startMs: 1800, endMs: 4001 }];
  assert.equal(knowledgeDuration(beats), 121);
  assert.equal(knowledgeBeatIndex(beats, 36), 0);
  assert.equal(knowledgeBeatIndex(beats, 45), 0);
  assert.equal(knowledgeBeatIndex(beats, 54), 1);
  assert.equal(knowledgeBeatIndex(beats, 999), 1);
  assert.equal(KNOWLEDGE_VIDEO.width / KNOWLEDGE_VIDEO.height, 16 / 9);
  for (const box of [KNOWLEDGE_STAGE, KNOWLEDGE_CAPTIONS]) {
    assert.ok(box.left + box.width <= KNOWLEDGE_VIDEO.width);
    assert.ok(box.top + box.height <= KNOWLEDGE_VIDEO.height);
  }
});

test("real planned knowledge props render chapters, fixed presenter and yellow captions without weekly chrome", () => {
  const document = createKnowledgeOutline({ title: "解释一个知识点", source: "## 定义\n先收集资料，再检查证据，最后整理结果。\n\n## 边界\n示意不等于已经验证。" });
  const props = buildKnowledgeProps(document);
  const before = JSON.stringify(props);
  frame = 45;
  const html = renderToStaticMarkup(React.createElement(KnowledgeExplainer, props));
  assert.match(html, /data-knowledge-video/);
  assert.match(html, /当前章节/);
  assert.doesNotMatch(html, /本期案例|独立开发变现周刊|下周见/);
  assert.match(html, /data-host-presenter/);
  assert.match(html, /width:560px;height:747px/);
  assert.match(html, /data-knowledge-captions/);
  assert.match(html, /color:#FFE34D/i);
  assert.equal(JSON.stringify(props), before);
  const next = props.beats.find(beat => beat.caseIndex === 1);
  frame = Math.ceil(next.startMs * 30 / 1000) + 1;
  assert.match(renderToStaticMarkup(React.createElement(KnowledgeExplainer, props)), /边界/);
});

test("English knowledge chrome follows locale and no narration is silently substituted", () => {
  const props = buildKnowledgeProps(createKnowledgeOutline({ title: "Explain a workflow", locale: "en", source: "## Review\nFirst collect notes, then review the source, and finally share the result." }));
  frame = 45;
  const html = renderToStaticMarkup(React.createElement(KnowledgeExplainer, props));
  assert.match(html, /CURRENT CHAPTER/);
  assert.match(html, /独立开发新知/);
  assert.match(html, /First collect notes/);
  assert.doesNotMatch(html, /当前章节|本期案例|下周见/);
});

test("landscape captions use the real stage width and do not leave a lone final Chinese character", () => {
  const say = "做 Claude 的 Anthropic，收购了一家当时只有一名全职员工的药物研发公司。";
  const props = { locale: "zh", knowledge: { title: "字幕验证", chapters: [{ title: "字幕验证", narration: say }] }, beats: [{ section: "case", caseIndex: 0, startMs: 0, endMs: 10000, say, headline: "字幕验证", host: "point", elements: [] }] };
  for (const position of [1, 299]) {
    frame = position;
    const html = renderToStaticMarkup(React.createElement(KnowledgeExplainer, props));
    assert.match(html, /公司。/);
    assert.doesNotMatch(html, />司。?<\/div>/);
  }
});
