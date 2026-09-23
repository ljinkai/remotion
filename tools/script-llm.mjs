import {
  MAX_SUBTITLE_CHARS,
  optimizeNarrationForSubtitles,
} from "./subtitle-lines.mjs";

/** Fixed CTA appended after the thematic closing (zh). */
const FIXED_CLOSING_NARRATION = "觉得有用就关注一下，我们下周见！";
const FIXED_CLOSING_NARRATION_EN =
  "If this was useful, follow for more — see you next week.";

const MAX_SUBTITLE_CHARS_EN = 42;

const normalizeLocale = (locale) =>
  String(locale || "")
    .trim()
    .toLowerCase() === "en"
    ? "en"
    : "zh";

const fixedCta = (locale) =>
  normalizeLocale(locale) === "en"
    ? FIXED_CLOSING_NARRATION_EN
    : FIXED_CLOSING_NARRATION;

const appendFixedClosingCta = (closing, locale = "zh") => {
  const base = String(closing || "").trim();
  const cta = fixedCta(locale);
  if (!base) {
    return cta;
  }
  if (
    base.includes(FIXED_CLOSING_NARRATION) ||
    base.includes(FIXED_CLOSING_NARRATION_EN) ||
    base.includes("我们下周见") ||
    /see you next week/i.test(base)
  ) {
    return base;
  }
  return `${base}\n${cta}`;
};

const DEFAULT_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen-plus";

export { optimizeNarrationForSubtitles } from "./subtitle-lines.mjs";

export const getScriptLlmConfig = () => {
  const apiKey =
    process.env.SCRIPT_LLM_API_KEY?.trim() ||
    process.env.QWEN_API_KEY?.trim() ||
    "";
  if (!apiKey) {
    throw new Error(
      "缺少 SCRIPT_LLM_API_KEY 或 QWEN_API_KEY（通义千问 DashScope API Key）",
    );
  }
  const baseUrl = (
    process.env.SCRIPT_LLM_BASE_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/$/, "");
  const model = process.env.SCRIPT_LLM_MODEL?.trim() || DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
};

const stripCodeFence = (text) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const extractJsonObject = (text) => {
  const cleaned = stripCodeFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("模型返回的不是合法 JSON");
  }
};

const normalizeScriptPayload = (payload, props, locale = "zh") => {
  if (!payload || typeof payload !== "object") {
    throw new Error("逐字稿 JSON 结构无效");
  }

  const intro = optimizeNarrationForSubtitles(payload.intro ?? "");
  if (!intro) {
    throw new Error("逐字稿缺少 intro");
  }
  const closingRaw = appendFixedClosingCta(payload.closing ?? "", locale);
  const closing = optimizeNarrationForSubtitles(closingRaw) || closingRaw;
  if (!closing) {
    throw new Error("逐字稿缺少 closing");
  }

  const rawCases = Array.isArray(payload.cases) ? payload.cases : [];
  if (rawCases.length !== props.cases.length) {
    throw new Error(
      `逐字稿案例数 ${rawCases.length} 与周刊案例数 ${props.cases.length} 不一致`,
    );
  }

  const cases = props.cases.map((item, index) => {
    const entry = rawCases[index] ?? {};
    const narration = optimizeNarrationForSubtitles(
      entry.narration ?? entry.text ?? "",
    );
    if (!narration) {
      throw new Error(`逐字稿案例 ${item.index} 旁白为空`);
    }
    return {
      index: item.index,
      title: item.title,
      narration,
    };
  });

  return {
    intro,
    cases,
    closing,
    source: "ai",
  };
};

const buildUserPromptZh = (props) => {
  const cases = props.cases.map((item, index) => ({
    index: item.index,
    order: index + 1,
    title: item.title,
    author: item.author,
    date: item.date,
    metric: item.metric,
    shortDraft: item.subtitle,
    markdownBody: item.sourceBody || item.subtitle || "",
  }));

  return `请把下面的「独立开发变现周刊」**原始 Markdown 内容**改写成适合「上图下字幕」视频的中文口播逐字稿。

核心原则：
- 逐字稿必须**覆盖 markdownBody / introMarkdown / closingMarkdown 里的主要信息与观点**，不能只摘要成两三句。
- 在保留原意的前提下口语化改写；不要编造 MD 中没有的事实、数据或产品名。
- 短句分行上屏，但内容要写够。
- closing 先写本期「一句话总结」的观点总结；系统会再自动追加固定结束语：${FIXED_CLOSING_NARRATION}

要求：
1. 只输出一个 JSON 对象，不要 Markdown，不要解释。
2. JSON 形状：{"intro":"...","cases":[{"index":"01","narration":"..."},...],"closing":"..."}
3. cases 数量必须为 ${props.cases.length}，index 与输入一致。
4. 口语短句；保留产品名与关键数字；不要 URL、emoji、列表符号。
5. 【字幕格式】每一行 ≤${MAX_SUBTITLE_CHARS} 个汉字；遇到逗号、句号、顿号、分号都拆成新行；行内不要出现，。！？、；：。
6. 【英文完整性】Instagram、Reachlee、indie hacker 等英文品牌名/词组必须完整保留在同一行，禁止拆成 Ins/tagram 或 indie/hacker。
7. narration / intro / closing 内部用换行分隔每一行字幕。
8. 「第一条」「接下来」等短衔接可与下一短句同一行，中间用空格。
9. 【篇幅】每个案例 narration 至少 8 行、建议 10～16 行；intro 至少 4 行；closing 写 2～4 行本期总结即可（不要写关注/下周见，系统会追加）。把 markdownBody 里的要点拆成多行口播，不要过度压缩。
10. 正确示例（注意：只是格式示例，真实内容要以输入的 markdownBody 为准写满）：
   第一条 小众产品重启记
   作者是@farrux_hewson
   用时仅三个月
   重新激活老用户
   实现稳定变现
   （后面还应继续写 markdownBody 里的其他要点……）

输入：
${JSON.stringify(
  {
    issueNumber: props.issueNumber,
    theme: props.coverTitle,
    coverBadge: props.coverBadge,
    introShort: props.introSubtitle,
    introMarkdown: props.introSourceBody || props.introSubtitle || "",
    cases,
    closingShort: props.closingSubtitle,
    closingMarkdown: props.closingSourceBody || props.closingSubtitle || "",
    fixedClosingCta: FIXED_CLOSING_NARRATION,
  },
  null,
  2,
)}`;
};

const buildUserPromptEn = (props) => {
  const cases = props.cases.map((item, index) => ({
    index: item.index,
    order: index + 1,
    title: item.title,
    author: item.author,
    date: item.date,
    metric: item.metric,
    shortDraft: item.subtitle,
    markdownBody: item.sourceBody || item.subtitle || "",
  }));

  return `Rewrite the following Indie Maker Weekly Markdown into spoken English narration for an image-above / subtitle-below video.

Core rules:
- Cover the main points in markdownBody / introMarkdown / closingMarkdown — do not compress to 2–3 sentences.
- Keep facts, product names, and numbers; do not invent.
- Short lines for on-screen subtitles; still write enough content.
- closing: thematic takeaway only; the system appends this fixed CTA: ${FIXED_CLOSING_NARRATION_EN}

Requirements:
1. Output one JSON object only — no Markdown fences, no commentary.
2. Shape: {"intro":"...","cases":[{"index":"01","narration":"..."},...],"closing":"..."}
3. cases length must be ${props.cases.length}; keep the same index values.
4. Conversational English; no URLs, emoji, or bullet symbols.
5. Subtitles: each line ≤${MAX_SUBTITLE_CHARS_EN} characters; split on commas/periods; no punctuation inside a line.
6. Use newlines inside intro / narration / closing for each subtitle line.
7. Short bridges like "First up" may share a line with the next clause (space-separated).
8. Length: each case narration ≥8 lines (aim 10–16); intro ≥4 lines; closing 2–4 lines of takeaway only (do not write follow/subscribe — system appends CTA).
9. Format example only (real content must follow markdownBody):
   First up Cool App
   by @handle
   Hit 1k stars in three months
   Reactivated dormant users
   Steady monetization

Input:
${JSON.stringify(
  {
    issueNumber: props.issueNumber,
    theme: props.coverTitle,
    coverBadge: props.coverBadge,
    introShort: props.introSubtitle,
    introMarkdown: props.introSourceBody || props.introSubtitle || "",
    cases,
    closingShort: props.closingSubtitle,
    closingMarkdown: props.closingSourceBody || props.closingSubtitle || "",
    fixedClosingCta: FIXED_CLOSING_NARRATION_EN,
  },
  null,
  2,
)}`;
};

const buildUserPrompt = (props, locale = "zh") =>
  normalizeLocale(locale) === "en"
    ? buildUserPromptEn(props)
    : buildUserPromptZh(props);

const callChatCompletions = async (
  { apiKey, baseUrl, model },
  props,
  locale = "zh",
) => {
  const isEn = normalizeLocale(locale) === "en";
  const system = isEn
    ? `You write English spoken narration and subtitles. Output strict JSON. Expand from markdownBody / introMarkdown / closingMarkdown — never ultra-short summaries. Split each field into short subtitle lines (≤${MAX_SUBTITLE_CHARS_EN} chars); no commas or periods inside a line; ≥8 lines per case. Keep English brand names and phrases (e.g. Instagram, indie hacker) intact on one line — never split mid-word.`
    : `你是中文口播与字幕编辑。输出严格 JSON。必须依据输入里的 markdownBody / introMarkdown / closingMarkdown 充分改写，覆盖原文要点，禁止只写极短摘要。每个字段用换行分成多行短字幕；行内不要写逗号或句号；每行不超过 ${MAX_SUBTITLE_CHARS} 个汉字；每个案例至少 8 行。英文品牌名与词组（如 Instagram、indie hacker）必须完整留在同一行，禁止中途拆词。`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      messages: [
        { role: "system", content: system },
        { role: "user", content: buildUserPrompt(props, locale) },
      ],
    }),
  });

  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error(
      `千问接口返回非 JSON（HTTP ${response.status}）：${bodyText.slice(0, 400)}`,
    );
  }

  if (!response.ok) {
    const message =
      body?.error?.message || body?.message || bodyText.slice(0, 400);
    throw new Error(`千问接口失败（HTTP ${response.status}）：${message}`);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("千问接口未返回 message.content");
  }

  return content;
};

export const generateNarrationScript = async (props, options = {}) => {
  const config = getScriptLlmConfig();
  const locale = normalizeLocale(options.locale);
  let enriched = props;

  const markdown =
    typeof options.markdown === "string" ? options.markdown.trim() : "";
  if (markdown) {
    try {
      const { loadMarkdownRuntime } = await import("./markdown-runtime.mjs");
      const root = options.root || process.cwd();
      const runtime = await loadMarkdownRuntime(root);
      const fromMd = runtime.parseMarkdownToVideo(markdown, { locale });
      enriched = {
        ...props,
        introSourceBody:
          fromMd.introSourceBody || props.introSourceBody || props.introSubtitle,
        closingSourceBody:
          fromMd.closingSourceBody ||
          props.closingSourceBody ||
          props.closingSubtitle,
        cases: (props.cases || []).map((item, index) => {
          const mdCase = fromMd.cases?.[index];
          return {
            ...item,
            sourceBody:
              mdCase?.sourceBody || item.sourceBody || item.subtitle || "",
          };
        }),
      };
    } catch {
      enriched = props;
    }
  }

  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await callChatCompletions(config, enriched, locale);
      const payload = extractJsonObject(content);
      return normalizeScriptPayload(payload, enriched, locale);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || "生成逐字稿失败"));
};
