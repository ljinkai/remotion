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

const isSceneElement = (element) =>
  element.type === "card" ||
  element.type === "phone" ||
  element.type === "image" ||
  element.type === "bar";

const phraseLines = (say, title) => {
  const parts = String(say || "")
    .split(/[，。！？、；,.]+/)
    .map((item) => item.trim())
    .filter((item) => item && item !== title);
  if (parts.length >= 2) {
    return parts.slice(0, 3).map((item) => item.slice(0, 24));
  }
  const compact = String(say || "").replace(/\s+/g, "");
  const titleCompact = String(title || "").replace(/\s+/g, "");
  const lines = [];
  for (let index = 0; index < compact.length && lines.length < 3; index += 10) {
    const piece = compact.slice(index, index + 10);
    if (piece && piece !== titleCompact) {
      lines.push(piece);
    }
  }
  return lines;
};

const parseAmount = (text) => {
  const source = String(text || "").replace(/,/g, "");
  const wan = source.match(/(\d+(?:\.\d+)?)\s*万/);
  if (wan) {
    return Math.round(Number(wan[1]) * 10000);
  }
  const qian = source.match(/(\d+(?:\.\d+)?)\s*千/);
  if (qian) {
    return Math.round(Number(qian[1]) * 1000);
  }
  const plain = source.match(/\$?\s*(\d{2,}(?:\.\d+)?)/);
  if (!plain) {
    return null;
  }
  const value = Number(plain[1]);
  if (value >= 1990 && value <= 2035 && !/[美元元%]/.test(source)) {
    return null;
  }
  return value;
};

const actionWord = (say) => {
  if (/发推|推文/.test(say)) {
    return "发推";
  }
  if (/订阅/.test(say)) {
    return "订阅";
  }
  if (/打开/.test(say)) {
    return "打开";
  }
  if (/发布/.test(say)) {
    return "发布";
  }
  return "";
};

const sceneForLine = (line, headline, caseItem) => {
  const say = String(line?.say || "");
  const title = cleanText(headline || say, 16) || "这一句";
  const image = String(caseItem?.image || "").trim();
  if (image && /页面|截图|样子|界面|产品页|长什么样/.test(say)) {
    return {
      type: "image",
      src: image,
      ...(cleanText(caseItem?.title || headline, 24)
        ? { caption: cleanText(caseItem?.title || headline, 24) }
        : {}),
    };
  }
  const amount = parseAmount(say);
  if (amount !== null && /美元|元|收入|营收|MRR|万|千|%|用户|增长/.test(say)) {
    return {
      type: "bar",
      label: cleanText(headline, 12) || "数值",
      to: amount,
      note: cleanText(say, 24),
    };
  }
  if (/发推|推文|订阅|打开|手机|应用|发布|消息|自动/.test(say)) {
    const action = actionWord(say);
    return {
      type: "phone",
      title,
      body: cleanText(say, 24) || title,
      ...(action ? { action } : {}),
    };
  }
  const lines = phraseLines(say, title);
  return {
    type: "card",
    title,
    ...(lines.length ? { lines } : {}),
  };
};

export const validateBeats = (rawBeats, script, props) => {
  const lines = narrationLines(script);
  const images = allowedImageSrcs(props);
  const raw = Array.isArray(rawBeats) ? rawBeats : [];
  return lines.map((line, index) => {
    const source = raw[index] && typeof raw[index] === "object" ? raw[index] : {};
    let headline = cleanText(source.headline || line.say, 18);
    if (!headline) {
      headline = cleanText(line.say, 18);
    }
    let accent = cleanText(source.accent, 18);
    if (!headline.includes(accent)) {
      accent = "";
    }
    const elements = [];
    const list = Array.isArray(source.elements) ? source.elements : [];
    for (const item of list) {
      if (elements.length >= 4) {
        break;
      }
      const element = normalizeElement(item, images);
      if (element) {
        elements.push(element);
      }
    }
    if (!elements.some(isSceneElement)) {
      const caseItem = (props?.cases || [])[line.caseIndex] || null;
      const scene = sceneForLine(line, headline, caseItem);
      const rest = elements.filter((item) => item.type !== "icon");
      elements.length = 0;
      elements.push(scene, ...rest);
      if (elements.length > 4) {
        elements.length = 4;
      }
    }
    if (elements.length === 0) {
      elements.push(textFallback(line, headline));
    }
    return {
      say: line.say,
      section: line.section,
      caseIndex: line.caseIndex,
      headline,
      accent,
      host: source.host === "cheer" ? "cheer" : "point",
      elements,
    };
  });
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
