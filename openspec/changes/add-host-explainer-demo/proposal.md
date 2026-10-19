# Change: 主持人讲解实验合成

## Why

周刊成片目前是封面、案例大图和片尾。需要一条独立的竖屏实验，确认「网点底 + 章节进度 + 大标题 + 中间插画 + 左下清单 + 右下主持人」能不能在现有 Remotion 里看顺。实验只回答画面和节奏，不进入 Workbench、逐字稿或 Azure。

参考是同一套版式的三镜：中间图形每镜更换，清单高亮跟着走，主持人换姿势。实验用原创文案和原创矢量人物，不使用参考截图里的文案、商标或人物图片。

## What Changes

- 新增合成 `HostExplainerDemo`（1080×1920，30fps，15 秒，三镜各 5 秒）
- 画面、人物、嘴型、清单和三组中间插画全部用 React/SVG 画在仓库里，不引入位图
- 在 Remotion Studio（`npm run dev`）里预览
- 不改 `IndieWeeklyMarkdown` / `IndieWeeklyMarkdownPortrait`，不改 Workbench、渲染 API 和语音

## Impact

- Affected specs: `host-explainer-demo`（新能力）
- Affected code（审核通过后才写）: `src/Root.tsx`、`src/host-explainer/**`
- 不改 `tools/workbench-client.jsx`、`tools/workbench-server.mjs`、`src/Composition.tsx`
