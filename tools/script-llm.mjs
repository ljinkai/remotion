import {
  MAX_SUBTITLE_CHARS,
  optimizeNarrationForSubtitles,
} from "./subtitle-lines.mjs";

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

const normalizeScriptPayload = (payload, props) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("逐字稿 JSON 结构无效");
  }

  const intro = optimizeNarrationForSubtitles(payload.intro ?? "");
  const closing = optimizeNarrationForSubtitles(payload.closing ?? "");
  if (!intro || !closing) {
    throw new Error("逐字稿缺少 intro 或 closing");
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

const buildUserPrompt = (props) => {
  const cases = props.cases.map((item, index) => ({
    index: item.index,
    order: index + 1,
    title: item.title,
    author: item.author,
    date: item.date,
    metric: item.metric,
    shortDraft: item.subtitle,
    /** 原始 MD 正文 —— 逐字稿必须据此充分改写，不能只写两三句 */
    markdownBody: item.sourceBody || item.subtitle || "",
  }));

  return `请把下面的「独立开发变现周刊」**原始 Markdown 内容**改写成适合「上图下字幕」视频的中文口播逐字稿。

核心原则：
- 逐字稿必须**覆盖 markdownBody / introMarkdown / closingMarkdown 里的主要信息与观点**，不能只摘要成两三句。
- 在保留原意的前提下口语化改写；不要编造 MD 中没有的事实、数据或产品名。
- 短句分行上屏，但内容要写够。

要求：
1. 只输出一个 JSON 对象，不要 Markdown，不要解释。
2. JSON 形状：{"intro":"...","cases":[{"index":"01","narration":"..."},...],"closing":"..."}
3. cases 数量必须为 ${props.cases.length}，index 与输入一致。
4. 口语短句；保留产品名与关键数字；不要 URL、emoji、列表符号。
5. 【字幕格式】每一行 ≤${MAX_SUBTITLE_CHARS} 个汉字；遇到逗号、句号、顿号、分号都拆成新行；行内不要出现，。！？、；：。
6. narration / intro / closing 内部用换行分隔每一行字幕。
7. 「第一条」「接下来」等短衔接可与下一短句同一行，中间用空格。
8. 【篇幅】每个案例 narration 至少 8 行、建议 10～16 行；intro 至少 4 行；closing 至少 4 行。把 markdownBody 里的要点拆成多行口播，不要过度压缩。
9. 正确示例（注意：只是格式示例，真实内容要以输入的 markdownBody 为准写满）：
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
  },
  null,
  2,
)}`;
};

const callChatCompletions = async ({ apiKey, baseUrl, model }, props) => {
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
        {
          role: "system",
          content: `你是中文口播与字幕编辑。输出严格 JSON。必须依据输入里的 markdownBody / introMarkdown / closingMarkdown 充分改写，覆盖原文要点，禁止只写极短摘要。每个字段用换行分成多行短字幕；行内不要写逗号或句号；每行不超过 ${MAX_SUBTITLE_CHARS} 个汉字；每个案例至少 8 行。`,
        },
        {
          role: "user",
          content: buildUserPrompt(props),
        },
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
  let enriched = props;

  // If caller sends raw Markdown, re-parse so LLM gets full section bodies.
  const markdown =
    typeof options.markdown === "string" ? options.markdown.trim() : "";
  if (markdown) {
    try {
      const { loadMarkdownRuntime } = await import("./markdown-runtime.mjs");
      const root = options.root || process.cwd();
      const runtime = await loadMarkdownRuntime(root);
      const fromMd = runtime.parseMarkdownToVideo(markdown);
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
      const content = await callChatCompletions(config, enriched);
      const payload = extractJsonObject(content);
      return normalizeScriptPayload(payload, enriched);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || "生成逐字稿失败"));
};
