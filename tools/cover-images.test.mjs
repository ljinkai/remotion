import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadMarkdownRuntime } from "./markdown-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("parseMarkdownToVideo uses cover_images for magazine backdrop", async () => {
  const runtime = await loadMarkdownRuntime(root);
  const md = `---
issue: 161
theme: Growth experiments
badge: Featured
locale: en
cover_images: https://cdn.example.com/a.png https://cdn.example.com/b.png https://cdn.example.com/c.png
---

# Indie Maker Weekly (Issue 161): Growth experiments

This issue of Indie Maker Weekly focuses on Growth experiments.

## Cool App

Author: @maker
Date: 2026/09/20
Metric: Featured
Image: https://cdn.example.com/case.png
Tag: Products

English take.

## Takeaway

Growth is depth over breadth.
`;
  const props = runtime.parseMarkdownToVideo(md, { locale: "en" });
  assert.equal(props.locale, "en");
  assert.deepEqual(props.coverImages, [
    "https://cdn.example.com/a.png",
    "https://cdn.example.com/b.png",
    "https://cdn.example.com/c.png",
  ]);
  assert.equal(props.coverTitle, "Growth experiments");
});

test("parseMarkdownToVideo falls back to case images when cover_images missing", async () => {
  const runtime = await loadMarkdownRuntime(root);
  const md = `---
issue: 156
theme: 单渠道突破法
locale: zh
---

# 独立开发变现周刊（第156期）：单渠道突破法

这期独立开发变现周刊，主线是单渠道突破法。

## 小众产品重启记

作者：@farrux
指标：精选
图片：https://cdn.example.com/one.png
标签：流量

旁白。

## Honey

作者：@pasha
指标：精选
图片：https://cdn.example.com/two.png
标签：SEO

旁白。

## 一句话总结

把一个动作做透。
`;
  const props = runtime.parseMarkdownToVideo(md);
  assert.deepEqual(props.coverImages, [
    "https://cdn.example.com/one.png",
    "https://cdn.example.com/two.png",
  ]);
});
