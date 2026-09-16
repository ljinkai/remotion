# Design: add-ai-narration-script

## Context

已落地 Azure TTS + 句级 cues + 字幕时间轴。旁白仍来自 `introSubtitle` / `cases[].subtitle` / `closingSubtitle`，多数由 MD 第一句或短副标题填充，不适合直接口播。

用户确认：**A — AI 改写成可编辑口播逐字稿**；字幕默认 **句级**（非字级卡拉 OK）。

## Goals / Non-Goals

- Goals:
  - Workbench：MD → AI 逐字稿 → 可编辑 → TTS → 预览/渲染
  - 场景级旁白结构稳定，便于分段合成与时间轴
  - 若 MD 已有明确旁白字段，可优先使用并允许「跳过 AI / 仅刷新未填场景」
- Non-Goals:
  - 字级高亮 / 卡拉 OK
  - 接入 vidflow 内容库或共用其 AI provider 配置
  - 自动生成或改写案例图片
  - 多语言脚本

## Decisions

### 1. 流水线插入「脚本」阶段

```text
Markdown（周刊结构）
  → parseMarkdownToVideo（画面元数据：图、标题、指标…）
  → POST /api/script（AI）→ NarrationScript
  → 用户编辑
  → 写回 props 的旁白字段（introSubtitle / case.subtitle / closingSubtitle）
  → POST /api/synthesize（已有 Azure TTS）
  → Player / render
```

画面布局仍由周刊 MD 驱动；**只有口播文本**来自逐字稿。

### 2. 逐字稿数据模型

```ts
type NarrationScript = {
  intro: string;
  cases: { index: string; title: string; narration: string }[];
  closing: string;
  source: "ai" | "manual" | "markdown";
};
```

应用到 props 时：

| Script | Props |
|--------|--------|
| `intro` | `introSubtitle` |
| `cases[i].narration` | `cases[i].subtitle` |
| `closing` | `closingSubtitle` |

保留用 `subtitle` 字段承载口播，避免再拆一套合成路径；UI 上展示为「逐字稿 / 旁白」。

可选：支持从 MD 读取 `旁白：` / `narration:` 字段（与现有 field 解析一致）；有值则作为 script 初值，`source: "markdown"`。

### 3. LLM：默认通义千问（DashScope OpenAI 兼容）

- **Decision**：服务端 `fetch` Chat Completions；**默认提供商为千问**，走 DashScope 兼容模式，与 vidflow 的 Qwen 配置习惯对齐。
- Env：
  - `SCRIPT_LLM_API_KEY`（必填；也可回退读 `QWEN_API_KEY`，便于与 vidflow 共用同一密钥）
  - `SCRIPT_LLM_BASE_URL`（默认 `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`；国内账号可改为 `https://dashscope.aliyuncs.com/compatible-mode/v1`）
  - `SCRIPT_LLM_MODEL`（默认 `qwen-plus`；可改为 `qwen-turbo` / `qwen-max` 等）
- **Why**：中文口播质量好；团队已有千问密钥；兼容协议仍允许日后换端点。
- **Alternatives**：默认 OpenAI（拒绝，用户指定千问）；只调 vidflow HTTP（耦合过重）。

Prompt 约束（实现写入 system/user）：

- 中文口播，短句，适合 TTS；避免 Markdown/列表/URL/emoji
- 按场景输出 **严格 JSON**（intro / cases[] / closing），案例数与输入一致
- 保留产品名与关键数字；可口语化衔接（「第一条」「接下来」）
- 单场景旁白建议长度上限（如 40–80 字可配置），避免过长
- 要求模型只输出 JSON（可用 response_format / 强提示，视千问模型能力启用）

解析失败：返回 502 + 原文片段，不静默塞空字符串。

### 4. Workbench UX

1. 编辑周刊 MD（现有）
2. **生成逐字稿** → 右侧或下方出现可编辑文本区（按场景分块）
3. 可改后点 **合成语音**（无逐字稿时提示先生成；允许高级用户仍用 MD 短句硬合成，但默认引导先出稿）
4. 字幕时间轴继续展示合成后的 cues

编辑 MD 后应 **作废** 旧逐字稿与旧合成音频（与现逻辑一致：改 MD 清空 synthesized props；同时清空 script 状态）。

### 5. API

`POST /api/script`

- Body: `{ markdown: string }` 或 `{ props: WeeklyVideoProps }`
- Response: `{ script: NarrationScript }`
- 缺 API Key（`SCRIPT_LLM_API_KEY` 与 `QWEN_API_KEY` 皆空）：明确错误（与 Azure Speech 缺 Key 同风格）

合成仍走 `/api/synthesize`，body 带已写入旁白的 props。

### 6. 与现有 Azure TTS 关系

- 不改 TTS/WordBoundary 主路径
- AI 只负责文案质量；时间对齐仍靠 Azure
- 句级字幕 = 逐字稿分句后的语音边界（稿写得好，字幕才像「逐字稿成片」）

## Risks / Trade-offs

- LLM 费用与不稳定 JSON → 强校验 + 一次重试；失败可编辑后手改再合成
- 模型改写偏离事实 → Prompt 强调保留指标/产品名；UI 可对照原 MD
- 两套密钥（Azure Speech + 千问）→ README / `.env.example` 分开写清；`QWEN_API_KEY` 可与 vidflow 共用

## Migration Plan

- 无 DB
- `.env.example` 增加 LLM 三项
- 旧流程（不点生成逐字稿直接合成）仍可用短句旁白，作为降级

## Open Questions

无阻塞。默认字幕句级；若后续要字级高亮，另开 change。
