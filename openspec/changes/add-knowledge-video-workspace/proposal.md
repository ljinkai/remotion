# Change: 独立知识讲解视频工作区

## Why

周刊按独立案例组织，固定开场、短稿和竖屏不适合一个知识点的连续推导。需要专用页面，让用户从资料整理到章节讲稿、分镜预览、语音和横屏成片连续工作。

## What Changes

- 新增 `/knowledge` 独立页面，与周刊互相导航且独立保存稿件。
- 采用“主题、来源资料、章节、讲解段落”的文档结构，默认提取草稿，可显式请求知识专用 AI 整理。
- 复用来源支持的分镜、配音与导出链路，新增 1920×1080 知识视频布局；不注入周刊开场结尾。
- 提供已核对事实并区分类比的 Pipeline-in-a-Person 示例，支持编辑、规划与静音导出。
- 文档或语言变更后使旧分镜和音轨失效，异步结果不得覆盖新稿。

## Impact

- Affected specs: knowledge-video-workspace
- Affected code: tools/knowledge-*, tools/workbench-server.mjs, src/knowledge/, src/Root.tsx
- User authorization: 用户已确认独立设计页面、用于此类知识内容生成；无需替换现有周刊页面。
