# Project Context

## Purpose

Remotion Markdown Video turns an Indie Weekly Markdown document into a narrated MP4.
Operators edit Markdown in a local Workbench, preview with `@remotion/player`, then render.

## Tech Stack

- **Remotion** 4.x (`IndieWeeklyMarkdown` composition, 1920×1080 @ 30fps)
- **React** 19 + TypeScript
- **Workbench**: Node HTTP server (`tools/workbench-server.mjs`) + esbuild-bundled client
- **Styling**: Tailwind v4 via `@remotion/tailwind-v4` + `src/index.css`
- **Deploy**: Docker / Zeabur (Linux Chrome Headless Shell for MP4)

## Project Conventions

### Code Style

- TypeScript for `src/`; ESM `.mjs` / JSX for `tools/`
- Prefer small pure helpers in `markdown.ts` / `videoData.ts`
- Chinese UI copy in Workbench is fine

### Architecture Patterns

- Markdown → `WeeklyVideoProps` via `parseMarkdownToVideo`
- Composition reads props + timeline; duration from `calculateMetadata`
- Workbench is the product UI; Remotion Studio remains a power-user escape hatch
- Secrets (Azure Speech key) stay on the server; never bundle into the client

### Testing Strategy

- Prefer lightweight unit tests for parsers / cue builders when adding logic
- Manual Workbench check: synthesize → preview sync → render MP4
- Azure calls mocked in unit tests; live synthesis only with env credentials

### Git Workflow

- OpenSpec proposals under `openspec/changes/` before architectural features
- Do not implement until the change is approved
- Conventional commits preferred

## Domain Context

- Target format: 独立开发变现周刊 — cover, N case scenes, closing
- Weekly Markdown drives visuals (images, titles, metrics)
- Spoken narration SHOULD come from an AI-optimized, editable 逐字稿 (then Azure TTS), not raw first sentences
- Images: `public/` paths or remote `https://` URLs

## Important Constraints

- Remotion 4.0.523 local MP4 composition on macOS needs macOS 15+; Linux/Docker is the reliable render path
- Do not commit Azure keys, LLM keys, or generated speech dumps with secrets
- Generated audio under `.workbench/` / `out/` / `public/.generated` stays gitignored

## External Dependencies

- Azure AI Speech (TTS + WordBoundary / SentenceBoundary timing)
- OpenAI-compatible Chat Completions for 逐字稿 rewrite — **default: 通义千问 / DashScope** (`SCRIPT_LLM_*`, fallback `QWEN_API_KEY`, model `qwen-plus`)
- Optional: Zeabur for hosted Workbench rendering
