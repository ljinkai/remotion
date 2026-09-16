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
    metric: item.metric,
    draft: item.subtitle,
  }));

  return `请把下面的「独立开发变现周刊」结构化内容，改写成适合「上图下字幕」视频的中文口播逐字稿。

要求：
1. 只输出一个 JSON 对象，不要 Markdown，不要解释。
2. JSON 形状：{"intro":"...","cases":[{"index":"01","narration":"..."},...],"closing":"..."}
3. cases 数量必须为 ${props.cases.length}，index 与输入一致。
4. 口语短句，适合朗读与屏幕字幕；保留产品名与关键数字；不要 URL、emoji、列表符号。
5. 【字幕硬性约束】每一行字幕（以。！？结尾）必须 ≤${MAX_SUBTITLE_CHARS} 个汉字，尽量 8～${MAX_SUBTITLE_CHARS} 字。超长意思必须拆成多行。
6. narration 内部用换行分隔每一行字幕；行与行之间不要粘成一大段。
7. 「第一条」「接下来」等短衔接可与下一短句同一行，中间用空格：例如「第一条 小众产品重启记。」
8. 两个都很短的动作句可用逗号合成一行：例如「用时仅三个月，重新激活老用户。」
9. 每个场景 3～6 行字幕，总字数约 40～80。
   正确示例：
   第一条 小众产品重启记。
   作者是@farrux_hewson。
   用时仅三个月，重新激活老用户。
   实现稳定变现。
   错误示例：「第一条。小众产品重启记。作者是@farrux_hewson。用时仅三个月。重新激活老用户。实现稳定变现。」粘成一行长串。
10. 不要 URL、emoji、列表符号。

输入：
${JSON.stringify(
  {
    issueNumber: props.issueNumber,
    theme: props.coverTitle,
    coverBadge: props.coverBadge,
    introDraft: props.introSubtitle,
    cases,
    closingDraft: props.closingSubtitle,
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
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: `你是中文口播与字幕编辑。输出严格 JSON。每个 narration 用换行分成多行短字幕，每行不超过 ${MAX_SUBTITLE_CHARS} 个汉字。禁止超长单行。`,
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

export const generateNarrationScript = async (props) => {
  const config = getScriptLlmConfig();
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await callChatCompletions(config, props);
      const payload = extractJsonObject(content);
      return normalizeScriptPayload(payload, props);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || "生成逐字稿失败"));
};
