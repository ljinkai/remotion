# Design: add-azure-tts-synced-video

## Context

`remotion` 已有：

- `parseMarkdownToVideo`：MD → `WeeklyVideoProps`（intro / cases[].subtitle / closing）
- Workbench：编辑 MD、Player 预览、`POST /api/render` 调 CLI 渲 MP4
- 成片：固定帧时间轴 + 可选整轨 `audioSrc`（样例 `narration.wav`）

约束（已确认）：

- 使用微软 Azure Speech 做合成与时间匹配（非 Edge-TTS）
- Workbench 内支持；按 MD 生成带语音视频
- 案例布局：上图下字；音字一致
- OpenSpec 审核通过后再写代码

## Goals / Non-Goals

- Goals:
  - 分段 Azure TTS + 边界事件 → 句级 cues + 真实场景时长
  - Workbench「合成语音」→ 预览同步 →「生成 MP4」
  - 案例页上图下字；字幕 = 当前 cue 文本
  - Key 仅服务端；缺凭证时可读错误
- Non-Goals:
  - 对接 vidflow 后端 / 七牛上传成片
  - 逐字高亮、多音色对话、BGM
  - 强制废弃无音频的 Studio/props 渲染路径（保留固定帧兜底）

## Decisions

### 1. 按场景分段合成，不做整轨再切

- **Decision**：intro、每个 case、closing 各自 `speakText`/`speakSsml`，产出 `scene_XX.wav` + 该段相对 0 的 cues；整片用 Remotion `Sequence` 拼接。
- **Why**：场景切换与音频边界天然对齐；失败可单段重试；不必做 forced alignment。
- **Alternatives**：整稿一次合成再按字偏移切场景（偏移映射易错）；每句一个文件（请求过多）。

旁白文本映射：

| 场景 | 文本字段 |
|------|----------|
| intro | `introSubtitle` |
| case_i | `cases[i].subtitle` |
| closing | `closingSubtitle` |

空文本：该场景用短静音时长（如 1.5–2s）、无 `audioSrc`、无 cues（或仅占位），不调用 Azure。

### 2. 时间匹配：SentenceBoundary 优先聚句，WordBoundary 兜底

- **Decision**：订阅 Azure `synthesis_word_boundary` / sentence boundary；优先用句边界生成 `SubtitleCue { text, startMs, endMs }`。若仅有词边界，则按中文标点 `。！？!?` 与词 offset 聚合成句。
- **单位**：SDK ticks（100ns）÷ 10_000 → ms；再换算帧：`ms / 1000 * fps`。
- **Why**：运营要的是「一句旁白一条字幕」，不是卡拉 OK。
- **Alternatives**：只按字数估时（拒绝，对不齐）；Batch Synthesis REST（异步重，Workbench 交互差）。

默认音色：`zh-CN-YunxiNeural`（`AZURE_SPEECH_VOICE` 可覆盖）。选用支持 WordBoundary 的 Neural 音色。

### 3. Props 扩展与 timeline

```ts
type SubtitleCue = { text: string; startMs: number; endMs: number };

// 场景级（intro / case / closing 对称字段或嵌在 case 上）
durationMs?: number;
audioSrc?: string;   // Workbench 可访问的 URL 或 staticFile 相对路径
cues?: SubtitleCue[]; // 相对该场景起点
```

- 有完整场景 `durationMs` 时：`getDurationInFrames` / `buildTimeline` 用真实时长（可加 200–400ms 尾静音 padding）。
- 缺失时：保留现有 `180 + n*270 + 150` 兜底，保证未合成也能预览版式。

全局整轨 `audioSrc`：合成成功后以分段音频为准；样例预置整轨仅作未合成时的兼容。

### 4. 案例布局：上图下字

- 上区 ~68%：案例图（失败 → 彩色 fallback）
- 下区 ~32%：当前 cue 字幕；可保留小号标题/指标条，不得遮挡主字幕
- 移除图上大 caption 与独立底飘 `subtitleBar` 的双重结构（封面/结尾可用统一下方字幕区）

### 5. Workbench API

- `POST /api/synthesize`  
  - Body: `{ props: WeeklyVideoProps }`（或 `{ markdown }` 服务端再 parse；实现选一种并写进 tasks）  
  - 成功: enriched props + 可选 `synthId`  
  - 失败: 500 + 明确文案（缺 Key、区域错误、单段合成失败）
- 合成文件目录：`.workbench/synth-<id>/`；通过 `/synth/<id>/...` 或拷到可 static 路径供 Player/render 读取
- 现有 `POST /api/render`：接受已 enriched 的 props；渲染工作目录须能解析 `audioSrc`
- UI：按钮「合成语音」→ 成功后更新本地 props 状态 →「生成 MP4」；合成中禁用重复提交

### 6. 依赖与密钥

- npm：`microsoft-cognitiveservices-speech-sdk`
- Env：`AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`、可选 `AZURE_SPEECH_VOICE`
- Docker/Zeabur：同样注入上述变量；不把 Key 写入镜像层

### 7. 实现模块边界

| 模块 | 职责 |
|------|------|
| `tools/azure-tts.mjs` | 单段合成 → wav 字节 + durationMs + cues |
| `tools/workbench-server.mjs` | 路由、编排多段、写盘、托管 |
| `src/videoData.ts` | 类型、normalize、真实 timeline |
| `src/Composition.tsx` | Sequence、上图下字、cue 选择 |
| `tools/workbench-client.jsx` | 合成/渲染 UX |

## Risks / Trade-offs

- **Azure 费用与配额**：每预览点一次合成都会计费 → UI 提示；可后续加缓存（同文案 hash 复用），首版不做强制缓存。
- **网络延迟**：多案例串行合成可能数秒到数十秒 → 状态文案「合成中」；可选并行（注意 SDK 连接限制），首版串行更稳。
- **macOS &lt; 15 无法本地成片**：预览仍可用；渲染走 Docker/Linux（已有 Dockerfile）。
- **中文分词边界**：句级聚合依赖标点；无标点长句可能整段一条 cue → 可接受；二期再用词级高亮。

## Migration Plan

- 无数据库迁移。
- 样例 MD / 预置 `narration.wav` 保留；文档改为推荐「合成语音」路径。
- `.gitignore` 已忽略 `.workbench` / `out`；确认合成产物不入库。

## Open Questions

无阻塞项。审核若要求「服务端只收 markdown 不收 props」或「合成结果磁盘缓存」，可在实现前微调 tasks，不改变本 design 主路径。
