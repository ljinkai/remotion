## 1. 纯函数与测试

- [x] 1.1 新增 `tools/continuous-narration.mjs`：`buildNarrationPlan`、`buildNarrationSsml`、`rebaseWordOffsets`、`assignSceneTimings`
- [x] 1.2 新增 `tools/continuous-narration.test.mjs`，覆盖 design 里的 7 个节点用例
- [x] 1.3 把该测试加入 `package.json` 的 `test` 脚本并跑通

## 2. Azure 与缓存

- [x] 2.1 `tools/azure-tts.mjs` 增加 `synthesizeNarrationTrack`（`speakSsmlAsync`、bookmark、WordBoundary、写 WAV）
- [x] 2.2 `tools/tts-cache.mjs` 升到缓存版本 3，按整篇场景文本 + 音色 + breakMs 存取整轨和场景时间
- [x] 2.3 `tools/synthesize-props.mjs` 改为整轨编排；空稿不调用 Azure；超长 SSML 在请求前失败

## 3. 成片

- [x] 3.1 `src/videoData.ts` 增加 `narrationAudioSrc`；有整轨时按累计毫秒算帧，不再加 300ms padding
- [x] 3.2 `src/Composition.tsx` 有 `narrationAudioSrc` 时只挂一条全程 `Audio`
- [x] 3.3 `tools/embed-audio-data-urls.mjs` 嵌入 `narrationAudioSrc`

## 4. 说明

- [x] 4.1 README 的合成步骤改为：一次合成整轨，字幕和画面按同一条音频的时间对齐
