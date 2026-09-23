# Design: english-weekly-locale

## Context

Render pipeline: Markdown → (optional) Qwen narration script → Azure TTS → Remotion → Qiniu → webhook.

VidFlow EN video will send English Markdown and `options.voice=en-US-JennyNeural` plus `options.locale=en`.

Constraints:

- Keep zh path bit-identical when `locale` omitted / `zh`
- Azure already can synthesize English Neural voices if voice id is passed; **blockers are voice allowlist + Chinese-only LLM prompt + Chinese CTA**
- OpenSpec reviewed before merge preference; implement against this design

## Goals / Non-Goals

- Goals:
  - End-to-end English weekly video from EN Markdown
  - Stable API: `options.locale` + English `voice`
  - EN Qwen script + EN fixed closing CTA
  - Parse EN field labels / Takeaway closing (already partially supported)
- Non-Goals:
  - New Remotion visual template
  - Multi-language beyond zh/en
  - Changing webhook payload schema
  - VidFlow DB/UI (peer repo)

## Decisions

### 1. `options.locale`

```json
"options": {
  "locale": "en",
  "voice": "en-US-JennyNeural",
  "aspects": ["landscape", "portrait"]
}
```

| Value | Behavior |
|-------|----------|
| omit / `zh` | Current Chinese defaults |
| `en` | English prompts, CTA, fallback copy; default voice `en-US-JennyNeural` if voice empty |

Also accept frontmatter `locale: en` on Markdown as soft hint if options.locale missing (API options win).

### 2. Voice resolution

- `resolveVoiceId`: **do not** filter to Chinese-only for service API
- Curated list: keep Chinese for Workbench; add small curated EN set (`en-US-JennyNeural`, `en-US-GuyNeural`, `en-GB-SoniaNeural`) for Workbench locale=en
- Live Azure list fetch: when locale=en, filter `en-*` instead of `zh-*`; when zh keep current filter
- Invalid empty → locale default voice

Default EN voice: **`en-US-JennyNeural`**.

### 3. Qwen / script-llm

Branch `buildUserPrompt(props, { locale })`:

- `en`: Instruct English spoken narration; line length rules for Latin (~42 chars/line instead of 汉字 count); closing without subscribe CTA (system appends EN CTA)
- `zh`: unchanged Chinese prompt

`FIXED_CLOSING_NARRATION`:

| locale | CTA |
|--------|-----|
| zh | `觉得有用就关注一下，我们下周见！`（现网） |
| en | `If this was useful, follow for more — see you next week.` |

`appendFixedClosingCta` / `splitClosingSummaryAndCta` take `locale` (or detect EN CTA string).

### 4. Markdown parse

Already accepts `author`/`date`/`metric`. Extend:

- `isClosingSection`: add `\btakeaway\b` / `in one line`（已有 closing|takeaway 则确认大小写不敏感）
- `parseIssueNumber`: match `Issue\s+(\d+)` in addition to `第N期`
- `isBrandLikeTitle`: treat `Indie Maker Weekly` as brand
- Default metric fallback when locale=en: `Featured` instead of `精选`
- Intro fallback / coverSubtitle: English strings when locale=en

Pass locale into `parseMarkdownToVideo(markdown, { locale })` from worker (from options / frontmatter).

### 5. Worker wiring

`render-job-worker.mjs`:

1. Parse options → `locale`, `voice`
2. `parseMarkdownToVideo(md, { locale })`
3. `generateNarrationScript(..., { locale })` unless skip
4. `synthesizeVideoProps(..., { voice })`

### 6. Compatibility

| Caller | Result |
|--------|--------|
| VidFlow zh（不传 locale） | 与现网一致 |
| VidFlow en | 需新字段 |
| Workbench | 可选 locale 切换；默认 zh |

## Risks

- EN Qwen 产出过长/过短 → 调 prompt 行数规则；可先 `skip_ai_script` + MD 内 `Narration:` 联调
- 英文字幕行宽 → Composition 已有 Latin 字号分支，验证即可
- Azure 区域未开 en 音色 → 文档写明；失败 job error 透出

## Migration

无 DB。部署 Remotion 后再部署 VidFlow EN 按钮。
