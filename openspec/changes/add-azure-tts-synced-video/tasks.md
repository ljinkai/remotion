## 1. Props 与时间轴

- [x] 1.1 在 `src/videoData.ts` 增加 `SubtitleCue` 与场景级 `durationMs` / `audioSrc` / `cues`（intro、case、closing 对称可用）
- [x] 1.2 `normalizeVideoProps` 兼容旧 props（缺字段不崩）
- [x] 1.3 `buildTimeline` / `getDurationInFrames`：有完整 `durationMs` 时用真实时长（含约定 padding）；否则回退固定帧

## 2. 成片布局与播放

- [x] 2.1 改造 `CaseScene` 为上图下字；更新 `src/index.css`
- [x] 2.2 按场景 `cues` + 场景内相对时间显示字幕
- [x] 2.3 使用 `Sequence`（或等价）按真实 timeline 切换 intro / cases / closing，并在场景内播放对应 `audioSrc`
- [x] 2.4 封面与结尾使用同一套下方字幕/cue 逻辑

## 3. Azure TTS 模块

- [x] 3.1 `package.json` 增加 `microsoft-cognitiveservices-speech-sdk`
- [x] 3.2 新建 `tools/azure-tts.mjs`：单段文本 → wav + `durationMs` + 句级 `cues`（SentenceBoundary / WordBoundary）
- [x] 3.3 读取 `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` / 可选 `AZURE_SPEECH_VOICE`；缺省音色 `zh-CN-YunxiNeural`
- [x] 3.4 空文本不调用 Azure；返回短静音时长

## 4. Workbench API 与 UI

- [x] 4.1 `POST /api/synthesize`：编排 intro/cases/closing，写入 `.workbench/synth-<id>/`，返回 enriched props
- [x] 4.2 托管合成音频，供 Player 与 render 访问
- [x] 4.3 `workbench-client.jsx`：合成语音按钮、进度/错误、成功后刷新预览 props
- [x] 4.4 「生成 MP4」使用当前（可能已合成）props；无合成时行为符合 spec（可提示、不强制阻断）

## 5. 文档与验收

- [x] 5.1 README 补充 Azure 环境变量与「合成 → 预览 → 渲染」流程
- [x] 5.2 确认 `.workbench` / 合成产物不被 git 跟踪
- [x] 5.3 `openspec validate add-azure-tts-synced-video --strict` 保持通过
- [ ] 5.4 人工验收：样例 MD + 有效 Azure 凭证 → 音字同步预览 → 产出带旁白 MP4
