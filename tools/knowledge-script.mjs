import { getScriptLlmConfig } from "./script-llm.mjs";
import { createKnowledgeOutline, validateKnowledgeDocument } from "./knowledge-content.mjs";

export const buildKnowledgePrompt = ({ source, title, locale }) => `${locale === "en" ? "Create a natural English knowledge explainer from the source." : "基于来源材料提炼有价值的中文知识讲解口播。"}
这是独立知识讲解，不是周刊。允许压缩冗余、自然改写、概括新章节标题与重组解释顺序；不要新增事实、数字、疗效或因果，不加周刊开场、关注CTA或固定结尾，不限制200字，不把标题反复塞进口播。
保留相关小鼠/临床前/初步结果/估算/类比等关键限定；不能把初步动物实验说成人体疗效。正文应适合口播，每章可多段换行。sourceNote只逐字引用来源行或原文摘录；sourceRefs可给出原文连续摘录，便于人核对。没有提供的图片不生成地址。
输出JSON：{"chapters":[{"id":"chapter-1","title":"自然概括的章节标题","kind":"concept","narration":"自然口播，多段换行","sourceRefs":["原文连续摘录"],"sourceNote":"可选原文出处"}]}。kind仅concept/case/mechanism/application/limits/summary。文档总标题由用户固定，不重写。
用户标题：${title || ""}
来源：
${source}`;

const chineseNumber = (token) => {
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  let total = 0, group = 0, current = 0;
  for (const char of token) {
    if (char in digits) current = digits[char];
    else if (char === "十" || char === "百" || char === "千") { group += (current || 1) * ({ 十: 10, 百: 100, 千: 1000 }[char]); current = 0; }
    else if (char === "万" || char === "亿") { total += (group + current || 1) * (char === "万" ? 1e4 : 1e8); group = 0; current = 0; }
  }
  return String(total + group + current);
};
const englishValues = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const englishNumber = (phrase) => {
  let total = 0, group = 0;
  for (const word of phrase.toLowerCase().split(/[\s-]+/)) {
    if (word in englishValues) group += englishValues[word];
    else if (word === "hundred") group = (group || 1) * 100;
    else if (["thousand", "million", "billion"].includes(word)) { total += (group || 1) * ({ thousand: 1e3, million: 1e6, billion: 1e9 }[word]); group = 0; }
  }
  return String(total + group);
};
const englishWords = Object.keys(englishValues).concat(["hundred", "thousand", "million", "billion"]).join("|");
const englishNumbers = new RegExp("\\b(?:" + englishWords + ")(?:[\\s-]+(?:and\\s+)?(?:" + englishWords + "))*\\b", "gi");
const numbers = (text) => [
  ...(String(text).replace(/,(?=\d{3}(?:\D|$))/g, "").match(/\d+(?:\.\d+)?/g) || []).map((value) => String(Number(value))),
  ...Array.from(String(text).matchAll(/[零〇一二两三四五六七八九十百千万亿]+(?=个|人|家|年|月|天|倍|%)/g), ([token]) => chineseNumber(token)),
  ...Array.from(String(text).matchAll(englishNumbers), ([token]) => englishNumber(token)),
];
const meaningfulText = (document) => document.chapters.flatMap((chapter) => [chapter.title, chapter.narration]).join("\n");

/** Conservative guardrails for review, not a proof that every generated claim is correct. */
export const checkKnowledgeDraft = (document, source) => {
  const output = meaningfulText(document);
  const visible = [output, ...document.chapters.flatMap((chapter) => [chapter.sourceNote || "", ...(chapter.sourceRefs || [])])].join("\n");
  const allowed = new Set(numbers(source));
  if (numbers(visible).some((value) => !allowed.has(value))) throw new Error("AI 增加了来源之外的数字，原稿未修改，请核对后重试");
  for (const [trigger, retained, label] of [
    [/小鼠|\bmice\b|\bmouse\b/i, /小鼠|\bmice\b|\bmouse\b/i, "小鼠实验"],
    [/临床前|\bpreclinical\b|\bpre-clinical\b/i, /临床前|\bpreclinical\b|\bpre-clinical\b/i, "临床前"],
    [/初步|\bpreliminary\b/i, /初步|早期结果|\bpreliminary\b|\bearly results\b/i, "初步结果"],
    [/估算|估计|\bestimat(?:e|ed|ion)\b/i, /估算|估计|\bestimat(?:e|ed|ion)\b|\bapproximately\b/i, "估算"],
    [/类比|\banalog(?:y|ies)\b/i, /类比|\banalog(?:y|ies)\b/i, "类比"],
  ]) if (trigger.test(source) && !retained.test(output)) throw new Error(`AI 遗漏关键“${label}”限定，原稿未修改`);
  if (/小鼠|临床前|\bmice\b|\bpreclinical\b/i.test(source)) {
    for (const match of visible.matchAll(/已(?:经)?(?:证实|证明).{0,14}(?:人体|人类|疗效)|(?:治愈|有效治疗)患者|临床已验证|clinically proven|effective in humans|cures? patients/gi)) {
      const prefix = visible.slice(Math.max(0, match.index - 30), match.index).split(/[。.!?\n]/).at(-1);
      if (!/不|未|没有|\bnot\b|\bno\b|\bnever\b/i.test(prefix)) throw new Error("AI 增加了未经证实的人体/临床疗效表述，原稿未修改");
    }
  }
  if (/独立开发变现周刊|本期周刊|关注我|下周见|follow me|see you next week/i.test(output) && !/独立开发变现周刊|本期周刊|关注我|下周见|follow me|see you next week/i.test(source)) throw new Error("AI 加入了无关周刊开场或 CTA，原稿未修改");
  for (const chapter of document.chapters) {
    if (chapter.sourceNote && !source.includes(chapter.sourceNote)) throw new Error("AI 来源备注不是原文摘录，原稿未修改");
    if (chapter.sourceRefs?.some((reference) => !source.includes(reference))) throw new Error("AI 引用未能对应原文，原稿未修改");
    if (chapter.image) throw new Error("AI 不能生成未经提供的图片地址，原稿未修改");
  }
};

/** No model call occurs unless the caller explicitly opts in with useAi === true. */
export const organizeKnowledge = async (input, { fetcher = globalThis.fetch, getConfig = getScriptLlmConfig } = {}) => {
  const offline = createKnowledgeOutline(input);
  if (input?.useAi !== true) return { document: offline, method: "offline", reviewRequired: false };
  const config = getConfig();
  const response = await fetcher(`${config.baseUrl}/chat/completions`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, temperature: 0.2, messages: [{ role: "system", content: "Write source-grounded knowledge narration JSON. Keep material limitations and uncertainty. Never add factual claims." }, { role: "user", content: buildKnowledgePrompt(input) }] }),
  });
  if (!response.ok) throw new Error(`知识章节整理失败（HTTP ${response.status}），原稿未修改`);
  const payload = await response.json();
  let result;
  try { result = JSON.parse(String(payload?.choices?.[0]?.message?.content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); } catch { throw new Error("AI 返回格式无效，原稿未修改"); }
  const document = validateKnowledgeDocument({ ...result, title: offline.title, source: input.source, locale: offline.locale });
  checkKnowledgeDraft(document, input.source);
  return { document, method: "ai", reviewRequired: true, notice: offline.locale === "en" ? "AI draft: review facts, sources and qualifications before publishing." : "AI 草稿：发布前请人工核对事实、来源与限定；自动检查不保证全部事实正确。" };
};
