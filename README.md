# Remotion Markdown Video

Interactive Remotion workbench for turning a weekly Markdown document into a video.

## Commands

```console
npm install
npm run workbench
```

Open the printed local URL, paste or import a Markdown file, preview it, then click `生成 MP4`.
Rendered videos are written to `out/`.

Recommended runtime: Node 20+.

Remotion 4.0.523 currently needs macOS 15+ for local MP4 composition on macOS.
The workbench preview can still run on older macOS versions, but final MP4 rendering should happen
on macOS 15+ or Linux CI.

Remotion Studio still works:

```console
npm run dev
```

Manual rendering still works too:

```console
npx remotion render IndieWeeklyMarkdown out/video.mp4 --props=props.json
```

## Markdown Shape

```markdown
---
issue: 156
theme: 单渠道突破法
badge: 400万美元年收
ticker: Indie Dev Product Revenue
audio: narration.wav
---

# 独立开发变现周刊（第156期）：单渠道突破法

这期独立开发变现周刊，主线是单渠道突破法。

## Honey Traffic

作者：@PashaBorsai
日期：2026/09/05
指标：$5k MRR
图片：case-images/02-honey-traffic.png
标签：SEO Pipeline

AI 时代内容更多，关键词研究反而更刚需。

## 一句话总结

增长不是做更多动作，而是把一个动作做透。
```

Supported item fields:

- `作者` / `author`
- `日期` / `date`
- `指标` / `metric`
- `图片` / `image`
- `标签` / `fallback`
- `副标题` / `subtitle`

Images can be files under `public/` such as `case-images/example.png`, or remote `https://` URLs.
