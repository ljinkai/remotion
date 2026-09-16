# Change: AI 将周刊 Markdown 优化为口播逐字稿后再合成

## Why

当前把周刊 MD 的「副标题 / 正文第一句」直接送进 Azure TTS。这些字段是编辑用结构化文案，不是可念的口播稿：语气书面、缺衔接、长度不一，导致合成听感差、字幕也不像「逐字稿」。运营需要：**先由 AI 把 MD 改写成可编辑的口播逐字稿，再按逐字稿合成语音并句级对齐字幕**。

## What Changes

- 新增 Workbench 步骤：**生成逐字稿**（AI）→ 人工可改 → **合成语音** → 预览 / 渲 MP4。
- 新增服务端 `POST /api/script`：输入周刊 MD（或已解析 props），输出按场景划分的口播文案（intro / 各案例 / closing）。
- 逐字稿可在 UI 中编辑；合成语音 **必须以逐字稿为准**，不再用 MD 第一句兜底（有稿时）。
- LLM 默认使用 **通义千问（DashScope OpenAI 兼容接口）**，可用 `qwen-plus` 等模型；密钥仅服务端环境变量。
- 字幕仍为 **句级**（沿用 Azure Sentence/WordBoundary 聚合）；本 change **不做**字级卡拉 OK 高亮。
- **不做**：接入 vidflow、自动写案例图、强制改写用户已手写的 `旁白` 字段（若 MD 已含旁白则优先采用、可跳过 AI）。

## Impact

- Affected specs:
  - `narration-script`（新建）
  - `markdown-workbench`（增量）
- Affected code（预期）:
  - `tools/script-llm.mjs` — 新建，调用 Chat Completions
  - `tools/workbench-server.mjs` — `/api/script`
  - `tools/workbench-client.jsx` — 生成/编辑逐字稿 UI，合成前校验
  - `src/markdown.ts` / `src/videoData.ts` — 旁白字段与 props 映射
  - `.env.example` / `README.md` — LLM 环境变量
- 实现前必须通过本 proposal；通过前 **不写业务代码**。
