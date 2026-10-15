# Change: 整轨一次合成旁白，字幕与画面按时间戳对齐

## Why

当前合成按封面、每个案例、结尾分别调用 Azure。每次调用都会重新起调并在句尾收住，场景之间再加 300ms 留白，成片里也是每段一个独立 `Audio`。听感是一段一段重新开口，而不是同一个人连续讲完一期。

## What Changes

- 「合成语音」改为**一次** Azure 请求，产出**一条**全程 WAV。
- 场景之间在同一次合成里插入 400ms 停顿，语调不断，只给换画面留一拍。
- 用 SSML bookmark 的音频偏移决定每个场景的起止；字幕 cue 仍按词边界，时间相对该场景起点。
- 成片只挂这一条全程音轨。已有的分段 `audioSrc` 成片继续按旧路径播放。
- 改任意一段口播会使整轨缓存失效，需要整篇重合成。

## Impact

- Affected specs:
  - `azure-speech-synthesis`
  - `weekly-video-composition`
- Affected code:
  - `tools/continuous-narration.mjs` — 新建，纯函数：拼稿、SSML、切场景、cue 相对化
  - `tools/azure-tts.mjs` — 增加整轨 `speakSsmlAsync`，保留 `synthesizeScene` 给音色试听
  - `tools/synthesize-props.mjs` — 合成入口改为整轨
  - `tools/tts-cache.mjs` — 缓存版本升到 3，存整轨与各场景时间
  - `src/videoData.ts` — `narrationAudioSrc`；整轨时长不再额外加 padding
  - `src/Composition.tsx` — 有整轨时只播一条 `Audio`
  - `tools/embed-audio-data-urls.mjs` — 渲染前把整轨嵌成 data URL
  - `tools/continuous-narration.test.mjs` — 不调用 Azure 的时间轴测试
  - `README.md` — 说明合成是整轨一次
