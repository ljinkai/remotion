# Change: Workbench 接入 Azure TTS，生成音字同步周刊视频

## Why

当前 Markdown → 视频管线用固定时长（封面 6s、案例 9s、结尾 5s）和预置 `narration.wav`，旁白与字幕/场景切换对不齐；案例画面也是「图上叠文案 + 底部字幕条」，不是清晰的「上图下字」。运营需要：根据 MD 文稿用**微软 Azure Speech** 合成语音，并用官方边界事件做时间匹配，在 Workbench 内一键得到有旁白的成片。

## What Changes

- 案例页改为**上方案例图、下方字幕**；字幕文案与合成语音一致。
- 接入 **Azure AI Speech SDK**：按场景分段 TTS，收集 WordBoundary / SentenceBoundary，生成句级 `cues` 与真实 `durationMs`。
- Workbench 新增「合成语音」：`POST /api/synthesize` → 返回带 `audioSrc` / `cues` / `durationMs` 的 props，Player 可预听预看。
- 成片时间轴改为各场景音频时长之和（`Sequence` + 分段 `Audio`）；无合成时长时保留旧固定帧兜底。
- 凭证仅服务端环境变量：`AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`、可选 `AZURE_SPEECH_VOICE`。
- **不做**：接入 vidflow、逐字卡拉 OK 高亮、背景乐混音、Edge-TTS。

## Impact

- Affected specs（新建 capability）:
  - `weekly-video-composition`
  - `azure-speech-synthesis`
  - `markdown-workbench`
- Affected code（预期）:
  - `src/videoData.ts` — cues / durationMs / audioSrc、真实 timeline
  - `src/Composition.tsx` / `src/index.css` — 上图下字 + cue 字幕
  - `tools/azure-tts.mjs` — 新建
  - `tools/workbench-server.mjs` — `/api/synthesize`、静态托管合成音频
  - `tools/workbench-client.jsx` — 合成按钮与状态
  - `package.json` — `microsoft-cognitiveservices-speech-sdk`
  - `README.md` — 环境变量与两步操作说明
- 实现前必须通过本 proposal；通过前 **不写业务代码**。
