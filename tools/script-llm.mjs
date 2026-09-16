const DEFAULT_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen-plus";

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

  const intro = String(payload.intro ?? "").trim();
  const closing = String(payload.closing ?? "").trim();
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
    const narration = String(entry.narration ?? entry.text ?? "").trim();
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

  return `请把下面的「独立开发变现周刊」结构化内容，改写成适合 TTS 口播的中文逐字稿。

要求：
1. 只输出一个 JSON 对象，不要 Markdown，不要解释。
2. JSON 形状：{"intro":"...","cases":[{"index":"01","narration":"..."},...],"closing":"..."}
3. cases 数量必须为 ${props.cases.length}，index 与输入一致。
4. 口语短句，适合朗读；保留产品名与关键数字；不要 URL、emoji、列表符号。
5. 每个 narration 约 40～80 字，可用「第一条」「接下来」等衔接。

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
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "你是中文口播逐字稿编辑。输出严格 JSON，服务视频旁白与字幕对齐。",
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
