import assert from "node:assert/strict";
import test from "node:test";
import { optimizeNarrationForSubtitles } from "./subtitle-lines.mjs";
import {
  isPlaceholderClosing,
  generateNarrationScript,
  scriptClosingInput,
} from "./script-llm.mjs";

const FIXED = [
  "分享最新、有价值的独立开发、产品变现相关内容",
  "关注我，不错过每周参考内容",
].join("\n");

test("missing summary is not treated as this issue's closing", () => {
  assert.equal(
    isPlaceholderClosing(
      "增长不是做更多动作，而是把一个动作做透。\n觉得这期有启发，点个赞。每周分享独立开发与产品变现案例，关注我，下期见！",
    ),
    true,
  );
  assert.deepEqual(
    scriptClosingInput({
      closingSubtitle:
        "增长不是做更多动作，而是把一个动作做透。\n觉得这期有启发，点个赞。每周分享独立开发与产品变现案例，关注我，下期见！",
    }),
    { missing: true, text: "" },
  );
  assert.deepEqual(
    scriptClosingInput({
      closingSourceBody: "只有首页里的付费曝光才会计费。",
    }),
    { missing: false, text: "只有首页里的付费曝光才会计费。" },
  );
});

const props = {
  cases: [{ index: "01", title: "创作者奖励", sourceBody: "创作者首周入账92.18美元。" }],
  closingSourceBody: "只有付费曝光才计费。",
};

const withModel = async (reply, run) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SCRIPT_LLM_API_KEY;
  process.env.SCRIPT_LLM_API_KEY = "test-key";
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ choices: [{ message: {
      content: JSON.stringify(reply(requests.length)),
    } }] }), { status: 200 });
  };
  try { await run(requests); } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SCRIPT_LLM_API_KEY;
    else process.env.SCRIPT_LLM_API_KEY = originalKey;
  }
};

const payload = (intro) => ({ intro, cases: [{ narration: "创作者首周入账92.18美元。" }], closing: "只有付费曝光才计费。" });

test("AI intro uses this issue's hook and sends case evidence to the writer", async () => {
  const hook = "创作者首周入账92.18美元。这笔奖励怎么算？";
  await withModel(() => payload(hook), async (requests) => {
    const script = await generateNarrationScript(props);
    assert.equal(script.intro, optimizeNarrationForSubtitles(hook));
    assert.notEqual(script.intro, FIXED);
    assert.equal(requests.length, 1);
    const prompt = requests[0].messages.map((message) => message.content).join("\n");
    assert.match(prompt, /创作者首周入账92.18美元/);
    assert.match(prompt, /不超过 80 字/);
    assert.match(prompt, /事实、数字和承诺必须有案例原文依据/);
    assert.doesNotMatch(prompt, /intro 留空|intro 固定为封面导语/);
  });
});

test("empty AI intro retries rather than falling back to a generic opening", async () => {
  await withModel((attempt) => payload(attempt === 1 ? "" : "创作者奖励怎么算？"), async (requests) => {
    const script = await generateNarrationScript(props);
    assert.equal(requests.length, 2);
    assert.equal(script.intro, optimizeNarrationForSubtitles("创作者奖励怎么算？"));
  });
  await withModel(() => payload(" "), async (requests) => {
    await assert.rejects(generateNarrationScript(props), /缺少 intro/);
    assert.equal(requests.length, 2);
  });
});

test("explicit Markdown intro survives parsing and applying narration", async () => {
  const { loadMarkdownRuntime } = await import("./markdown-runtime.mjs");
  const runtime = await loadMarkdownRuntime(process.cwd());
  const markdown = "# 本期周刊\n\n旁白: 创作者奖励怎么算？\n\n## 创作者奖励\n\n旁白: 创作者首周入账92.18美元。\n\n## 一句话总结\n\n旁白: 只有付费曝光才计费。";
  const script = runtime.tryBuildScriptFromMarkdown(markdown);
  assert.ok(script);
  assert.equal(script.intro, optimizeNarrationForSubtitles("创作者奖励怎么算？"));
  const video = runtime.parseMarkdownToVideo(markdown);
  assert.equal(optimizeNarrationForSubtitles(video.introSubtitle), script.intro);
  assert.equal(runtime.applyNarrationScript(video, script).introSubtitle, script.intro);
  assert.equal(script.closing, optimizeNarrationForSubtitles("只有付费曝光才计费。\n觉得这期有启发，点个赞。每周分享独立开发与产品变现案例，关注我，下期见！"));
});

test("closing prompt preserves the supplied takeaway and appends one fixed CTA", async () => {
  const closing = "只有付费曝光才计费，先看清奖励规则再判断收益。";
  await withModel(() => ({ ...payload("这笔奖励怎么算？"), closing }), async (requests) => {
    const script = await generateNarrationScript(props);
    assert.equal(script.closing, optimizeNarrationForSubtitles(`${closing}\n觉得这期有启发，点个赞。每周分享独立开发与产品变现案例，关注我，下期见！`));
    const prompt = requests[0].messages[1].content;
    assert.match(prompt, /保留输入里一句话总结的核心意思/);
    assert.match(prompt, /具体收获和行动建议必须有原文依据/);
    assert.match(prompt, /只有付费曝光才计费/);
    assert.match(prompt, /原文不足时说清具体收获就停/);
  });
});

test("closing without supplied takeaway uses case evidence rather than a generic slogan", async () => {
  const closing = "创作者首周入账92.18美元，具体奖励值得结合规则来理解。";
  await withModel(() => ({ ...payload("这笔奖励怎么算？"), closing }), async (requests) => {
    const script = await generateNarrationScript({ ...props, closingSourceBody: "" });
    assert.equal(script.closing, optimizeNarrationForSubtitles(`${closing}\n觉得这期有启发，点个赞。每周分享独立开发与产品变现案例，关注我，下期见！`));
    const prompt = requests[0].messages[1].content;
    assert.match(prompt, /本期没有一句话总结/);
    assert.match(prompt, /不要强行为所有案例找共同规律/);
    assert.match(prompt, /创作者首周入账92.18美元/);
  });
});

test("empty, CTA-only and placeholder Chinese closing retry even with a supplied summary", async () => {
  for (const closing of ["", "觉得这期有启发，点个赞。每周分享独立开发与产品变现案例，关注我，下期见！", "增长不是做更多动作，而是把一个动作做透。"] ) {
    await withModel((attempt) => ({ ...payload("这笔奖励怎么算？"), closing: attempt === 1 ? closing : "只有付费曝光才计费。" }), async (requests) => {
      const script = await generateNarrationScript(props);
      assert.equal(requests.length, 2);
      assert.match(script.closing, /只有付费曝光才计费/);
    });
  }
  await withModel(() => ({ ...payload("这笔奖励怎么算？"), closing: "" }), async (requests) => {
    await assert.rejects(generateNarrationScript(props), /结尾需要从本期内容提炼一句话总结/);
    assert.equal(requests.length, 2);
  });
});

test("new CTA survives subtitle formatting without duplicate append or losing its split", async () => {
  const { build } = await import("esbuild");
  const result = await build({ entryPoints: ["src/narrationScript.ts"], bundle: true, write: false, format: "esm", platform: "node" });
  const runtime = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  const cta = runtime.FIXED_CLOSING_NARRATION;
  const summary = "只有付费曝光才计费。";
  const formatted = runtime.applyNarrationScript({}, {
    intro: "创作者奖励怎么算？",
    cases: [],
    closing: `${summary}\n${cta}`,
    source: "ai",
  }).closingSubtitle;
  assert.equal(runtime.appendFixedClosingCta(formatted), formatted);
  const split = runtime.splitClosingSummaryAndCta(formatted);
  assert.equal(optimizeNarrationForSubtitles(split.summary), optimizeNarrationForSubtitles(summary));
  assert.equal(split.cta.replace(/[\s\p{P}]/gu, ""), cta.replace(/[\s\p{P}]/gu, ""));
  assert.equal(isPlaceholderClosing(optimizeNarrationForSubtitles(cta)), true);
  const legacy = "觉得有用就关注一下，我们下周见！";
  assert.equal(runtime.appendFixedClosingCta(`${summary}\n${legacy}`), `${summary}\n${legacy}`);
  assert.deepEqual(runtime.splitClosingSummaryAndCta(`${summary}\n${legacy}`), { summary, cta: legacy });
  assert.equal(isPlaceholderClosing(legacy), true);
});
