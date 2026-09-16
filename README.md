# Remotion Markdown Video

Interactive Remotion workbench for turning a weekly Markdown document into a video.

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

### Azure Speech + 通义千问

Copy `.env.example` to `.env` (or edit the existing `.env`). The workbench loads `.env` automatically on start.

```console
cp .env.example .env
# edit .env:
#   AZURE_SPEECH_KEY / AZURE_SPEECH_REGION
#   SCRIPT_LLM_API_KEY 或 QWEN_API_KEY（千问）
#   SCRIPT_LLM_MODEL=qwen-plus（默认）
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
4. Click **合成语音** — Azure TTS + timed cues from the script
5. Preview cue timeline / player, then **生成 MP4**

Synthesized audio is written to `public/.generated/` (gitignored). Without Azure credentials, preview still works on the legacy fixed timeline; MP4 render uses that timeline too. Without Qwen credentials, you can still hand-write `旁白:` in Markdown or skip AI and synthesize short MD-derived lines.

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
```

## Deploy to Zeabur (Docker)

This repo includes a Remotion-ready `Dockerfile` for Linux rendering (recommended over macOS versions older than 15).

1. Push the repo to GitHub.
2. In Zeabur, create a service from the repo (Dockerfile will be auto-detected).
3. Give the service enough resources for rendering (recommend **≥ 2 GB memory**, ideally 4 GB).
4. Deploy. Zeabur injects `PORT`; the workbench listens on `0.0.0.0`.

Local Docker check:

```console
docker build -t remotion-workbench .
docker run --rm -p 8080:8080 \
  -e AZURE_SPEECH_KEY=your-key \
  -e AZURE_SPEECH_REGION=eastasia \
  remotion-workbench
```

Then open `http://localhost:8080`.

Notes:

- Chrome Headless Shell is baked into the image at build time (`npx remotion browser ensure`).
- Rendered MP4s live under `/app/out` inside the container and are served at `/renders/...`. Without a persistent volume they are lost on redeploy.
- Concurrent renders are CPU/memory heavy; start with one user / one render at a time.

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
