import { optimizeNarrationForSubtitles } from "./subtitle-lines.mjs";

const cleanNarration = (text) =>
  String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Fixed cover / intro narration (zh). Two lines, used as-is. */
const FIXED_INTRO_NARRATION = [
  "分享最新、有价值的独立开发、产品变现相关内容",
  "关注我，不错过每周参考内容",
].join("\n");

/** Fixed CTA appended after the thematic closing (zh). */
const FIXED_CLOSING_NARRATION = "觉得有用就关注一下，我们下周见！";
const FIXED_CLOSING_NARRATION_EN =
  "If this was useful, follow for more — see you next week.";

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

const PLACEHOLDER_CLOSING =
  "增长不是做更多动作，而是把一个动作做透";

const stripClosingCta = (text) =>
  String(text || "")
    .replaceAll(FIXED_CLOSING_NARRATION, "")
    .replaceAll(FIXED_CLOSING_NARRATION_EN, "")
    .replace(/我们下周见[！!]?/g, "")
    .replace(/see you next week\.?/gi, "")
    .trim();

/** Sample or generic closing, not this issue's own summary. */
export const isPlaceholderClosing = (text) => {
  const plain = stripClosingCta(text).replace(/\s+/g, "");
  if (!plain) {
    return true;
  }
  if (plain.includes(PLACEHOLDER_CLOSING)) {
    return true;
  }
  if (plain.includes("Growthisdoingonethingdeeply")) {
    return true;
  }
  if (/^本期\d+个独立开发精选/.test(plain)) {
    return true;
  }
  return /^\d+indiepicksthisweek/i.test(plain);
};

/** Real 一句话总结 for the prompt. Empty when the issue has none. */
export const scriptClosingInput = (props) => {
  const text = String(
    props?.closingSourceBody || props?.closingSubtitle || "",
  ).trim();
  if (isPlaceholderClosing(text)) {
    return { missing: true, text: "" };
  }
  return { missing: false, text };
};

/** Cover / intro is the fixed copy. Model text is not appended. */
export const prependFixedIntro = (intro, locale = "zh") => {
  if (normalizeLocale(locale) === "en") {
    return String(intro || "").trim();
  }
  return FIXED_INTRO_NARRATION;
};

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

  const introRaw = prependFixedIntro(payload.intro ?? "", locale);
  const intro =
    optimizeNarrationForSubtitles(cleanNarration(introRaw)) || introRaw;
  if (!intro) {
    throw new Error("逐字稿缺少 intro");
  }
  const closingBody = String(payload.closing ?? "").trim();
  if (
    scriptClosingInput(props).missing &&
    isPlaceholderClosing(closingBody)
  ) {
    throw new Error("结尾需要从本期内容提炼一句话总结");
  }
  const closingRaw = appendFixedClosingCta(closingBody, locale);
  const closing =
    optimizeNarrationForSubtitles(cleanNarration(closingRaw)) || closingRaw;
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
      cleanNarration(entry.narration ?? entry.text ?? ""),
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
  const closingInput = scriptClosingInput(props);
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

  return `请把下面的「独立开发变现周刊」改写成中文口播逐字稿。任务是从每个案例原文里提炼最有价值的内容，再用连贯的口语讲出来。

怎么写：
- 只根据这条案例自己的内容来提炼，讲清楚它值得听的地方。
- 用完整句子，保留逗号和句号，读起来是一段话，不要拆成没有标点的短语清单，也不要一行一个词。
- 不要套固定提纲，不要出现「它是什么」「怎么做」「结果如何」「关键数字」「为什么成立」这类栏目名。
- 原文里的步骤、数字、结论，只有在它们就是这条案例的核心时才写进去，用自己的话说，不要为了凑结构另加标签。
- 不要编造原文没有的事实、数据或产品名。不要 URL、emoji、列表符号。英文产品名保持完整。
- 写完核心就停，不要凑字，也不要把核心讲丢。每个案例 narration 不超过 200 个字。不要写关注或下周见，系统会追加：${FIXED_CLOSING_NARRATION}
- ${
  closingInput.missing
    ? "本期没有一句话总结。closing 必须从输入的案例原文里提炼一句特别值得关注的话，对得上某一条案例里的事实，不超过 60 个字。不要写「增长不是做更多动作，而是把一个动作做透」。"
    : "closing 按输入里的一句话总结改成口播，不超过 60 个字，不要改成别的主题。"
}
- intro 固定为封面导语，不要改写，直接输出空字符串。系统会写成：${FIXED_INTRO_NARRATION.replaceAll("\n", " / ")}

输出：
1. 只输出一个 JSON 对象，不要 Markdown，不要解释。
2. 形状：{"intro":"...","cases":[{"index":"01","narration":"..."},...],"closing":"..."}
3. cases 数量必须为 ${props.cases.length}，index 与输入一致，顺序不变。
4. intro、narration、closing 都是连贯段落，不要用换行把句子拆碎。

示例（只示范语气，内容必须来自输入）：
X推出了原创内容奖励计划。创作者发布原创推文、分析或视频，搬运和轻微修改不算。只有付费用户在首页看到的曝光才会计费，每两周结算，满30美元打款。有人首周入账92.18美元。

输入：
${JSON.stringify(
  {
    issueNumber: props.issueNumber,
    theme: props.coverTitle,
    coverBadge: props.coverBadge,
    introShort: props.introSubtitle,
    introMarkdown: props.introSourceBody || props.introSubtitle || "",
    cases,
    closingShort: closingInput.text,
    closingMarkdown: closingInput.text,
    closingMissing: closingInput.missing,
    fixedClosingCta: FIXED_CLOSING_NARRATION,
  },
  null,
  2,
)}`;
};

const buildUserPromptEn = (props) => {
  const closingInput = scriptClosingInput(props);
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

  return `Rewrite this Indie Maker Weekly into spoken English narration. For each case, extract what is actually valuable and say it as a coherent paragraph.

How to write:
- Follow the case itself. Do not use a fixed outline such as what / how / result / numbers / why.
- Use complete sentences with normal punctuation. Do not turn the script into a stack of short fragments.
- Keep a step, number, or conclusion only when it is part of that case's core point. Do not add labels.
- Do not invent facts, names, or figures. No URLs, emoji, or bullets. Keep product names intact.
- Stop when the core point is said. Each case narration ≤ 120 words. Intro ≤ 50 words. Do not write follow/subscribe; the system appends: ${FIXED_CLOSING_NARRATION_EN}
- ${
  closingInput.missing
    ? "This issue has no takeaway. closing must be one sentence drawn from the cases, something especially worth remembering, ≤ 40 words. Do not use a generic growth slogan."
    : "closing rewrites the provided takeaway into speech, ≤ 40 words. Do not change the point."
}

Output:
1. One JSON object only. No Markdown, no commentary.
2. Shape: {"intro":"...","cases":[{"index":"01","narration":"..."},...],"closing":"..."}
3. cases length must be ${props.cases.length}; keep index and order.
4. intro, narration, and closing are paragraphs, not line-broken phrase lists.

Input:
${JSON.stringify(
  {
    issueNumber: props.issueNumber,
    theme: props.coverTitle,
    coverBadge: props.coverBadge,
    introShort: props.introSubtitle,
    introMarkdown: props.introSourceBody || props.introSubtitle || "",
    cases,
    closingShort: closingInput.text,
    closingMarkdown: closingInput.text,
    closingMissing: closingInput.missing,
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
    ? `You write spoken English narration. Output strict JSON. For each case, extract the valuable point from the source and say it in complete sentences. Do not use an outline like what/how/result/numbers/why. Do not invent. Each case ≤ 120 words, intro ≤ 50, closing ≤ 40.`
    : `你是中文口播编辑。输出严格 JSON。从每个案例原文里提炼最有价值的内容，用完整句子连贯讲出来。不要套「是什么、怎么做、结果、数字、为什么成立」这类提纲，也不要拆成没有标点的短句。不要编造。每个案例不超过 200 字。intro 留空，封面导语由系统写成固定文案。如果本期没有一句话总结，closing 从案例里提炼一句特别值得关注的话，不超过 60 字，不要用「增长不是做更多动作，而是把一个动作做透」。`;

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
