# Design: add-video-render-service-api

## Context

Remotion 仓库已具备：

- Markdown 解析（IndieWeeklyMarkdown 形状）
- 千问逐字稿（`/api/script`）
- Azure TTS + cues（`/api/synthesize`）
- Remotion CLI 渲染（`/api/render`）
- Workbench UI

VidFlow 侧已有本地 `weekly_video` 管线（自建 script + edge-tts + `vidflow/video` Remotion + 七牛），希望改为调用 **独立 Remotion 服务**，统一用「千问稿 + Azure 时间戳 + IndieWeekly 版式」成片。

约束：

- 对外 API，供 VidFlow 服务端调用（非浏览器直连）
- 传入 Markdown；服务内优化/逐字稿/合成/渲染/上传七牛；返回下载链接
- OpenSpec 审核通过后再实现

## Goals / Non-Goals

- Goals:
  - 鉴权的异步渲染 Job API
  - 端到端流水线与现有 Workbench 能力对齐
  - 七牛 CDN `video_url` 作为成功结果
  - **完成时 webhook 回调 VidFlow**（主集成路径）
  - 契约稳定，便于 VidFlow OpenSpec 对接
- Non-Goals:
  - 写 VidFlow 数据库
  - 要求 VidFlow 轮询 Remotion（`GET` 仅运维可选）
  - 多租户计费、复杂队列（K8s/Redis）— v1 进程内串行 + 磁盘 job 状态即可
  - 替换 Workbench（UI 保留；服务 API 可共用核心函数）

## Decisions

### 1. 异步 Job + Webhook 完成通知

渲染可能数分钟。**Decision**：

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/render-jobs` | 创建任务，立即返回 `job_id` + `status=queued`；body 必填 `callback_url` |
| `GET` | `/api/v1/render-jobs/{job_id}` | **可选**运维查询；不是 VidFlow 主路径 |
| `GET` | `/api/v1/health` | 探活 |

任务到达终态（`done` 或 `failed`）后，Remotion **MUST** 向创建时登记的 `callback_url` 发起 `POST`（VidFlow hook）。

### 2. 请求 / 响应契约

`POST /api/v1/render-jobs` body：

```json
{
  "markdown": "---\nissue: 156\n...",
  "client_ref": "vidflow-issue-uuid",
  "callback_url": "https://vidflow.example/api/hooks/remotion/video-jobs",
  "options": {
    "skip_ai_script": false,
    "voice": "zh-CN-YunxiNeural",
    "aspect": "landscape",
    "template_id": "midnight"
  }
}
```

- `markdown`：**必填**，符合 Remotion IndieWeekly Markdown 约定（含案例图 URL）
- `client_ref`：调用方关联 ID（VidFlow 的 `issue_id`），原样回传 hook
- `callback_url`：**必填**（服务模式）；任务终态 POST 到此 URL
- `skip_ai_script`：若 MD 已含完整 `旁白:` 可跳过千问
- `options.aspect`：`"landscape"`（默认，1920×1080）或 `"portrait"`（1080×1920）；非法值按 landscape
- `options.template_id`：可选画面模板（midnight / noir / ocean / ember / studio）

成功创建 `202`：

```json
{
  "job_id": "...",
  "status": "queued",
  "client_ref": "...",
  "aspect": "landscape"
}
```

### 2b. Webhook 载荷（Remotion → VidFlow）

`POST {callback_url}`，建议头：

- `Content-Type: application/json`
- `X-Remotion-Signature: sha256=<hmac_hex>`（用共享密钥对 raw body 做 HMAC-SHA256；密钥可用 `RENDER_API_KEY` 或单独 `RENDER_WEBHOOK_SECRET`）
- `X-Remotion-Job-Id: <job_id>`

Body：

```json
{
  "job_id": "...",
  "client_ref": "vidflow-issue-uuid",
  "status": "done",
  "progress": 100,
  "video_url": "https://cdn.example/....mp4",
  "error": null,
  "finished_at": "2026-09-16T08:00:00.000Z"
}
```

失败时：`status=failed`，`video_url=null`，`error` 为可读信息。

投递策略：

- 至少尝试 1 次；失败则指数退避重试（如 3 次：2s / 10s / 60s）
- VidFlow 应返回 `2xx` 表示接收成功；非 2xx 视为需重试
- hook 失败 **不**回滚已上传的七牛对象；job 仍为 `done`/`failed`，并记录 `callback_status`

状态机：`queued` → `scripting` → `synthesizing` → `rendering` → `uploading` → `done` | `failed`（终态后触发 callback）。

`GET` 成功态示例（运维可选）：

```json
{
  "job_id": "...",
  "client_ref": "...",
  "status": "done",
  "progress": 100,
  "video_url": "https://cdn.example/weekly-video/....mp4",
  "script": { "intro": "...", "cases": [], "closing": "..." },
  "error": null,
  "callback_status": "delivered",
  "created_at": "...",
  "finished_at": "..."
}
```

### 3. 鉴权

- **Decision**：共享密钥 `RENDER_API_KEY`；请求头 `Authorization: Bearer <key>` 或 `X-Api-Key: <key>`。
- Workbench 本地 UI 路由可继续无此 Key；`/api/v1/*` **必须**校验。
- 缺 Key 或错误 → `401`。
- Webhook 出站签名使用同一密钥族，便于 VidFlow 验签。

### 4. 流水线复用现有模块

```text
markdown
  → parseMarkdownToVideo
  → generateNarrationScript (千问) 除非 skip / MD 旁白齐全
  → applyNarrationScript
  → synthesizeVideoProps (Azure)
  → remotion render IndieWeeklyMarkdown
  → qiniu.upload mp4
  → persist video_url
  → POST callback_url (hook)
```

并发：v1 **全局串行**一个 render（与 VidFlow 旧策略一致），新任务排队。

### 5. 七牛在 Remotion 服务侧上传

- Env：`QINIU_ACCESS_KEY` / `QINIU_SECRET_KEY` / `QINIU_BUCKET` / `QINIU_CDN_DOMAIN`
- Key 前缀建议：`remotion-weekly/{job_id}.mp4` 或 `weekly-video/{client_ref}/{job_id}.mp4`
- 上传失败 → job `failed`，仍触发 hook（带 error），不返回伪造 URL
- 实现可移植 VidFlow `QiniuClient` 的 HMAC 逻辑到 Node，或不引入 SDK 的 form upload

### 6. Job 存储

- **Decision**：`.workbench/jobs/{job_id}/` 目录：`job.json` 状态 + 中间产物（wav、props、mp4）
- 进程重启后可从磁盘恢复查询；进行中的 render 重启后标 `failed` 并尽量补发 hook（v1 可接受）
- 不引入 Postgres（保持 Remotion 服务无 DB 依赖）

### 7. 与 Workbench 共存

- 同一 Node 服务增加 `/api/v1/*`；或 `npm run service` 专用入口
- Docker/Zeabur 部署时暴露服务端口，注入 Speech / 千问 / 七牛 / API Key
- Workbench 本地渲染 **不要求** `callback_url`

## Risks / Trade-offs

- 长任务与单机串行 → 吞吐有限；后续可加队列
- Markdown 形状与 VidFlow 导出不一致 → 由 VidFlow 负责适配成 IndieWeekly MD（见对方 OpenSpec）
- Webhook 可达性：VidFlow 须对 Remotion 出站可达；签名防伪造
- hook 投递失败但成片已上传 → 依赖重试 + 运维 `GET` 补救
- 密钥增多（Speech + 千问 + 七牛 + API Key）→ README 清单化

## Migration Plan

- 现有 Workbench 行为不变
- VidFlow 切换到本 API + hook 后，可逐步停用其本地 `vidflow/video` 渲染路径（对方 change 决策）

## Open Questions

无阻塞。主路径为 webhook；不把轮询列为集成要求。
