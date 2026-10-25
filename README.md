# Remotion Markdown Video

Interactive Remotion workbench for turning a weekly Markdown document into a video.
Also exposes an authenticated **render service API** for VidFlow (async jobs + webhook).

## Commands

```console
npm install
npm run workbench
```

Open the printed local URL, paste or import a Markdown file, then:

1. **生成逐字稿**（通义千问）→ edit spoken lines
2. **合成语音**（Azure Speech）→ preview synced subtitles
3. **生成 MP4**

Rendered videos are written to `out/`.

### 数字人主持人

在 Workbench 的模板区域选择 **数字人主持人**，可以直接播放标注为「效果示例」的预览，检查固定人物的嘴型、眨眼和手腕动作；这一步无需调用外部服务，也不会覆盖已有逐字稿、分镜或语音。

制作自己的视频：**生成逐字稿 → 生成分镜 → 播放预览 → 生成 MP4**。语音可选；合成语音后，分镜会重新匹配当前语音字幕时间轴。生成分镜使用已配置的逐字稿模型服务。生成的分镜会在当前 Markdown、语言和逐字稿匹配时从本地缓存恢复。示例仅供预览，自己的分镜生成前不会允许导出示例 MP4。

数字人使用同一份 SVG 母版，Workbench 预览与 MP4 共用人物动画。当前口型按帧合成，并未做音素同步；指向手势支持小幅手腕动作。可运行 `node --test tools/workbench-host.test.mjs tools/host-animation.test.mjs` 验证工作流与动画边界。

### Azure Speech + 通义千问

Copy `.env.example` to `.env` (or edit the existing `.env`). The workbench loads `.env` automatically on start.

```console
cp .env.example .env
# edit .env:
#   AZURE_SPEECH_KEY / AZURE_SPEECH_REGION
#   SCRIPT_LLM_API_KEY 或 QWEN_API_KEY（千问）
#   SCRIPT_LLM_MODEL=qwen-plus（默认）
#   RENDER_API_KEY（服务 API）
#   QINIU_*（服务模式上传）
npm run workbench
```

Defaults for script LLM:

- Base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- Model: `qwen-plus`

China DashScope account: set `SCRIPT_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`.

Workflow:

1. Edit or import weekly Markdown (visual structure)
2. Click **生成逐字稿** — Qwen rewrites spoken narration (or loads MD `旁白:` fields if all present)
3. Edit the script panel if needed
4. Click **合成语音** — one Azure request for the whole narration; scene cuts and subtitles follow that audio's timestamps
5. Preview cue timeline / player, then **生成 MP4**

Synthesized audio is one continuous WAV under `public/generated/` (gitignored). The same full script + voice is cached under `.workbench/tts-cache/` and reused on later synthesize (no Azure call). Editing any spoken line, or changing `AZURE_SPEECH_VOICE`, rebuilds the whole track. Without Azure credentials, preview still works on the legacy fixed timeline; MP4 render uses that timeline too. Without Qwen credentials, you can still hand-write `旁白:` in Markdown or skip AI and synthesize short MD-derived lines.

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
npx remotion render IndieWeeklyMarkdownPortrait out/video-portrait.mp4 --props=props.json
```

Workbench can switch **横屏 16:9** / **竖屏 9:16** and visual templates before preview or export. Props field `aspect` is `"landscape"` | `"portrait"`.

## Render service API (`/api/v1`)

For VidFlow / server-to-server integration (not the Workbench UI):

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/api/v1/health` | no | Probe |
| `POST` | `/api/v1/render-jobs` | Bearer / `X-Api-Key` | Create job; **requires** `callback_url` |
| `GET` | `/api/v1/render-jobs/:id` | Bearer / `X-Api-Key` | Ops only — do not poll as primary path |

Create body:

```json
{
  "markdown": "---\\nissue: 156\\n...",
  "client_ref": "vidflow-issue-uuid",
  "callback_url": "https://vidflow.example/api/hooks/remotion/video-jobs",
  "options": {
    "skip_ai_script": false,
    "locale": "zh",
    "voice": "zh-CN-YunxiNeural",
    "aspect": "portrait",
    "aspects": ["portrait"],
    "template_id": "midnight"
  }
}
```

`options.locale`: `"zh"`（默认）或 `"en"`。英文视频请传 `locale: "en"` 与英文音色（如 `en-US-JennyNeural`）；Markdown 可用 `Author`/`Date`/`Metric`/`## Takeaway`。

`options.aspect`: `"portrait"`（默认 9:16）或 `"landscape"`（16:9）。未传 `aspects` 时默认只渲竖屏。

Pipeline: Markdown → Qwen script (unless skip / full `旁白`) → one Azure TTS track (scene cuts and subtitles follow its timestamps) → Remotion MP4 → Qiniu → **POST webhook**.

Webhook headers: `X-Remotion-Signature: sha256=<hmac>` (HMAC-SHA256 of raw body with `RENDER_WEBHOOK_SECRET` or `RENDER_API_KEY`), `X-Remotion-Job-Id`.

Required env for service mode: `RENDER_API_KEY`, Azure Speech, Qwen (unless skip), `QINIU_*`.

## Deploy to Zeabur (Docker)

This repo includes a Remotion-ready `Dockerfile` for Linux rendering (recommended over macOS versions older than 15).

1. Push the repo to GitHub.
2. In Zeabur, create a service from the repo (Dockerfile will be auto-detected).
3. Give the service enough resources for rendering (recommend **≥ 2 GB memory**, ideally 4 GB).
4. Set env: `RENDER_API_KEY`, `AZURE_SPEECH_*`, `SCRIPT_LLM_*` / `QWEN_API_KEY`, `QINIU_*`.
5. Deploy. Zeabur injects `PORT`; the workbench + API listen on `0.0.0.0`.

Local Docker check:

```console
docker build -t remotion-workbench .
docker run --rm -p 8080:8080 \
  -e AZURE_SPEECH_KEY=your-key \
  -e AZURE_SPEECH_REGION=eastasia \
  -e RENDER_API_KEY=dev-secret \
  -e QINIU_ACCESS_KEY=... \
  -e QINIU_SECRET_KEY=... \
  -e QINIU_BUCKET=... \
  -e QINIU_CDN_DOMAIN=... \
  -e QINIU_KEY_PREFIX=weekly-video \
  remotion-workbench
```

Then open `http://localhost:8080` (Workbench) or call `GET /api/v1/health`.

Notes:

- Chrome Headless Shell is baked into the image at build time (`npx remotion browser ensure`).
- Rendered MP4s live under `/app/out` and job artifacts under `/app/.workbench/jobs`. Without a persistent volume they are lost on redeploy.
- Concurrent renders are CPU/memory heavy; v1 processes **one render job at a time** (global serial queue).

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
- `旁白` / `narration`（口播逐字稿；导语/案例/结尾都可写。全部写齐后点「生成逐字稿」会直接载入，不调用千问）

Images can be files under `public/` such as `case-images/example.png`, or remote `https://` URLs.

## 图表与图片重点镜头

数字人模板支持来源数据图表、原图全貌到局部的聚焦，以及跨相邻字幕的策略关系图。预览与导出使用同一份经校验的分镜。

截图中人工核对的数据保存在 `public/host-evidence.json`：每条包含原图路径、SHA-256、单位、图表数据、重点区域和出处。服务端通过 `/api/host-evidence` 仅提供与当前图片摘要一致的条目，并在分镜生成、MP4 导出时重新校验。该清单是人工核对记录，不是自动 OCR；图片更换后需要重新核对。

当前 GojiberryAI 原图提供的是 MRR 阶段，横轴按阶段排列，不假设月份间隔；`$150k+` 保留为下界。年度 ARR 不与月度 MRR 混绘。其他内容没有多点来源数据时使用单值或原有布局，不补造增长曲线。

本轮规范与验收记录见 `openspec/changes/add-evidence-driven-host-visuals/`。

## 按内容组织中间画面

数字人分镜会从当前讲解选择流程、并列要点、明确对比或重点展示。已有缓存也使用同一增强入口，不需要重新生成逐字稿；原句没有依据的功能、数据和因果不会补进画面。真实图片与已核对图表保留，多项不同单位的指标分别展示，不共用比较坐标。

长解释按语义分页，人物在各分镜固定大小，黄色字幕保持上移。当前实现是规则提取与程序动画，不会自动生成真实产品操作录像。规范见 `openspec/changes/improve-content-adaptive-host-scenes/`，独立技术备份见 `docs/technical/content-adaptive-host-scenes.md`。
