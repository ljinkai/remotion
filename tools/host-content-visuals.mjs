/** Browser-safe, deterministic explanation plans. Every visible phrase is an exact source span. */
const layouts = new Set(["flow", "features", "contrast", "spotlight"]);
const clean = (value) => typeof value === "string" ? value.trim() : "";
const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];
const clauses = (text) => unique(String(text || "").split(/[，。；！？,;!?\n]+/));
const sameCase = (a, b) => Number.isInteger(a?.caseIndex) && a.caseIndex >= 0 && a.caseIndex === b?.caseIndex;
const termSpans = (text) => unique(Array.from(String(text).matchAll(/API[ -]?Key|[A-Za-z][A-Za-z0-9+._/-]*/g), ([match]) => match));
const negative = /\b(?:not|no|never|without|cannot|can[’']t|doesn[’']t|don[’']t|didn[’']t|won[’']t)\b|\brather than\b|不是|并非|而非|而不是|不用|无需|不必|不能|没有|不支持|不提供|不兼容|不需要|不要|无法|从未|避免|别|未必|不一定|不保证|并不|并未/i;
const boundedParts = (parts, source) => {
  if (parts.length <= 4) return parts;
  let cursor = 0;
  let fourth = -1;
  for (let index = 0; index < 4; index++) {
    const position = source.indexOf(parts[index], cursor);
    if (position < 0) return [source];
    if (index === 3) fourth = position;
    cursor = position + parts[index].length;
  }
  return [...parts.slice(0, 3), source.slice(fourth).trim()];
};

export const hasNumericRange = (say) => /\bfrom\s+[$¥￥€]?\s*\d[\d,.]*[^\n,;]{0,30}\bto\s+[$¥￥€]?\s*\d/i.test(String(say || ""));

/** Keep separately disclosed quantities as source phrases, never a shared numeric axis. */
export const sourceMetricItems = (say) => {
  const parts = unique(String(say || "").split(/、|[，。；;\n]|(?<!\d),|,(?!\d)|\s+(?:and|plus)\s+(?=[$¥￥€]?\d|(?:monthly|annual|yearly)\s+(?:revenue|income))/i));
  const facts = parts.filter((part) => /\d/.test(part) && /用户|客户|收入|营收|MRR\b|ARR\b|美元|人民币|元|[$¥￥€%％]|转化|留存|下载|访问|点击|小时|分钟|秒|天|\b(?:users?|customers?|revenue|income|subscriptions?|downloads?|visits?|clicks?|hours?|minutes?|seconds?|days?)\b/i.test(part));
  if (facts.length < 2) return [];
  const labels = facts.map((part, index) => {
    if (index > 0) return part;
    const position = part.search(/[$¥￥€]?\s*\d/);
    const prefix = part.slice(0, position);
    // Remove only a narrative introduction, retaining named metric context before its number.
    const narrative = /^(?:(?:上线|运营|发布)(?:[一二三四五六七八九十\d]+(?:年|个月|月|天))?(?:做到|达到|达成|累计)?|(?:已经|目前|累计)?(?:做到|达到|达成|拥有|获得))\s*$/.test(prefix);
    return position > 0 && narrative
      ? part.slice(position).trim() : part;
  });
  return boundedParts(labels, String(say || "")).map((label) => ({ label }));
};

const contrastParts = (say, previous, next) => {
  const followsContrast = /^(?:but\b|rather than\b|now\b|today\b|而是|而不是|而非|反而|相反|现在|如今)/i;
  const continuesContrast = /^(?:but\b|rather than\b|而是|而不是|而非|反而|相反)/i;
  for (const text of [say, previous && followsContrast.test(say) ? `${previous}\n${say}` : "", next && continuesContrast.test(next) && negative.test(say) ? `${say}\n${next}` : ""]) {
    if (!text) continue;
    if (/\bnot only\b[\s\S]*\bbut also\b/i.test(text)) continue;
    const english = text.match(/([\s\S]+?)(\brather than\b|\bbut(?:\s+rather)?\b)([\s\S]+)/i);
    if (english) return [clean(english[1]).replace(/[,;.]+$/, ""), clean(`${english[2]}${english[3]}`)];
    const englishTime = text.match(/((?:before|previously|in the past)\b[\s\S]+?)(now|today)\b([\s\S]+)/i);
    if (englishTime) return [clean(englishTime[1]).replace(/[,;.]+$/, ""), clean(`${englishTime[2]}${englishTime[3]}`)];
    const explicit = text.match(/([\s\S]+?)(而不是|而非|而是|反而)([\s\S]+)/);
    if (explicit) {
      const left = clean(explicit[1]).replace(/[，,。；;]+$/, "");
      const right = clean(`${explicit[2]}${explicit[3]}`);
      if (left && right && (negative.test(text) || /而是|反而/.test(explicit[2]))) return [left, right];
    }
    const beforeAfter = text.match(/((?:以前|过去|原先)[\s\S]+?)(现在|如今)([\s\S]+)/);
    if (beforeAfter) return [clean(beforeAfter[1]).replace(/[，,。；;]+$/, ""), `${beforeAfter[2]}${beforeAfter[3]}`.trim()];
  }
  return [];
};

const flowParts = (say) => {
  if (negative.test(say)) return [];
  const ordered = /\bfirst(?:ly)?(?:\s|,)[\s\S]*\b(?:then|next|finally)\b|\bthen\b[\s\S]*\bfinally\b|首先|先[^，。]{1,60}(?:再|然后|最后)|然后|接着|最后|→|->/i.test(say);
  const conditional = /\b(?:with|using|enter|provide|upload|input)\b[\s\S]+\b(?:can|then|will|generate|output|publish)\b|(?:只要|输入|导入|上传|提供)[\s\S]+(?:就能|就会|然后|再|→|->)[\s\S]+/i.test(say);
  const inputOutput = /\b(?:input|upload|import|enter)\b[^,;]+[,;]\s*[^,;]{0,24}\b(?:output|generate|export|get)\b[^,;]+|(?:输入|导入|上传)[^，。；,;]+[，,；;]\s*[^，。；,;]{0,16}(?:输出|生成|导出|得到)[^，。；,;]+/i.test(say);
  const fromTo = say.match(/从(.+?)到(.+)/);
  if (fromTo && !/不到|不知道/.test(say)) return [clean(fromTo[1]), clean(fromTo[2])];
  if (!ordered && !conditional && !inputOutput) return [];
  // Preserve contiguous source spans, including sequence markers; no invented operations.
  const split = unique(say.split(/[，。；,;\n]+|\s*(?:→|->)\s*|(?=然后|接着|最后|就能|就会|通过|直接|\bthen\b|\bnext\b|\bfinally\b|\bvia\b|\bthrough\b|\bdirectly\b)/i));
  const parts = [];
  let cursor = 0;
  for (let index = 0; index < split.length; index++) {
    const part = split[index];
    const start = say.indexOf(part, cursor);
    if (/^(?:and|first|firstly|then|next|finally)$/i.test(part) && split[index + 1]) {
      const next = split[++index];
      const end = say.indexOf(next, start + part.length) + next.length;
      parts.push(say.slice(start, end).trim());
      cursor = end;
    } else {
      parts.push(part);
      cursor = start + part.length;
    }
  }
  return parts.length >= 2 ? boundedParts(parts, say) : [];
};

const featureParts = (say) => {
  if (negative.test(say) || /不支持|不提供|不具备|不兼容|无法/.test(say)) return [];
  const englishList = say.match(/\b(?:supports?|includes?|offers?|provides?|integrates? with|compatible with|syncs? to)\s+([\s\S]+)/i);
  if (englishList) {
    const englishParts = unique(englishList[1].split(/,\s*(?:(?:and|or)\s+)?|\s+(?:and|or)\s+/i));
    if (englishParts.length >= 2) return boundedParts(englishParts, say);
  }
  const list = say.match(/(?:支持|提供|包括|具备|兼容|接入|同步到|集成)([\s\S]+)/);
  const enumerable = list?.[1] || say;
  if (!/、|以及|和|与|或/.test(enumerable)) return [];
  const parts = unique(enumerable.split(/、|以及|和|与|或/));
  if (parts.length >= 2 && (list || /功能|能力|接口|工具|平台|代理|开源/.test(say))) return boundedParts(parts, say);
  const terms = termSpans(say);
  if (terms.length >= 2 && /支持|兼容|集成|接入|同步/.test(say)) return boundedParts(terms, say);
  return [];
};

const titleFor = (say, items) => {
  const first = clauses(say)[0] || say;
  if (!/[\u3400-\u9fff]/.test(say) || first.length <= 36) return first;
  return termSpans(say)[0] || items[0]?.label || say;
};

/** Adjacent lines are consulted only for an explicitly linked contrast, never as a case-wide template. */
export const buildContentExplanation = ({ say, previous = "", next = "" }) => {
  const source = clean(say);
  if (!source) return null;
  let layout = "spotlight";
  let parts = contrastParts(source, previous, next);
  if (parts.length) layout = "contrast";
  else {
    parts = flowParts(source);
    if (parts.length) layout = "flow";
    else {
      parts = featureParts(source);
      if (parts.length) layout = "features";
    }
  }
  let items = parts.slice(0, 4).map((label) => ({ label }));
  if (!items.length) {
    const terms = termSpans(source);
    const label = terms.length === 1 && terms[0].length >= 3 ? terms[0] : source;
    items = [{ label, ...(label !== source ? { detail: source } : {}) }];
  }
  return { type: "explanation", layout, title: titleFor(source, items), items };
};

const validatedExplanation = (raw, generated, source, current) => {
  if (!raw || raw.type !== "explanation" || !layouts.has(raw.layout) || !Array.isArray(raw.items)) return null;
  if (!generated || raw.layout !== generated.layout) return null;
  const minimum = raw.layout === "spotlight" ? 1 : 2;
  if (raw.items.length < minimum || raw.items.length > 4) return null;
  const title = clean(raw.title);
  if (!title || !current.includes(title)) return null;
  if (negative.test(current) && /支持|提供|兼容|需要|\b(?:supports?|provides?|compatible|requires?)\b/i.test(title) && !negative.test(title)) return null;
  const items = [];
  let cursor = 0;
  let step = -1;
  for (let index = 0; index < raw.items.length; index++) {
    const item = raw.items[index];
    const label = clean(item?.label);
    const detail = clean(item?.detail);
    if (!label || !source.includes(label) || (detail && !source.includes(detail))) return null;
    if (raw.layout === "flow") {
      const position = source.indexOf(label, cursor);
      if (position < 0) return null;
      cursor = position + label.length;
      const group = generated.items.findIndex((part, groupIndex) => groupIndex > step && part.label.includes(label));
      if (group < 0) return null;
      step = group;
    }
    if (raw.layout === "features" && (!current.includes(label) || (detail && !current.includes(detail)))) return null;
    if (raw.layout === "spotlight" && (!current.includes(label) || (detail && !current.includes(detail)))) return null;
    if (raw.layout === "spotlight" && negative.test(current) && label !== generated.items[index]?.label) return null;
    if (raw.layout === "contrast" && !generated.items[index]?.label.includes(label)) return null;
    if (raw.layout === "contrast" && negative.test(generated.items[index]?.label || "") && !negative.test(label)) return null;
    items.push({ label, ...(detail ? { detail } : {}) });
  }
  return { type: "explanation", layout: raw.layout, title, items };
};

/** Used after fact/image validation for fresh generation, cached preview and server rendering alike. */
export const enrichContentVisuals = (beats, props = {}) => {
  const firstCases = new Set();
  return beats.map((beat, index) => {
    const first = Number.isInteger(beat.caseIndex) && beat.caseIndex >= 0 && !firstCases.has(beat.caseIndex);
    if (Number.isInteger(beat.caseIndex)) firstCases.add(beat.caseIndex);
    const elements = Array.isArray(beat.elements) ? beat.elements : [];
    if (beat.scene === "metric" && hasNumericRange(beat.say) && !elements.some((element) => element.type === "chart")) {
      const visual = buildContentExplanation({ say: beat.say, locale: props.locale });
      return { ...beat, elements: [visual, ...elements.filter((element) => element.type !== "explanation")].slice(0, 4) };
    }
    const metrics = beat.scene === "metric" ? sourceMetricItems(beat.say) : [];
    if (metrics.length >= 2 && !elements.some((element) => element.type === "chart")) {
      const source = clean(beat.say);
      const prefix = source.slice(0, source.search(/[$¥￥€]?\s*\d/)).trim();
      const visual = { type: "explanation", layout: "features", title: prefix || titleFor(source, metrics), items: metrics };
      const images = elements.filter((element) => element.type === "image");
      const rest = elements.filter((element) => element.type !== "image" && element.type !== "explanation");
      return { ...beat, elements: [visual, ...images, ...rest].slice(0, 4) };
    }
    // Keep all existing verified quantitative/relationship semantics and initial full product image.
    if (elements.some((element) => element.type === "chart" || element.type === "relationship") || beat.scene === "metric" || (first && elements.some((element) => element.type === "image"))) {
      return elements.some((element) => element.type === "explanation") ? { ...beat, elements: elements.filter((element) => element.type !== "explanation") } : beat;
    }
    const previous = sameCase(beat, beats[index - 1]) ? clean(beats[index - 1].say) : "";
    const next = sameCase(beat, beats[index + 1]) ? clean(beats[index + 1].say) : "";
    const generated = buildContentExplanation({ say: beat.say, previous, next, locale: props.locale });
    if (!generated) return beat;
    const source = [previous, clean(beat.say), next].filter(Boolean).join("\n");
    const supplied = elements.find((element) => element.type === "explanation");
    const explanation = validatedExplanation(supplied, generated, source, clean(beat.say)) || generated;
    const images = elements.filter((element) => element.type === "image");
    return { ...beat, scene: "statement", elements: [explanation, ...images].slice(0, 4) };
  });
};
