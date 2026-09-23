# Tasks: english-weekly-locale

## 1. Options & voice

- [x] 1.1 `render-job-options.mjs`：解析 `locale`（`zh`|`en`，默认 zh）
- [x] 1.2 `azure-voices.mjs`：EN curated 列表；locale=en 默认 `en-US-JennyNeural`
- [x] 1.3 worker：locale=en 时默认英文 voice

## 2. Markdown & defaults

- [x] 2.1 `parseMarkdownToVideo(md, { locale })`：Issue N、Indie Maker Weekly、Takeaway、EN fallbacks
- [x] 2.2 EN metric/coverSubtitle/closingTitle 默认

## 3. Narration script

- [x] 3.1 `FIXED_CLOSING_NARRATION_EN` + locale-aware append/split
- [x] 3.2 `script-llm.mjs` 英文 user prompt
- [x] 3.3 worker 传入 locale

## 4. Docs

- [x] 4.1 README：`options.locale`、英文音色
- [x] 4.2 `.env.example` 注释英文 voice

## 5. Verify

- [ ] 5.1 用 VidFlow 风格 EN MD 走 create_job → webhook done
- [ ] 5.2 确认 zh 路径无回归
