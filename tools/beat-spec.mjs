import { enrichContentVisuals, sourceMetricItems } from "./host-content-visuals.mjs";

const ICON_NAMES = new Set([
  "chart",
  "phone",
  "coin",
  "user",
  "arrow",
  "check",
  "wave",
]);

const TEXT_SIZES = new Set(["m", "l", "xl"]);

const SVG_TAGS = new Set([
  "svg",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

const SVG_ATTRS = new Set([
  "d",
  "points",
  "x",
  "y",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "fill",
  "stroke",
  "stroke-width",
  "viewbox",
]);

const BEAT_MS = 4000;

export const narrationLines = (script) => {
  const lines = [];
  const push = (section, caseIndex, text) => {
    for (const row of String(text || "").split("\n")) {
      const say = row.trim();
      if (say) {
        lines.push({ section, caseIndex, say });
      }
    }
  };
  push("intro", null, script?.intro);
  const cases = Array.isArray(script?.cases) ? script.cases : [];
  cases.forEach((item, index) => {
    push("case", index, item?.narration);
  });
  push("closing", null, script?.closing);
  return lines;
};

export const allowedImageSrcs = (props) => {
  const srcs = new Set();
  for (const item of props?.cases || []) {
    const src = String(item?.image || "").trim();
    if (src) {
      srcs.add(src);
    }
  }
  return srcs;
};

const finiteNumber = (value) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};

const cleanText = (value, max) => String(value || "").trim().slice(0, max);

export const sanitizeSvg = (markup) => {
  const source = String(markup || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  return source.replace(/<\/?([a-zA-Z0-9:-]+)([^>]*)>/g, (full, tag, attrs) => {
    const name = tag.toLowerCase();
    if (!SVG_TAGS.has(name)) {
      return "";
    }
    if (full.startsWith("</")) {
      return `</${name}>`;
    }
    const kept = [];
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let match = attrRe.exec(attrs);
    while (match) {
      const key = match[1].toLowerCase();
      const value = match[3] ?? match[4] ?? "";
      if (
        SVG_ATTRS.has(key) &&
        !/url\s*\(|javascript:|href/i.test(value)
      ) {
        kept.push(`${key}="${value.replace(/"/g, "")}"`);
      }
      match = attrRe.exec(attrs);
    }
    if (name !== "svg" && /\/>\s*$/.test(full)) {
      return `<${name}${kept.length ? ` ${kept.join(" ")}` : ""} />`;
    }
    return `<${name}${kept.length ? ` ${kept.join(" ")}` : ""}>`;
  }).trim();
};

const normalizeElement = (raw, images) => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const type = String(raw.type || "");
  if (type === "text") {
    const text = cleanText(raw.text, 48);
    if (!text) {
      return null;
    }
    return {
      type: "text",
      text,
      size: TEXT_SIZES.has(raw.size) ? raw.size : "l",
    };
  }
  if (type === "bar") {
    const to = finiteNumber(raw.to);
    if (to === null) {
      return null;
    }
    const max = finiteNumber(raw.max);
    return {
      type: "bar",
      label: cleanText(raw.label, 12) || "数值",
      to,
      ...(max !== null ? { max } : {}),
      ...(cleanText(raw.note, 24) ? { note: cleanText(raw.note, 24) } : {}),
    };
  }
  if (type === "image") {
    const src = String(raw.src || "").trim();
    if (!src || !images.has(src)) {
      return null;
    }
    return {
      type: "image",
      src,
      ...(cleanText(raw.caption, 24) ? { caption: cleanText(raw.caption, 24) } : {}),
    };
  }
  if (type === "phone") {
    const title = cleanText(raw.title, 16);
    const body = cleanText(raw.body, 24);
    if (!title && !body) {
      return null;
    }
    return {
      type: "phone",
      title: title || "产品",
      body: body || title,
      ...(cleanText(raw.action, 8) ? { action: cleanText(raw.action, 8) } : {}),
    };
  }
  if (type === "card") {
    const title = cleanText(raw.title, 16);
    if (!title) {
      return null;
    }
    const lines = Array.isArray(raw.lines)
      ? raw.lines.map((line) => cleanText(line, 24)).filter(Boolean).slice(0, 4)
      : [];
    const bars = Array.isArray(raw.bars)
      ? raw.bars.map(finiteNumber).filter((value) => value !== null).slice(0, 8)
      : [];
    return {
      type: "card",
      title,
      ...(lines.length ? { lines } : {}),
      ...(bars.length ? { bars } : {}),
    };
  }
  if (type === "icon") {
    const name = String(raw.name || "").trim();
    if (!ICON_NAMES.has(name)) {
      return null;
    }
    return { type: "icon", name };
  }
  if (type === "svg") {
    const markup = sanitizeSvg(raw.markup);
    if (!markup || !markup.includes("<")) {
      return null;
    }
    return { type: "svg", markup };
  }
  return null;
};

const textFallback = (line, headline) => ({
  type: "text",
  text: cleanText(headline || line.say, 48) || line.say.slice(0, 48),
  size: "l",
});

const SCENES = new Set(["product", "metric", "steps", "statement", "relationship"]);

// Consume the full multiplier, unit and accounting period; never turn "$5k MRR" into "$5".
const sourceMetrics = (text) => Array.from(String(text || "").matchAll(
  /(?:[$¥￥€]\s*)?\d[\d,]*(?:\.\d+)?\s*(?:万|千|亿|[kmb](?![a-z]))?\+?\s*(?:美元|人民币|元|%|％|个用户|位用户|用户|个月|个人|小时|分钟|人|次|份|家|个|秒|天|月|年)?\s*(?:MRR\b|ARR\b|\/(?:month|year|mo|yr)\b)?/gi,
)).flatMap(([match]) => {
  const token = match.trim();
  if (!/[$¥￥€万千亿%％]|美元|人民币|元|用户|人|次|份|家|个|小时|分钟|秒|天|月|年|MRR|ARR|[kmb](?![a-z])/i.test(token)) return [];
  const number = Number(token.match(/\d[\d,]*(?:\.\d+)?/)[0].replace(/,/g, ""));
  const multiplier = token.match(/\d[\d,]*(?:\.\d+)?\s*(万|千|亿|[kmb](?![a-z]))/i)?.[1]?.toLowerCase();
  const scale = { 亿: 1e8, 万: 1e4, 千: 1e3, k: 1e3, m: 1e6, b: 1e9 }[multiplier] || 1;
  return [{ token, value: number * scale, rawValue: number }];
});

const normalizeFocus = (raw) => {
  if (!raw || ![raw.x, raw.y, raw.width, raw.height].every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  if (raw.x < 0 || raw.y < 0 || raw.width <= 0 || raw.height <= 0 || raw.x + raw.width > 1 || raw.y + raw.height > 1) return null;
  return { x: raw.x, y: raw.y, width: raw.width, height: raw.height, ...(raw.label ? { label: cleanText(raw.label, 60) } : {}) };
};

const metricDimensions = (text) => {
  const value = String(text || "");
  const currencies = [];
  if (/美元|USD|US\$|\$/i.test(value)) currencies.push("USD");
  if (/人民币|CNY|RMB|[¥￥]|(?<![美欧])元/i.test(value)) currencies.push("CNY");
  if (/欧元|EUR|€/i.test(value)) currencies.push("EUR");
  const dimensions = currencies.length ? currencies : /用户/.test(value) ? ["users"]
    : /%|％|百分比/.test(value) ? ["percent"] : /人数|人(?!民)/.test(value) ? ["people"]
      : /次数|次/.test(value) ? ["count"] : /份/.test(value) ? ["copies"] : [];
  const periods = [];
  if (/MRR|月收入|月营收|每月|月活|月度|\/(?:月|month\b|mo\b)/i.test(value)) periods.push("month");
  if (/ARR|年收入|年营收|每年|年活|年度|\/(?:年|year\b|yr\b)/i.test(value)) periods.push("year");
  if (/每天|日活|日度|\/(?:天|日|day\b)/i.test(value)) periods.push("day");
  return { dimension: [...new Set(dimensions)], period: [...new Set(periods)] };
};

const textChart = (raw, evidence) => {
  if (!raw || raw.type !== "chart" || !["single", "comparison", "milestones"].includes(raw.chartType) || !Array.isArray(raw.data) || !raw.data.length || raw.data.length > 8) return null;
  if (raw.chartType === "single" && raw.data.length !== 1) return null;
  // Multiple data points need named source entities/stages, never an invented timeline.
  if (raw.chartType === "comparison" && !/相比|对比|分别|vs\b|versus/i.test(evidence)) return null;
  if (raw.chartType === "milestones" && !/阶段|随后|然后|→|\d{4}年/.test(evidence)) return null;
  const unit = cleanText(raw.unit, 60);
  if (!unit || !evidence.includes(unit)) return null;
  const chartDimensions = metricDimensions(unit);
  if (chartDimensions.dimension.length !== 1 || chartDimensions.period.length > 1) return null;
  const facts = sourceMetrics(evidence);
  const data = [];
  const pointPeriods = new Set();
  for (const point of raw.data) {
    if (!point || typeof point.value !== "number" || !Number.isFinite(point.value) || point.value < 0) return null;
    const label = cleanText(point.label, 60);
    const display = cleanText(point.display, 80);
    if (!label || !evidence.includes(label) || !display || !evidence.includes(display)) return null;
    const clause = evidence.split(/[，。；,;\n]/).find((part) => part.includes(label) && part.includes(display));
    if (!clause || !sourceMetrics(display).some((fact) => fact.value === point.value)) return null;
    if (!facts.some((fact) => display.includes(fact.token) && fact.value === point.value)) return null;
    const pointDimensions = metricDimensions(display);
    const clauseDimensions = metricDimensions(clause);
    if (pointDimensions.dimension.length !== 1 || pointDimensions.dimension[0] !== chartDimensions.dimension[0]) return null;
    if (pointDimensions.period.length > 1 || clauseDimensions.period.length > 1) return null;
    const period = pointDimensions.period[0] || clauseDimensions.period[0] || "unspecified";
    if (pointDimensions.period[0] && clauseDimensions.period[0] && pointDimensions.period[0] !== clauseDimensions.period[0]) return null;
    if (chartDimensions.period.length && chartDimensions.period[0] !== period) return null;
    pointPeriods.add(period);
    if (/MRR|ARR/i.test(clause)) {
      const periods = [...new Set((clause.match(/MRR|ARR/gi) || []).map((period) => period.toUpperCase()))];
      if (periods.length !== 1 || !unit.toUpperCase().includes(periods[0])) return null;
    }
    if (/MRR/i.test(unit) && !/MRR/i.test(clause) || /ARR/i.test(unit) && !/ARR/i.test(clause)) return null;
    data.push({ label, value: point.value, display, ...(point.note && clause.includes(point.note) ? { note: cleanText(point.note, 160) } : {}) });
  }
  // Unknown or inconsistent denominators cannot share a visual comparison axis.
  if (data.length > 1 && pointPeriods.size > 1) return null;
  if (new Set(data.map((point) => point.label)).size !== data.length) return null;
  return { type: "chart", chartType: raw.chartType, title: cleanText(raw.title, 80) || unit, unit, data, source: "来源：当前案例原文" };
};

const sourceSupportsFlow = (nodes, evidence) => nodes.slice(1).every((to, index) => {
  const from = nodes[index];
  return String(evidence || "").split(/[，。！？；,;\n]/).some((clause) => {
    if (/不是|并非|不能|不代表|不意味着|不等于|没有/.test(clause)) return false;
    const start = clause.indexOf(from);
    const end = clause.indexOf(to, start + from.length);
    return start >= 0 && end > start && /进入|转化为|转化成|转为|带来|导致|产生|→|->|随后|然后|接着|再/.test(clause.slice(start + from.length, end));
  });
});

const enrichEvidenceVisuals = (beat, original, caseItem, profile, caseNarration) => {
  const evidence = `${beat.say || ""}\n${caseItem?.sourceBody || ""}\n${caseItem?.metric || ""}`;
  const image = String(caseItem?.image || "").trim();
  const rawElements = Array.isArray(original.elements) ? original.elements : [];
  let chart = rawElements.map((raw) => textChart(raw, evidence)).find(Boolean);
  if (chart?.chartType === "single" && sourceMetricItems(beat.say).length >= 2) chart = null;
  // This is reviewed image metadata, not inferred OCR or a mapping from ARR to MRR.
  if (profile?.chart && beat.scene === "metric") chart = globalThis.structuredClone(profile.chart);
  let relationship = null;
  const suppliedRelationship = rawElements.find((raw) => raw?.type === "relationship");
  if (suppliedRelationship && Array.isArray(suppliedRelationship.nodes) && suppliedRelationship.nodes.length >= 2 && suppliedRelationship.nodes.length <= 8) {
    const nodes = suppliedRelationship.nodes.map((node) => cleanText(node, 40));
    if (nodes.every((node) => node && (evidence.includes(node) || profile?.relationship?.nodes.includes(node))) && new Set(nodes).size === nodes.length) {
      const title = cleanText(suppliedRelationship.title, 80);
      const reviewedFlow = profile?.relationship?.mode === "flow" && JSON.stringify(profile.relationship.nodes) === JSON.stringify(nodes);
      const flow = suppliedRelationship.mode === "flow" && (reviewedFlow || sourceSupportsFlow(nodes, `${evidence}\n${caseNarration || ""}`));
      relationship = { type: "relationship", title: evidence.includes(title) || title === profile?.relationship?.title ? title : nodes.join("与"), nodes, focus: Number.isInteger(suppliedRelationship.focus) && suppliedRelationship.focus >= 0 && suppliedRelationship.focus < nodes.length ? suppliedRelationship.focus : 0, mode: flow ? "flow" : "focus" };
    }
  }
  if (profile?.relationship && /全渠道|渠道|打透|专注|聚焦|只做|一个/.test(beat.say || "") && beat.scene !== "metric") {
    relationship = globalThis.structuredClone(profile.relationship);
    const focus = relationship.nodes.findIndex((node) => String(beat.say).includes(node));
    if (focus >= 0) relationship.focus = focus;
    else if (/不是全渠道|并非全渠道|全渠道铺开/.test(beat.say || "")) delete relationship.focus;
  }
  if (!relationship && /流量|曝光/.test(beat.say || "") && /交易|成交/.test(caseNarration || beat.say || "")) {
    const context = caseNarration || beat.say;
    const first = /流量/.test(context) ? "流量" : "曝光";
    const second = /交易/.test(context) ? "交易" : "成交";
    relationship = { type: "relationship", title: `${first}与${second}`, nodes: [first, second], mode: sourceSupportsFlow([first, second], context) ? "flow" : "focus", focus: 1 };
  }
  const elements = beat.elements.map((element) => {
    if (element.type !== "image") return element;
    const authored = rawElements.find((raw) => raw?.type === "image" && raw.src === element.src);
    const focus = profile?.focus || normalizeFocus(authored?.focus);
    return { ...element, ...(focus ? { focus } : {}) };
  });
  if ((chart || relationship) && image && !elements.some((element) => element.type === "image")) elements.unshift({ type: "image", src: image, ...(profile?.focus ? { focus: profile.focus } : {}), ...(caseItem?.title ? { caption: cleanText(caseItem.title, 24) } : {}) });
  if (chart || relationship) {
    const rich = chart || relationship;
    const retained = elements.filter((element) => element.type === "image");
    const currentMetric = chart && profile?.chart && /年收入|年营收|ARR/i.test(beat.say || "") ? sourceMetrics(beat.say || "")[0] : null;
    const context = currentMetric ? [{ type: "text", text: currentMetric.token, size: "l" }] : [];
    return { ...beat, scene: chart ? "metric" : "relationship", elements: [rich, ...retained, ...context].slice(0, 4) };
  }
  if (beat.scene === "metric") {
    const actual = sourceMetrics(beat.say || "")[0];
    if (actual && sourceMetricItems(beat.say).length < 2) {
      const unit = /MRR/i.test(actual.token) ? "MRR" : /ARR/i.test(actual.token) ? "ARR" : /美元|[$]/.test(actual.token) ? "美元" : actual.token.replace(/(?:[$¥￥€]\s*)?\d[\d,]*(?:\.\d+)?\s*(?:万|千|亿|[kmb](?![a-z]))?/i, "").trim() || "原文指标";
      const single = { type: "chart", chartType: "single", title: beat.headline || "原文指标", unit, data: [{ label: "原文指标", value: actual.value, display: actual.token }], source: "来源：当前口播原文；单值不表示趋势" };
      const retained = [...elements, single];
      while (retained.length > 4) {
        const index = retained.findLastIndex((element) => element.type !== "image" && element.type !== "chart");
        retained.splice(index >= 0 ? index : 0, 1);
      }
      return { ...beat, elements: retained };
    }
  }
  return { ...beat, scene: beat.scene === "relationship" ? (elements.some((item) => item.type === "image") ? "product" : "statement") : beat.scene, elements };
};

const stepPhrases = (say) => {
  if (!/先|然后|再|最后|第一|第二|步骤|→/.test(say)) return [];
  const parts = String(say).split(/[，。；,;\n]|→/).map((part) => part.trim()).filter(Boolean);
  const actions = parts.filter((part) => /打开|输入|点击|选择|上传|生成|发布|订阅|保存|安装|创建|连接|提交|添加|运行|下载|登录|导入|设置|复制/.test(part));
  return actions.length >= 2 ? actions.slice(0, 3).map((part) => part.slice(0, 24)) : [];
};

const hasUnsupportedNumber = (text, evidence) => {
  const compact = String(evidence || "").replace(/,/g, "");
  const tokens = String(text || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/g) || [];
  const source = compact.match(/\d+(?:\.\d+)?/g) || [];
  return tokens.some((token) => !source.includes(token));
};

/** Enrich legacy cache rows without mutating cache, changing narration, or requiring regeneration. */
export const enrichBeatScenes = (beats, props) => {
  const firstCases = new Set();
  const caseNarrations = new Map();
  for (const beat of beats) {
    if (Number.isInteger(beat.caseIndex)) caseNarrations.set(beat.caseIndex, `${caseNarrations.get(beat.caseIndex) || ""}\n${beat.say || ""}`);
  }
  const enriched = beats.map((beat) => {
    const caseIndex = Number.isInteger(beat.caseIndex) && beat.caseIndex >= 0 ? beat.caseIndex : null;
    const caseItem = caseIndex === null ? null : props?.cases?.[caseIndex];
    const image = String(caseItem?.image || "").trim();
    const firstCaseLine = caseIndex !== null && !firstCases.has(caseIndex);
    if (caseIndex !== null) firstCases.add(caseIndex);
    const evidence = `${beat.say || ""} ${caseItem?.title || ""} ${caseItem?.metric || ""}`;
    const supportedMetrics = sourceMetrics(evidence);
    const metrics = sourceMetrics(beat.say).length ? sourceMetrics(beat.say)
      : beat.scene === "metric" ? supportedMetrics : [];
    const steps = stepPhrases(beat.say || "");
    const images = new Set(image ? [image] : []);
    const elements = (Array.isArray(beat.elements) ? beat.elements : []).flatMap((raw) => {
      if (raw?.type === "explanation") return [raw];
      const element = normalizeElement(raw, images);
      if (!element) return [];
      // Card sparklines have no source axis/timeline contract; never synthesize a series.
      if (element.type === "card") delete element.bars;
      if (element.type === "bar") {
        const fact = supportedMetrics.find((metric) => metric.value === element.to || metric.rawValue === element.to);
        if (!fact) return [];
        element.label = cleanText(fact.token, 12);
        element.note = cleanText(fact.token, 24);
        if (element.max !== undefined && !supportedMetrics.some((metric) => metric.value === element.max || metric.rawValue === element.max)) delete element.max;
      }
      const copy = { ...element };
      const visibleText = [copy.text, copy.title, copy.body, copy.label, copy.note, ...(copy.lines || [])].filter(Boolean).join(" ");
      const canonical = (text) => text.replace(/[\s,]/g, "").toLowerCase();
      if (sourceMetrics(visibleText).some((metric) => !supportedMetrics.some((fact) => canonical(fact.token) === canonical(metric.token)))) return [];
      if (hasUnsupportedNumber([copy.text, copy.title, copy.body, copy.label, copy.note, ...(copy.lines || [])].filter(Boolean).join(" "), evidence)) return [];
      return [copy];
    });
    if (firstCaseLine && image && !elements.some((item) => item.type === "image" && item.src === image)) {
      elements.unshift({ type: "image", src: image, ...(caseItem.title ? { caption: cleanText(caseItem.title, 24) } : {}) });
    }
    // Keep valid case images even when the model supplied four decorative elements first.
    const prioritized = [...elements.filter((item) => item.type === "image"), ...elements.filter((item) => item.type === "explanation"), ...elements.filter((item) => item.type !== "image" && item.type !== "explanation")].slice(0, 4);
    const inferred = metrics.length ? "metric" : prioritized.some((item) => item.type === "image") ? "product"
      : steps.length ? "steps" : "statement";
    let scene = SCENES.has(beat.scene) ? beat.scene : inferred;
    if ((scene === "product" && !prioritized.some((item) => item.type === "image")) || (scene === "metric" && !metrics.length) || (scene === "steps" && !steps.length)) scene = inferred;
    if (firstCaseLine && image) scene = metrics.length ? "metric" : "product";
    if (beat.scene === "steps" && !steps.length) {
      const retained = prioritized.filter((item) => item.type !== "phone" && item.type !== "card");
      prioritized.length = 0;
      prioritized.push(...retained);
    }
    if (scene === "steps") {
      const retained = prioritized.filter((item) => item.type === "image");
      prioritized.length = 0;
      prioritized.push(...retained, { type: "card", title: cleanText(caseItem?.title || beat.say, 16), lines: steps });
    }
    if (scene === "metric" && !prioritized.some((item) => item.type === "text" && metrics.some((metric) => item.text.includes(metric.token)))) {
      const metric = { type: "text", text: cleanText(metrics[0].token, 48), size: "xl" };
      if (prioritized.length === 4) prioritized.pop();
      prioritized.push(metric);
    }
    if (!prioritized.some((item) => ["text", "card", "phone", "image", "bar", "svg", "explanation"].includes(item.type))) {
      prioritized.length = 0;
      prioritized.push(textFallback(beat, beat.say));
    }
    let headline = hasUnsupportedNumber(beat.headline, evidence) ? cleanText(beat.say, 18) : beat.headline;
    if (scene === "metric" && /\d/.test(headline || "") && metrics.length) {
      const compact = (text) => String(text || "").replace(/[\s,]/g, "").toLowerCase();
      const completeMetric = metrics.some((metric) => compact(headline).includes(compact(metric.token)));
      if (!completeMetric) {
        const token = metrics[0].token;
        const context = String(beat.say || "").match(/年收入|月收入|年营收|月营收|收入|营收/)?.[0] || "";
        // Keep the complete metric instead of applying the old character cap inside its unit.
        headline = context && `${context}${token}`.length <= 18 ? `${context}${token}` : token;
      }
    }
    const profile = Array.isArray(props?.hostEvidence) ? props.hostEvidence.find((item) => item?.image === image) : null;
    return enrichEvidenceVisuals({ ...beat, headline, accent: headline?.includes(beat.accent) ? beat.accent : "", scene, elements: prioritized }, beat, caseItem, profile, caseNarrations.get(caseIndex));
  });
  return enrichContentVisuals(enriched);
};

export const validateBeats = (rawBeats, script, props) => {
  const raw = Array.isArray(rawBeats) ? rawBeats : [];
  const beats = narrationLines(script).map((line, index) => {
    const source = raw[index] && typeof raw[index] === "object" ? raw[index] : {};
    const headline = cleanText(source.headline || line.say, 18);
    const accent = cleanText(source.accent, 18);
    return {
      say: line.say,
      section: line.section,
      caseIndex: line.caseIndex,
      headline,
      accent: headline.includes(accent) ? accent : "",
      host: source.host === "cheer" ? "cheer" : "point",
      scene: source.scene,
      elements: Array.isArray(source.elements) ? source.elements : [],
    };
  });
  return enrichBeatScenes(beats, props);
};

const normalizeCueText = (value) =>
  String(value || "").replace(/\s+/g, "").replace(/[，。！？、,.!?;；:："“”‘’]/g, "");

const globalCues = (props) => {
  const scenes = [];
  let cursor = 0;
  const push = (cues, durationMs) => {
    scenes.push({
      start: cursor,
      cues: Array.isArray(cues) ? cues : [],
    });
    cursor += Number(durationMs) || 0;
  };
  push(props?.introCues, props?.introDurationMs);
  for (const item of props?.cases || []) {
    push(item?.cues, item?.durationMs);
  }
  push(props?.closingCues, props?.closingDurationMs);
  const flat = [];
  for (const scene of scenes) {
    for (const cue of scene.cues) {
      const text = normalizeCueText(cue?.text);
      if (!text) {
        continue;
      }
      flat.push({
        text,
        startMs: scene.start + (Number(cue.startMs) || 0),
        endMs: scene.start + (Number(cue.endMs) || 0),
      });
    }
  }
  return flat;
};

export const assignBeatTiming = (beats, props) => {
  const cues = globalCues(props);
  if (cues.length === 0) {
    return beats.map((beat, index) => ({
      ...beat,
      startMs: index * BEAT_MS,
      endMs: (index + 1) * BEAT_MS,
    }));
  }
  let cursor = 0;
  let fallbackStart = cues[cues.length - 1]?.endMs || 0;
  return beats.map((beat) => {
    const target = normalizeCueText(beat.say);
    const startCue = cursor;
    let covered = "";
    while (cursor < cues.length && covered.length < target.length) {
      covered += cues[cursor].text;
      cursor += 1;
    }
    if (cursor === startCue && cursor < cues.length) {
      cursor += 1;
    }
    const used = cues.slice(startCue, cursor);
    if (used.length === 0) {
      const startMs = fallbackStart;
      fallbackStart += BEAT_MS;
      return { ...beat, startMs, endMs: startMs + BEAT_MS };
    }
    const startMs = used[0].startMs;
    const endMs = Math.max(used[used.length - 1].endMs, startMs + 400);
    fallbackStart = endMs;
    return { ...beat, startMs, endMs };
  });
};

export const finalizeBeats = (payload, script, props) => {
  const raw = Array.isArray(payload) ? payload : payload?.beats;
  return assignBeatTiming(validateBeats(raw, script, props), props);
};

export const compositionIdForProps = (props) => {
  if (props?.templateId === "host") {
    return "HostExplainer";
  }
  return props?.aspect === "portrait"
    ? "IndieWeeklyMarkdownPortrait"
    : "IndieWeeklyMarkdown";
};
