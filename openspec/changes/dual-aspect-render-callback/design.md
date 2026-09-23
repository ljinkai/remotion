# Design: dual-aspect-render-callback

## Storage (explicit)

| 位置 | 生命周期 |
|------|----------|
| `.workbench/jobs/{jobId}/`（`script.json`、`props.json`、`out-landscape.mp4`、`out-portrait.mp4`） | **临时**。进程/机器重启可丢；不保证长期保留 |
| 七牛 `video_url` | **持久**。VidFlow / 扩展只存 CDN URL |

成片交付以 webhook 中的 CDN URL 为准，不依赖 Remotion 磁盘文件。

## Pipeline

```
queued
  → scripting（千问或 MD 旁白）
  → synthesizing（Azure TTS + cues）一次
  → for aspect in aspects:
        rendering → uploading → CALLBACK({ aspect, video_url, status })
  → done（或竖屏失败 → failed，横屏 URL 仍在 job 记录中）
```

### Callback payload（增量）

```json
{
  "job_id": "...",
  "client_ref": "...",
  "status": "partial" | "done" | "failed",
  "aspect": "landscape" | "portrait",
  "video_url": "https://...",
  "progress": 50,
  "error": null,
  "finished_at": "..."
}
```

- 横屏上传成功：`status=partial`（若还有后续 aspect）或 `done`（仅横屏）
- 竖屏上传成功且为最后一项：`status=done`
- `progress`：横屏完成约 55，竖屏完成 100（可微调）

### Options

```json
"options": {
  "aspects": ["landscape", "portrait"],
  "aspect": "landscape"
}
```

- 若提供 `aspects` 非空数组，以其为准（去重，只允许 landscape/portrait）。
- 否则回退现有 `aspect` 单值（默认 landscape）。

## Risks

- 任务更长：竖屏多一次 render+upload；超时配置需按双倍留余量或按 aspect 累计。
- 旧 VidFlow 忽略 `aspect` 时：partial 回调可能把竖屏 URL 误写入 `video_url` → **VidFlow 必须同步改 hook**（本仓库 change 与 VidFlow change 一起上）。
