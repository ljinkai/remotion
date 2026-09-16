# Change: Remotion 对外视频渲染服务 API（供 VidFlow 调用）

## Why

Workbench 已能本地完成「MD → 千问逐字稿 → Azure TTS → Remotion 成片」，但能力关在交互式 UI 里，VidFlow 周刊管线无法稳定调用。需要把同一流水线 **服务化**：对外提供鉴权 API，接收 Markdown，异步产出 MP4，上传七牛并返回可下载 CDN 链接，供 VidFlow 回写周刊记录。

## What Changes

- 新增 **HTTP 渲染服务**（可与 Workbench 同进程或独立入口）：鉴权、创建任务、查询状态。
- 任务完成（成功或失败）后，Remotion **主动回调**调用方提供的 VidFlow webhook（hook），携带 `job_id` / `client_ref` / `status` / `video_url` / `error`；**不以 VidFlow 轮询远程状态为主路径**（`GET` 仅作运维排查可选）。
- 新增七牛配置与上传模块（Remotion 侧持有 `QINIU_*`，上传成功后才标记任务完成并触发 hook）。
- 任务持久化到本地作业存储（文件目录），支持异步与失败后的 hook 重试。
- **不做**：VidFlow 业务库写入（由 VidFlow 在 hook 内回写）、B 站上传、字级卡拉 OK、复杂队列。

## Impact

- Affected specs（新建）:
  - `render-service-api`
  - `qiniu-upload`
- Affected code（预期）:
  - `tools/workbench-server.mjs` 或新建 `tools/render-service.mjs`
  - `tools/script-llm.mjs` / `azure-tts` / synthesize / remotion render 复用
  - 新建七牛上传 helper
  - `.env.example` / `README.md` / `Dockerfile`（服务端口与密钥）
- 下游：VidFlow change `integrate-remotion-video-service` 依赖本 API 契约。
- 实现前必须通过本 proposal；通过前 **不写业务代码**。
