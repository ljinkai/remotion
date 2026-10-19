import { getScriptLlmConfig } from "./script-llm.mjs";
import { finalizeBeats, narrationLines } from "./beat-spec.mjs";

const stripCodeFence = (text) => {
  const trimmed = String(text || "").trim();
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

const caseContext = (props) =>
  (props?.cases || []).map((item, index) => ({
    index,
    title: item.title || "",
    metric: item.metric || "",
    image: item.image || "",
    author: item.author || "",
  }));

export const buildBeatPrompt = (script, props) => {
  const lines = narrationLines(script).map((line, index) => ({
    index,
    section: line.section,
    caseIndex: line.caseIndex,
    say: line.say,
  }));
  return `把逐字稿的每一行变成一条分镜。分镜描述这一句口播时，画面中间那块大约 900×800 的区域里放什么。这块区域要被内容撑满，不能只剩一个小图标。

规则：
- beats 长度必须等于行数，顺序一致。每条 say 必须原样复制该行。
- 元素必须来自这一句在讲的事。同一案例的相邻两句不要重复同一组元素。
- 每条 2 到 4 个元素，而且必须有一个内容块：phone、card、image 或 bar。icon 只能附在内容块旁边，不能单独出现。
- phone、card、text 里的字只能摘自这一句、案例标题或案例指标，不要编造原文没有的功能。
- 这句在讲金额、人数、增长率：用 bar，to 用原文里的数字，再加一条 size 为 xl 的 text 写出同一个数字。host 用 cheer。
- 这句在讲怎么用、发出、打开、订阅、自动完成：用 phone。title 用产品名或动作，body 用这句里的动作，action 用这句里已有的两到四字动词。
- 这句在讲产品样子，且案例有 image：用 image，src 必须是给出的地址，再配一条短 text。
- 这句在讲能力或结论：用 card。title 是这句的关键词，lines 是从这句拆出的 2 到 3 个短语。
- icon 的 name 只能是 chart、phone、coin、user、arrow、check、wave。不要用 wave 表示发推或播报。
- 只有图标画不出这一句时才写 svg。svg 只用 #ff4d1c、#161616、#f4f1ea、#fffcf8。不要 script、外链、foreignObject。
- headline 不超过 18 个字，accent 必须是 headline 的子串。
- 只输出 JSON：{"beats":[{"say":"","headline":"","accent":"","host":"point","elements":[]}]}

反例：elements 只有 {"type":"icon","name":"wave"}。中间会空，而且和口播无关。
正例：口播「主打 AI Agent 发推能力」。
{"say":"主打 AI Agent 发推能力","headline":"AI Agent 自动发推","accent":"AI Agent","host":"point","elements":[{"type":"phone","title":"AI Agent","body":"自动发推","action":"发推"},{"type":"card","title":"发推能力","lines":["主打 AI Agent","自动发推"]}]}

行：
${JSON.stringify(lines, null, 2)}

案例：
${JSON.stringify(caseContext(props), null, 2)}`;
};

const callPlanner = async (config, prompt) => {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "你为口播视频写分镜 JSON。只输出一个 JSON 对象，不要 Markdown。不要编造数字或图片地址。",
        },
        { role: "user", content: prompt },
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

export const planBeats = async (script, props) => {
  if (!script || typeof script !== "object") {
    throw new Error("缺少逐字稿");
  }
  const lines = narrationLines(script);
  if (lines.length === 0) {
    throw new Error("逐字稿没有可生成分镜的句子");
  }
  const config = getScriptLlmConfig();
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await callPlanner(config, buildBeatPrompt(script, props));
      return finalizeBeats(extractJsonObject(content), script, props);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError || "生成分镜失败"));
};
