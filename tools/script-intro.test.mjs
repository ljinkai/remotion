import assert from "node:assert/strict";
import test from "node:test";
import { optimizeNarrationForSubtitles } from "./subtitle-lines.mjs";
import {
  isPlaceholderClosing,
  prependFixedIntro,
  scriptClosingInput,
} from "./script-llm.mjs";

const FIXED = [
  "分享最新、有价值的独立开发、产品变现相关内容",
  "关注我，不错过每周参考内容",
].join("\n");

test("missing summary is not treated as this issue's closing", () => {
  assert.equal(
    isPlaceholderClosing(
      "增长不是做更多动作，而是把一个动作做透。\n觉得有用就关注一下，我们下周见！",
    ),
    true,
  );
  assert.deepEqual(
    scriptClosingInput({
      closingSubtitle:
        "增长不是做更多动作，而是把一个动作做透。\n觉得有用就关注一下，我们下周见！",
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

test("cover intro is the fixed copy and ignores the model opening", () => {
  const next = prependFixedIntro(
    "分享独立开发与产品变现的实战经验。每周五更新。这期看三个已经跑通的产品。",
  );
  assert.equal(next, FIXED);
  assert.equal(optimizeNarrationForSubtitles(next), FIXED);
  assert.equal(prependFixedIntro(""), FIXED);
});
