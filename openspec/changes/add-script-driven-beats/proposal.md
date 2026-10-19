# Change: 按逐字稿生成配套分镜

## Why

主持人实验已经证明外壳和矢量画法能看。真正要用的时候，中间图形得跟着这一期的逐字稿走：一句在讲收入，就长出柱子和数字；下一句在讲产品页，就换成截图或手机。不能为每种内容再写一个镜头组件，也不能每期手改 React。

## What Changes

- 逐字稿的每一句变成一条分镜。分镜是数据，不是新的页面
- 千问在已有逐字稿上再出一份分镜 JSON。元素从画法表里选，一句可以混用多个
- 通用渲染器按时间把元素画进主持人外壳。柱子、文字、图片、手机、卡片、图标、受限 SVG 都是元素，不是镜头类型
- Workbench 增加模板「主持人」和按钮「生成分镜」。预览和本机 MP4 走合成 `HostExplainer`
- 现有 Midnight 等模板、两个周刊合成、渲染服务 API 保持原样
- `HostExplainerDemo` 仍是写死的三镜，用来对照画法

## Impact

- Affected specs: `script-driven-beats`（新能力）
- Affected code（审核通过后才写）: `tools/beat-planner.mjs`、`tools/beat-spec.mjs`、`src/host-explainer/**`、`src/videoTemplates.ts`、`tools/workbench-server.mjs`、`tools/workbench-client.jsx`、`src/Root.tsx`
- 不改 `src/Composition.tsx` 的周刊镜头，不改 `/api/v1/render-jobs`
