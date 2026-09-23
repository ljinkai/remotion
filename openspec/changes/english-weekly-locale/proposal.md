# Change: english-weekly-locale

## Why

VidFlow 将提供「生成英文视频」：传入英文 IndieWeekly Markdown。当前 Remotion 服务默认中文：

- Azure 音色列表只保留中文 locale；Workbench 默认 `zh-CN-YunxiNeural`
- 千问逐字稿 prompt / 固定片尾 CTA 为中文
- 画面默认文案（如「一句话总结」「精选」「N 个独立开发精选」）偏中文
- Markdown 字段已容忍 `author`/`date`/`metric`，但 closing 标题与 CTA 拼接仍按中文习惯

需要显式 **locale=en** 路径，使英文 MD + 英文 Neural 音色可端到端成片。

## What Changes

- `POST /api/v1/render-jobs` 的 `options.locale`: `"zh"` \| `"en"`（默认 `zh`）
- 英文时：英文 Qwen prompt、英文固定 CTA、英文默认 UI 文案；`options.voice` 允许 `en-*` Neural（默认 `en-US-JennyNeural`）
- Markdown：识别 `## Takeaway` / `In one line` 为收尾节；`locale: en` frontmatter 可辅助推断
- Workbench：可选 locale / 展示英文音色（最小：接受任意 voice id，不因非中文拒绝）
- **不改**画面布局模板；不改 webhook 契约形状

## Impact

- Affected：`render-job-options.mjs`、`render-job-worker.mjs`、`script-llm.mjs`、`azure-voices.mjs`、`narrationScript.ts`、`markdown.ts`、`videoData.ts`（defaults）、README
- VidFlow：见 `vidflow/docs/superpowers/specs/2026-09-23-weekly-en-video-design.md`
