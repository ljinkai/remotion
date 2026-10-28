import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { transform } from "esbuild";

const source = await readFile(
  new URL("../src/host-explainer/hostCaptions.ts", import.meta.url),
  "utf8",
);
const { code } = await transform(source, { loader: "ts", format: "esm" });
const {
  HOST_CAPTION_LAYOUT: caption,
  HOST_CAPTION_APPEARANCE: appearance,
  hostCaptionPages,
  hostCaptionPageAtFrame,
} = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

const say =
  "OpenTweet 是一个面向 X 平台的社交媒体自动化发布工具，主打 AI Agent 发推能力。用户不用申请 X 开发者账号，拿一个 API Key 就能让 Claude、Codex 等 AI 代理通过 MCP/REST/CLI 直接发推、安排定时帖、管理线程。\n同时支持把同一篇内容同步到 Bluesky 和 LinkedIn，每个平台都走原生 API 发帖，并记录每条发布结果。";

test("raised yellow captions leave more room below than the former footer", () => {
  assert.ok(caption.left >= 48);
  assert.ok(caption.left + caption.width <= 1080 - 48);
  assert.ok(caption.top < 1740);
  assert.ok(1920 - caption.top - caption.height >= 240);
  assert.ok(caption.height >= caption.lineHeight * 2 + 28);
  assert.equal(appearance.color, "#FFE34D");
  assert.match(appearance.WebkitTextStroke, /2px/);
  assert.ok(appearance.textShadow.length > 0);
  assert.ok(appearance.zIndex > 4, "captions remain readable above the host");
  assert.equal(Object.hasOwn(appearance, "background"), false);
});

test("long mixed Chinese/English subtitles retain every character and punctuation", () => {
  const pages = hostCaptionPages(say);
  assert.ok(pages.length > 1);
  assert.ok(pages.every((page) => page.lines.length <= 2));
  assert.equal(pages.flatMap((page) => page.lines).join(""), say);
  for (const word of [
    "OpenTweet",
    "API Key",
    "Claude",
    "Codex",
    "MCP/REST/CLI",
    "Bluesky",
    "LinkedIn",
  ]) {
    if (word.includes(" ")) continue;
    assert.ok(
      pages.some((page) => page.lines.some((line) => line.includes(word))),
      `${word} must not be split across lines`,
    );
  }
});

test("every page is shown during the original beat and the last page holds through the final frame", () => {
  const pages = hostCaptionPages(say),
    duration = 600;
  const selections = Array.from(
    { length: duration },
    (_, frame) => hostCaptionPageAtFrame(pages, frame, duration).index,
  );
  assert.equal(selections[0], 0);
  assert.equal(selections.at(-1), pages.length - 1);
  assert.deepEqual(
    [...new Set(selections)],
    pages.map((_, index) => index),
  );
  assert.ok(
    selections.every(
      (page, index) => index === 0 || page >= selections[index - 1],
    ),
  );
  assert.equal(hostCaptionPageAtFrame(pages, -10, duration).index, 0);
  assert.equal(
    hostCaptionPageAtFrame(pages, 9999, duration).index,
    pages.length - 1,
  );
  const before = hostCaptionPageAtFrame(pages, 450, duration);
  hostCaptionPageAtFrame(pages, 0, duration);
  assert.deepEqual(hostCaptionPageAtFrame(pages, 450, duration), before);
});

test("short captions stay unchanged and long unbroken URLs do not lose text", () => {
  const short = "通过 MCP/REST/CLI 发推。";
  const pages = hostCaptionPages(short);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].lines.join(""), short);
  const url = `https://example.com/${"a".repeat(200)}?source=OpenTweet`;
  assert.equal(
    hostCaptionPages(url)
      .flatMap((page) => page.lines)
      .join(""),
    url,
  );
});

test("the reported knowledge introduction fits its real landscape area as two complete clauses", () => {
  const text =
    "做 Claude 的 Anthropic，收购了一家当时只有一名全职员工的药物研发公司。";
  const landscape = { width: 1328, paddingX: 0, fontSize: 38 };
  const pages = hostCaptionPages(text, landscape);
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0].lines, [
    "做 Claude 的 Anthropic，",
    "收购了一家当时只有一名全职员工的药物研发公司。",
  ]);
  assert.equal(pages.flatMap((page) => page.lines).join(""), text);
  for (const frame of [0, 150, 299])
    assert.equal(
      hostCaptionPageAtFrame(pages, frame, 300).page.lines.join(""),
      text,
    );
});

test("portrait Chinese pages keep words intact and rebalance a tiny last page without dropping characters", () => {
  for (let length = 1; length < 70; length++) {
    const text = `我们需要${"检查项目结果".repeat(length)}，并承担专业责任，最后回到这家药物研发公司。`;
    const pages = hostCaptionPages(text);
    assert.equal(pages.flatMap((page) => page.lines).join(""), text);
    assert.ok(pages.every((page) => page.lines.length <= 2));
    assert.ok(
      pages.every((page) =>
        page.lines.every((line) => !/公$/.test(line) && !/^司/.test(line)),
      ),
    );
    const tail = pages
      .at(-1)
      .lines.join("")
      .replace(/[\s，。！？；、,.!?;：:]/g, "");
    if (pages.length > 1) assert.ok(tail.length > 2, `orphan tail: ${tail}`);
  }
});

test("mixed facts and hard URLs retain every character with word-sized line breaks", () => {
  const text =
    "这家药物研发公司有15,000名用户，月收入$3,700.50，Claude通过MCP/REST处理25%的材料。";
  for (const layout of [caption, { width: 1328, paddingX: 0, fontSize: 38 }]) {
    const pages = hostCaptionPages(text, layout),
      lines = pages.flatMap((page) => page.lines);
    assert.equal(lines.join(""), text);
    for (const token of [
      "公司",
      "15,000",
      "$3,700.50",
      "Claude",
      "MCP/REST",
      "25%",
    ])
      assert.ok(
        lines.some((line) => line.includes(token)),
        token,
      );
  }
  const url = `https://example.com/${"longword".repeat(40)}`;
  const lines = hostCaptionPages(url).flatMap((page) => page.lines);
  assert.ok(lines.length > 2);
  assert.ok(lines.every((line) => line.length <= 40));
  assert.equal(lines.join(""), url);
});

test("older engines have a deterministic lossless fallback without Segmenter", async () => {
  const { code } = await transform(source, { loader: "ts", format: "cjs" });
  const module = { exports: {} };
  new Function("Intl", "module", "exports", code)({}, module, module.exports);
  const text = "我们要反复检查项目结果并整理研发资料，最后回到这家公司。";
  const pages = module.exports.hostCaptionPages(text);
  assert.equal(pages.flatMap((page) => page.lines).join(""), text);
  assert.deepEqual(module.exports.hostCaptionPages(text), pages);
  assert.ok(pages.every((page) => page.lines.length <= 2));
});
