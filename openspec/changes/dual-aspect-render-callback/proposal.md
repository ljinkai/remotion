# Change: Dual-aspect weekly render (landscape + portrait)

## Why

VidFlow 周刊视频默认只出横屏（16:9）。小红书等渠道需要竖屏（9:16）。逐字稿与 Azure TTS 已占大部分时间与费用；竖屏应 **复用同一套旁白与音频**，只多一次 Remotion 合成与上传，并 **分别 webhook**，让 VidFlow 先填横屏链接、再填竖屏链接。

## What Changes

- 单次 `POST /api/v1/render-jobs` 可请求 `options.aspects: ["landscape","portrait"]`（默认仅 `["landscape"]` 保持兼容）。
- Worker：`scripting` → `synthesizing` **各一次** → 按 aspects 顺序 render+upload；每完成一个 aspect 立即 callback（payload 含 `aspect` + `video_url`）。
- 全部 aspect 成功后 `status=done`；若横屏已成功、竖屏失败：横屏 URL 保留，终态 `failed` 并注明阶段。
- 本地 `out-*.mp4` / job 工作目录仍为临时文件；持久结果仅七牛 CDN。

## Non-Goals

- 不为竖屏重新跑千问 / TTS（除非显式新 job 且未 reuse）
- 并行双渲染（v1 仍串行队列内顺序出片）
- 改 IndieWeekly 竖屏版式本身（已有 Portrait composition）

## Impact

- `tools/render-job-worker.mjs`、`render-job-options.mjs`、`render-job-store.mjs`
- webhook 契约（`aspect` 字段）
- 下游 VidFlow change：`video_url_portrait` + hook 分字段回写
