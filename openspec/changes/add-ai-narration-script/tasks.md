## 1. 数据与解析

- [x] 1.1 MD 支持 `旁白` / `narration` 字段写入 `intro` / case / closing 旁白（有则优先于第一句）
- [x] 1.2 定义 `NarrationScript` 类型与「script → props 旁白字段」应用函数
- [x] 1.3 改 MD 时清空 script + synthesized 状态（客户端）

## 2. LLM 脚本生成

- [x] 2.1 新建 `tools/script-llm.mjs`：DashScope/千问 OpenAI 兼容 Chat Completions，严格 JSON 输出
- [x] 2.2 Env：`SCRIPT_LLM_API_KEY`（回退 `QWEN_API_KEY`）；默认 `SCRIPT_LLM_BASE_URL`=DashScope intl compatible-mode；默认 `SCRIPT_LLM_MODEL`=`qwen-plus`
- [x] 2.3 `POST /api/script`：校验案例数、解析失败重试一次、错误信息可读
- [x] 2.4 全部场景已有 MD 旁白时支持 `source: markdown` 不调 LLM（或提供 skip 路径）

## 3. Workbench UI

- [x] 3.1 「生成逐字稿」按钮 + 按场景可编辑旁白区
- [x] 3.2 合成前把编辑后的 script 写回 props；引导先出稿
- [x] 3.3 与现有字幕时间轴、合成语音、渲 MP4 串联

## 4. 文档与验收

- [x] 4.1 更新 `.env.example` 与 README
- [x] 4.2 `openspec validate add-ai-narration-script --strict`
- [ ] 4.3 人工：MD → 生成逐字稿 → 改一句 → 合成 → 时间轴/预览与改稿一致
