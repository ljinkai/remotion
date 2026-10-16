# Design: 整轨旁白合成

## Context

现在的成片路径：

1. Markdown → `WeeklyVideoProps`（`introSubtitle` / `cases[].subtitle` / `closingSubtitle`）
2. `synthesizeVideoProps` 对每个场景调用 `synthesizeScene` → `speakTextAsync`
3. 每段得到 WAV、`durationMs`、相对该段起点的 `cues`
4. `getDurationInFrames` 把各段 `durationMs` 再加 `SCENE_PADDING_MS`（300）
5. `MyComponent` 在每个 `Sequence` 里挂各自的 `Audio`

Azure 的 `WordBoundary` 已经带 `audioOffset`（音频上的时间）和 `textOffset`（原文 UTF-16 偏移）。`buildTimedSubtitleCues` 用 `textOffset` 把词分到字幕行。音色试听 `POST /api/voice-preview` 仍走单句 `synthesizeScene`。

本变更只改「合成语音」这条成片音轨。逐字稿、画面版式、横竖屏、七牛上传都不改。

## Goals / Non-Goals

- Goals:
  - 一期口播一次合成，听感连续
  - 画面仍按封面 → 案例 → 结尾切换，切换点落在段与段之间的停顿上
  - 字幕仍是一行一条 cue，时间跟该场景里的词对齐
  - Workbench `POST /api/synthesize` 与服务任务 `synthesizing` 共用同一入口
  - 没有整轨字段的旧 props 仍按分段音频或固定帧播放
- Non-Goals:
  - 逐字卡拉 OK、多音色、BGM
  - 把已经合成好的分段 WAV 拼接成整轨（拼接消不掉每段的起调）
  - 超长稿自动拆成多次请求再拼接
  - 改字幕断行规则（`splitSubtitleLines` / `narrationForSpeech` 保持原样）

## Decisions

### 1. 一次 SSML，段间用 break，场景起点用 bookmark

一次 `speakSsmlAsync`。每个有口播的场景先放 bookmark，再放该场景的口播文本。场景之间放 `<break time="400ms"/>`。

```xml
<speak version="1.0" xml:lang="zh-CN">
  <voice name="zh-CN-YunxiNeural">
    <bookmark mark="intro"/>
    这期讲单渠道突破法。
    <break time="400ms"/>
    <bookmark mark="case-0"/>
    第一条，小众产品重启。很多项目死在太早放弃。
    <break time="400ms"/>
    <bookmark mark="closing"/>
    增长要把一个动作做透。觉得有用就关注一下，我们下周见。
  </voice>
</speak>
```

- 口播正文用现有的 `narrationForSpeech(场景原文)`，也就是字幕行用 `。` 拼起来再补一个句号。这样段内和现在的读法一致。
- bookmark 名字：`intro`、`case-0`、`case-1`、…、`closing`。
- `xml:lang`：`locale === "en"` 用 `en-US`，否则 `zh-CN`。音色仍走 `resolveVoiceId`。
- 正文做 XML 转义：`&` `<` `>`。
- 停顿常量：`SCENE_BREAK_MS = 400`。写在 SSML 里，也写进缓存 key。

空口播场景不进 SSML 正文。它在时间轴上占 `SILENT_DURATION_MS`（2000）的画面，音轨在对应位置放等长 `<break>`，bookmark 仍打在这段静音的起点。这样画面有一拍停住，音轨时间不会跳。

全部场景都没有口播时不调用 Azure，保持现在的固定帧预览。

SSML 的 UTF-8 长度超过 60000 字节时，在请求 Azure 之前直接失败，错误写明稿子过长。周刊成片一般远小于这个上限。v1 不自动拆请求。

### 2. 场景起止以 bookmark 的音频偏移为准

订阅 `bookmarkReached`，记下 `{ name, audioOffsetMs }`。

按场景顺序：

| 场景 | `startMs` | `durationMs` |
|------|-----------|--------------|
| 非最后一段 | 该段 bookmark 的 `audioOffsetMs` | 下一段 bookmark − 本段 bookmark |
| 最后一段 | 该段 bookmark 的 `audioOffsetMs` | 整轨 `audioDuration` − 本段 bookmark |

非最后一段的 `durationMs` 已经包含后面那 400ms 停顿。最后一段不再额外补停顿。

缺 bookmark、bookmark 乱序、或某段 `durationMs < 200` 时，整次合成失败，不返回半成品 props。

### 3. 字幕继续用词边界，但 textOffset 按场景正文重算

SSML 模式下 Azure 的 `textOffset` 指向 SSML 字符串，不能直接交给 `buildTimedSubtitleCues`（它假定偏移落在 `narrationForSpeech` 的结果上）。

做法：

1. 取出 `audioOffsetMs` 落在 `[scene.startMs, scene.startMs + scene.durationMs)` 的词事件。
2. 丢掉纯标点事件（与 `buildTimedSubtitleCues` 现有过滤一致）。
3. 在该场景的 `narrationForSpeech` 字符串上，从左到右 `indexOf(词文本)`，把找到的下标写回 `textOffset`，并把 `audioOffsetMs` 减去 `scene.startMs`。
4. 调用现有 `buildTimedSubtitleCues(场景原文, scene.durationMs, 重算后的词)`。

对不上的词跳过，继续用后面的词。一个场景一个词都对不上时，`buildTimedSubtitleCues` 会退回按字数分时，这一段仍有字幕，只是这一段的切行不够准。

最后一条 cue 的 `endMs` 等于该场景 `durationMs`，停顿期间字幕保持到切画面。

### 4. Props：一条音轨，cue 仍相对场景

```ts
type WeeklyVideoProps = {
  // 已有字段…
  /** 整轨旁白。有值时成片只播这一条，时长按各场景 durationMs 相加，不再加 SCENE_PADDING_MS */
  narrationAudioSrc?: string;
};
```

合成成功后：

- `useSynthesizedTimeline = true`
- `narrationAudioSrc` = 缓存 WAV 的 public 相对路径（`generated/tts-cache/<key>.wav`）
- 各场景写入 `durationMs` 与相对该场景的 `cues`
- `introAudioSrc`、`cases[].audioSrc`、`closingAudioSrc` 留空
- 顶层样例 `audioSrc` 在已合成时继续按现在的 `normalizeVideoProps` 清掉

画面组件不用改。`SceneSubtitles` 仍然拿场景内 cue 和场景内时间。

### 5. 时间轴按累计毫秒取整，避免每段单独进位

整轨播放时，画面总长必须和这一条 WAV 对齐。现在的 `msToFrames` 对每段 `Math.ceil`，十段可能多出大约三百毫秒，音轨会先结束。

有 `narrationAudioSrc` 时：

```
frame(ms) = max(0, round(ms / 1000 * 30))
场景 i 的 startFrame = frame(前面各段 durationMs 之和)
场景 i 的 durationFrames = frame(到本段结束的累计 ms) - startFrame
总帧数 = frame(全部 durationMs 之和)，至少 1
```

相邻场景若因取整挤成 0 帧，给该段 1 帧，并从后一段扣回（后一段至少留 1 帧）。

没有 `narrationAudioSrc` 时，维持「合成段时长 + 300ms」和固定帧兜底。

### 6. 成片只挂一条 Audio

`narrationAudioSrc` 有值时，在根 `AbsoluteFill` 挂一条 `Audio`，从第 0 帧播到片尾。各 `Sequence` 不再挂该场景的 `Audio`。

没有整轨、但场景自己有 `audioSrc` 的旧 props，继续在对应 `Sequence` 里播放。没有合成时间轴时，继续播放顶层样例 `audioSrc`。

`embedLocalAudioAsDataUrls` 对 `narrationAudioSrc` 做和现有本地 WAV 一样的 data URL 嵌入，渲染不依赖 public 路径解析。

### 7. 缓存按整篇口播

`tts-cache` 的 `CACHE_VERSION` 提到 `3`。key 的明文是：

```json
{
  "v": 3,
  "mode": "continuous",
  "voice": "zh-CN-YunxiNeural",
  "breakMs": 400,
  "scenes": [
    { "id": "intro", "text": "…" },
    { "id": "case-0", "text": "…" },
    { "id": "closing", "text": "…" }
  ]
}
```

`meta.json` 另存 `durationMs` 和每个场景的 `{ id, startMs, durationMs, cues }`。命中缓存时直接写回 props，不再请求 Azure。

任一场景文案、音色或 `breakMs` 变化都会换 key。旧的分段缓存（v2）自然 miss，不读取、不迁移。

音色试听仍用 `synthesizeScene`，不写整轨缓存。

## 数据流

```
props.introSubtitle + cases[].subtitle + closingSubtitle
        │
        ▼
buildNarrationPlan()     纯函数：场景列表、每段 speakText、SSML
        │
        ▼
缓存命中? ──是──► 写回 narrationAudioSrc / durationMs / cues
        │否
        ▼
synthesizeNarrationTrack()   一次 speakSsmlAsync
        │  bookmarkReached + WordBoundary + WAV
        ▼
assignSceneTimings()     纯函数：起止、相对 cue
        │
        ▼
writeTtsCache + props
        │
        ▼
Composition：一条 Audio，Sequence 只切画面和字幕
```

Workbench 与 `/api/v1/render-jobs` 都已经调用 `synthesizeVideoProps`，入口不用加新 API。

## 文件职责

| 文件 | 职责 |
|------|------|
| `tools/continuous-narration.mjs` | `buildNarrationPlan`、`buildNarrationSsml`、`assignSceneTimings`、`rebaseWordOffsets`。不读文件、不访问网络 |
| `tools/continuous-narration.test.mjs` | 上列函数的节点测试 |
| `tools/azure-tts.mjs` | `synthesizeNarrationTrack(ssml, outputPath, { voice })` 返回 `{ durationMs, audioPath, bookmarks, boundaries }`。`synthesizeScene` 保留 |
| `tools/synthesize-props.mjs` | 编排计划、缓存、合成、写 props |
| `tools/tts-cache.mjs` | v3 整轨 meta |
| `src/videoData.ts` | `narrationAudioSrc`；有整轨时时长与帧边界按累计毫秒 |
| `src/Composition.tsx` | 整轨单 `Audio` |
| `tools/embed-audio-data-urls.mjs` | 嵌入 `narrationAudioSrc` |

## 测试

节点测试不连 Azure，输入用手写的 bookmark 和词边界：

1. 三段都有口播：SSML 顺序是 bookmark、正文、break；正文已转义 `&`。
2. 中间案例原文为空：该段是 2000ms break，不出现空 voice 文本。
3. bookmark 偏移 0 / 3200 / 8000，音频总长 11000：三段 `durationMs` 为 3200、4800、3000。
4. 词的 `audioOffsetMs` 落在第二段内：cue 的 `startMs` 从 0 起算，等于该词偏移减去第二段 `startMs`。
5. 词的 `textOffset` 即便指向 SSML（例如 120），重算后仍落在该段 `narrationForSpeech` 内，并且第二行 cue 的 `startMs` 等于第二行第一个词。
6. bookmark 缺失或乱序：`assignSceneTimings` 抛错。
7. SSML 超过 60000 字节：`buildNarrationSsml` 抛明确错误。

手工：Workbench 对一份两案例周刊点「合成语音」，预览里换画面时声音不重新起调；字幕在每段内部换行；生成的 MP4 与预览一致。再改一行口播，确认缓存 miss 并整篇重合成。

## Risks / Trade-offs

- 改一行就要整篇重合成，Azure 耗时和费用按整期计算。周刊长度下可以接受。
- SSML 与 `textOffset` 的偏差靠「词文本在本段口播里顺序匹配」消化。Azure 若把一个词切得和原文对不上，这一行会退回按字数估时，只影响这一段的字幕，不影响音轨连续。
- 400ms 停顿是固定值。太短会觉得画面跟话抢，太长又像又断开了。先用 400，常量集中在 `SCENE_BREAK_MS`。
- 单次 SSML 有长度上限。超限直接失败，避免静默截断。

## 兼容

已经写好的 props（只有分段 `audioSrc`、没有 `narrationAudioSrc`）播放方式不变。新的合成结果不再填分段 `audioSrc`。
