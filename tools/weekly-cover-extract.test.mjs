import assert from "node:assert/strict";
import test from "node:test";
import {
  extractCoverImagesFromMarkdown,
  injectCoverImagesFrontmatter,
} from "./weekly-issues.mjs";

const ZH_MD = `---
title: "独立开发变现周刊（第159期）"
description: "300万美元年收入面试神器"
cover: "https://qiniu.gafata.com/weekly-covers/abc.png"
---

# 独立开发变现周刊（第159期）：300万美元年收入面试神器

## 1、OpenTweet

文案

![](https://qiniu.gafata.com/weekly/translation-cards/card1.png)

![](https://qiniu.gafata.com/weekly/extras/extra1.png)

## 2、Traxy

文案

![](https://qiniu.gafata.com/weekly/translation-cards/card2.png)

## 3、PumpGTM

文案

![](https://qiniu.gafata.com/weekly/translation-cards/card3.png)

## 4、More

![](https://qiniu.gafata.com/weekly/translation-cards/card4.png)
`;

const EN_MD = `---
title: "Indie Maker Weekly (Issue 158)"
description: "Taras hits $1,000 MRR"
cover: "https://qiniu.gafata.com/weekly-covers-en/abc.png"
---

# Indie Maker Weekly (Issue 158): Taras

## 1、Taras

<p><img class="weekly-x-shot" src="https://qiniu.gafata.com/screenshots/shot1.png" alt="" /></p>

## 2、Squad

![](https://qiniu.gafata.com/weekly/translation-cards/skip-me.png)

![](https://qiniu.gafata.com/weekly/screenshots/shot2.png)

## 3、Widget

![](https://qiniu.gafata.com/weekly/screenshots/shot3.png)
`;

test("extractCoverImagesFromMarkdown zh prefers translation cards, max 3", () => {
  const urls = extractCoverImagesFromMarkdown(ZH_MD, "zh");
  assert.deepEqual(urls, [
    "https://qiniu.gafata.com/weekly/translation-cards/card1.png",
    "https://qiniu.gafata.com/weekly/translation-cards/card2.png",
    "https://qiniu.gafata.com/weekly/translation-cards/card3.png",
  ]);
});

test("extractCoverImagesFromMarkdown en skips translation cards, reads img src", () => {
  const urls = extractCoverImagesFromMarkdown(EN_MD, "en");
  assert.deepEqual(urls, [
    "https://qiniu.gafata.com/screenshots/shot1.png",
    "https://qiniu.gafata.com/weekly/screenshots/shot2.png",
    "https://qiniu.gafata.com/weekly/screenshots/shot3.png",
  ]);
});

test("injectCoverImagesFrontmatter writes cover_images and theme", () => {
  const out = injectCoverImagesFrontmatter(ZH_MD, [
    "https://cdn.example.com/a.png",
    "https://cdn.example.com/b.png",
  ]);
  assert.match(
    out,
    /cover_images: https:\/\/cdn\.example\.com\/a\.png https:\/\/cdn\.example\.com\/b\.png/,
  );
  assert.match(out, /theme: 300万美元年收入面试神器/);
  assert.doesNotMatch(
    out,
    /cover_images:.*weekly-covers\//,
  );
});
