import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createKnowledgeOutline, buildKnowledgeProps, validateKnowledgeDocument, splitKnowledgeNarration, retimeKnowledgeProps } from "./knowledge-content.mjs";
import { organizeKnowledge } from "./knowledge-script.mjs";
import { knowledgeSample } from "./knowledge-sample.mjs";
import { compositionIdForProps, enrichBeatScenes } from "./beat-spec.mjs";
import { buildNarrationPlan, SCENE_BREAK_MS } from "./continuous-narration.mjs";
import { writeNarrationCache } from "./tts-cache.mjs";
import { synthesizeVideoProps } from "./synthesize-props.mjs";

const config = () => ({ baseUrl: "https://test.invalid", model: "test", apiKey: "test" });
const fakeAi = (chapters) => async () => new globalThis.Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: "模型不能覆盖用户标题", chapters }) } }] }));

test("offline outline preserves all six source chapters, paragraphs and medical qualifications without paid calls", async () => {
  const result = await organizeKnowledge(knowledgeSample, { getConfig: () => { throw Error("must not access credentials"); }, fetcher: () => { throw Error("must not call a model"); } });
  assert.equal(result.method, "offline");
  assert.equal(result.document.source, knowledgeSample.source);
  assert.equal(result.document.chapters.length, 6);
  assert.ok(result.document.chapters[1].narration.includes("临床前"));
  assert.ok(result.document.chapters[1].sourceNote.includes("anthropic.com"));
  assert.equal(result.document.chapters[0].narration.startsWith(result.document.chapters[0].title), false);
  const long = "这是需要完整保留的知识材料。".repeat(60);
  assert.equal(createKnowledgeOutline({ source: long }).chapters[0].narration, long);
  assert.ok(long.length > 200);
});

test("planning keeps narration intact, splits readable beats, estimates realistic duration and never injects weekly CTA", () => {
  for (const input of [knowledgeSample, { source: "# Local workflows\n\n## Roles\nFirst collect the source notes, then review each factual claim, and finally export the approved explanation.\n\nA source document remains separate from its editable narration.", locale: "en" }]) {
    const document = createKnowledgeOutline(input);
    const props = buildKnowledgeProps(document);
    assert.equal(compositionIdForProps(props), "KnowledgeExplainer");
    assert.equal(props.aspect, "landscape");
    assert.equal(props.introSubtitle, "");
    assert.equal(props.closingSubtitle, "");
    assert.equal(props.introDurationMs, 0);
    assert.equal(props.knowledge.chapters.length, document.chapters.length);
    assert.deepEqual(props.cases.map((item) => item.subtitle), document.chapters.map((chapter) => chapter.narration));
    assert.equal(props.knowledge.source, input.source);
    assert.ok(props.beats.every((beat) => beat.section === "case"));
    assert.ok(props.estimatedDurationMs > 4000);
    for (const [index, chapter] of document.chapters.entries()) {
      const original = chapter.narration.replace(/\s/g, "");
      const recovered = props.beats.filter((beat) => beat.caseIndex === index).map((beat) => beat.say).join("").replace(/\s/g, "");
      assert.equal(recovered, original);
    }
  }
});

test("invalid sources, empty chapters and unsafe images fail explicitly without discarding a draft", () => {
  assert.throws(() => createKnowledgeOutline({ source: " " }), /来源/);
  assert.throws(() => createKnowledgeOutline({ source: "## 空章节\n\n## 还有一章\n内容" }), /缺少正文/);
  const document = createKnowledgeOutline({ source: "完整正文" });
  for (const image of ["javascript:alert(1)", "../secret", "//other-host/image.png"]) assert.throws(() => validateKnowledgeDocument({ ...document, chapters: [{ ...document.chapters[0], image }] }), /图片/);
  const valid = validateKnowledgeDocument({ ...document, chapters: [{ ...document.chapters[0], image: "case-images/source.png", sourceRefs: ["完整正文"] }] });
  assert.equal(valid.chapters[0].image, "case-images/source.png");
  assert.equal(splitKnowledgeNarration("A decimal 1.5 stays intact in this sentence.", "en").length, 1);
});

test("AI can use natural source-grounded paraphrases and new chapter titles while locking user title", async () => {
  const source = "# Source\n## 研究案例\n一人公司协调11家实验室，在不到18个月内获得小鼠实验中的积极初步结果。这是临床前结果，不代表对人类安全有效。这里的估算只是类比。\n来源：原文链接";
  const input = { source, title: "用户指定标题", locale: "zh", useAi: true };
  const snapshot = JSON.stringify(input);
  const chapters = [{ id: "study", title: "用协作网络理解研究推进", kind: "case", narration: "这个案例把11家实验室的协作集中到一人公司，在不到18个月内看到了小鼠实验的初步信号。临床前结果不能当成人体疗效；估算与类比也需要谨慎使用。", sourceRefs: ["这是临床前结果，不代表对人类安全有效。"], sourceNote: "来源：原文链接" }];
  const result = await organizeKnowledge(input, { getConfig: config, fetcher: fakeAi(chapters) });
  assert.equal(result.method, "ai");
  assert.equal(result.reviewRequired, true);
  assert.equal(result.document.title, "用户指定标题");
  assert.equal(result.document.source, source);
  assert.equal(result.document.chapters[0].narration, chapters[0].narration);
  assert.equal(JSON.stringify(input), snapshot);
  const customTitle = await organizeKnowledge({ ...input, title: "3个启发" }, { getConfig: config, fetcher: fakeAi(chapters) });
  assert.equal(customTitle.document.title, "3个启发");
  for (const narration of [chapters[0].narration.replace("11家", "12家"), "11家实验室在18个月得到结果，已经证明人体疗效。", chapters[0].narration.replace("临床前", "后续")]) {
    await assert.rejects(organizeKnowledge(input, { getConfig: config, fetcher: fakeAi([{ ...chapters[0], narration }]) }), /数字|限定|疗效/);
  }
  await assert.rejects(organizeKnowledge(input, { getConfig: config, fetcher: fakeAi([{ ...chapters[0], sourceNote: "已经临床验证" }]) }), /来源|疗效/);
  await assert.rejects(organizeKnowledge(input, { getConfig: config, fetcher: async () => { throw Error("model unavailable"); } }), /unavailable/);
  assert.equal(JSON.stringify(input), snapshot);
});

test("English AI paraphrase preserves preliminary mouse/preclinical limitations", async () => {
  const input = { title: "Research explained", locale: "en", useAi: true, source: "# Source\n## Research\nThe work involved 11 labs over 18 months. The preliminary mouse results are preclinical. This analogy is an estimate, not clinical proof." };
  const chapter = { id: "research", title: "What the evidence does and does not show", narration: "Over 18 months, 11 labs contributed to the work. Preliminary mouse evidence remains preclinical; the analogy and estimate do not establish clinical benefit." };
  const result = await organizeKnowledge(input, { getConfig: config, fetcher: fakeAi([chapter]) });
  assert.equal(result.document.locale, "en");
  assert.equal(result.reviewRequired, true);
  const spelled = await organizeKnowledge(input, { getConfig: config, fetcher: fakeAi([{ ...chapter, narration: chapter.narration.replace("11 labs", "eleven labs").replace("18 months", "eighteen months") }]) });
  assert.equal(spelled.method, "ai");
  await assert.rejects(organizeKnowledge(input, { getConfig: config, fetcher: fakeAi([{ ...chapter, narration: chapter.narration.replace("11 labs", "twelve labs") }]) }), /数字/);
});

test("calendar publication dates cannot become metric heroes after repeated enrichment; role and definition overviews are source-backed", () => {
  const props = buildKnowledgeProps(createKnowledgeOutline(knowledgeSample));
  const date = props.beats.find((beat) => beat.say.includes("2026 年") || beat.say.includes("2026年"));
  assert.ok(date);
  assert.notEqual(date.scene, "metric");
  const repeated = enrichBeatScenes(props.beats, props).find((beat) => beat.say === date.say);
  assert.notEqual(repeated.scene, "metric");
  for (const index of [2, 3]) {
    const chapter = props.knowledge.chapters[index];
    assert.equal(chapter.visual.items.length, 3);
    assert.equal(chapter.visual.layout, "features");
    chapter.visual.items.forEach((item) => { assert.ok(chapter.narration.includes(item.label)); assert.ok(chapter.narration.includes(item.detail)); });
    assert.ok(props.beats.some((beat) => beat.caseIndex === index && beat.chapterFocus === 0));
  }
  assert.equal(props.knowledge.chapters[2].visual.items[0].label, "核心负责人");
});

test("cached speech synthesis has chapter-only bookmarks, retimes beats and retains full audio tail without paid synthesis", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "knowledge-speech-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const props = buildKnowledgeProps(createKnowledgeOutline({ source: "# Example\n## One\nThe complete original narration stays here.", locale: "en" }));
  const plan = buildNarrationPlan(props);
  const scenes = plan.scenes.filter((scene) => scene.id.startsWith("case-"));
  assert.deepEqual(scenes.map((scene) => scene.id), ["case-0"]);
  await mkdir(path.join(root, "input"));
  const audio = path.join(root, "input/narration.wav");
  await writeFile(audio, "test-cached-audio");
  const durationMs = 9200;
  const timings = [{ id: "case-0", startMs: 0, durationMs, cues: [{ text: props.cases[0].subtitle, startMs: 100, endMs: 7800 }] }];
  await writeNarrationCache(root, scenes, "en-US-JennyNeural", SCENE_BREAK_MS, { durationMs, timings, sourceAudioPath: audio });
  const result = await synthesizeVideoProps(props, { root, voice: "en-US-JennyNeural" });
  assert.equal(result.cache.hits, 1);
  assert.equal(result.props.narrationDurationMs, durationMs);
  assert.equal(result.props.beats[0].startMs, 100);
  assert.equal(result.props.beats.at(-1).endMs, durationMs);
  assert.equal(result.props.knowledge.chapters[0].durationMs, durationMs);
  assert.equal(result.props.timingSource, "speech");
  assert.equal(result.props.introSubtitle, "");
  assert.equal(result.props.closingSubtitle, "");
  assert.deepEqual(result.props.knowledge.chapters[0].narration, props.knowledge.chapters[0].narration);
  assert.equal(retimeKnowledgeProps(result.props).beats.at(-1).endMs, durationMs);
});
