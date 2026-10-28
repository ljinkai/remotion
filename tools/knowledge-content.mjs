import { assignBeatTiming, enrichBeatScenes } from "./beat-spec.mjs";
import { URL } from "node:url";
import { alignKnowledgeSpeech } from "./knowledge-timing.mjs";

const kinds = new Set(["concept", "case", "mechanism", "application", "limits", "summary"]);
const string = (value) => typeof value === "string" ? value : "";
const fail = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
export const normalizeKnowledgeImage = (value) => {
  const image = string(value).trim();
  if (!image) return "";
  if ([...image].some((char) => char.charCodeAt(0) < 32) || /[<>]/.test(image) || image.split(/[\\/]/).includes("..")) fail("章节图片地址无效 / Invalid chapter image");
  if (/^https?:\/\//i.test(image)) {
    try { const url = new URL(image); if (url.username || url.password) fail("图片地址不能包含凭据"); return image; } catch { fail("图片地址无效"); }
  }
  if (/[:\\]/.test(image) || image.startsWith("//")) fail("仅支持 public 相对图片路径或 HTTP(S) 图片地址");
  return image;
};

export const validateKnowledgeDocument = (raw) => {
  if (!raw || typeof raw !== "object") fail("缺少知识讲解文稿 / Missing knowledge document");
  const source = string(raw.source);
  const title = string(raw.title).trim();
  if (!source.trim()) fail("来源材料不能为空 / Source is required");
  if (!title) fail("视频标题不能为空 / Title is required");
  if (!Array.isArray(raw.chapters) || !raw.chapters.length) fail("至少需要一个章节 / At least one chapter is required");
  const ids = new Set();
  const chapters = raw.chapters.map((chapter, index) => {
    if (!chapter || typeof chapter !== "object") fail(`章节 ${index + 1} 格式错误`);
    const id = string(chapter.id).trim() || `chapter-${index + 1}`;
    const chapterTitle = string(chapter.title).trim();
    const narration = string(chapter.narration);
    if (ids.has(id)) fail(`章节 ID 重复：${id}`);
    ids.add(id);
    if (!chapterTitle || !narration.trim()) fail(`章节 ${index + 1} 需要标题和正文，文稿未被丢弃`);
    if (chapter.kind !== undefined && !kinds.has(chapter.kind)) fail(`章节 ${index + 1} 类型无效`);
    if (chapter.sourceRefs !== undefined && (!Array.isArray(chapter.sourceRefs) || chapter.sourceRefs.some((reference) => typeof reference !== "string" || !reference.trim()))) fail(`章节 ${index + 1} 来源引用格式错误`);
    const image = normalizeKnowledgeImage(chapter.image);
    return { id, title: chapterTitle, narration, ...(chapter.kind ? { kind: chapter.kind } : {}), ...(image ? { image } : {}), ...(chapter.sourceRefs?.length ? { sourceRefs: [...chapter.sourceRefs] } : {}), ...(string(chapter.sourceNote).trim() ? { sourceNote: chapter.sourceNote.trim() } : {}) };
  });
  return { title, source, locale: raw.locale === "en" ? "en" : "zh", chapters };
};

/** Offline extraction keeps full source paragraphs; headings become editable chapters. */
export const createKnowledgeOutline = ({ source, title, locale } = {}) => {
  if (!string(source).trim()) fail("来源材料不能为空 / Source is required");
  const english = locale === "en";
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const h1 = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim();
  const documentTitle = string(title).trim() || h1 || (english ? "Knowledge explainer" : "知识讲解");
  const chapters = [];
  let current = null;
  const ensure = () => current ||= { title: documentTitle, lines: [], notes: [] };
  const flush = () => {
    if (!current) return;
    chapters.push({ id: `chapter-${chapters.length + 1}`, title: current.title, narration: current.lines.join("\n").trim(), ...(current.notes.length ? { sourceNote: current.notes.join("\n") } : {}) });
    current = null;
  };
  for (const line of lines) {
    if (/^#\s+/.test(line) && line.replace(/^#\s+/, "").trim() === h1 && !current && !chapters.length) continue;
    const heading = line.match(/^#{2,6}\s+(.+)$/);
    if (heading) {
      if (current?.lines.some((row) => row.trim()) || current?.notes.length) flush();
      else if (current) fail(`章节“${current.title}”缺少正文，请保留并补充内容`);
      current = { title: heading[1].trim(), lines: [], notes: [] };
    } else if (/^(?:来源|出处|Source)\s*[:：]/i.test(line.trim())) ensure().notes.push(line.trim());
    else if (line.trim() || current) ensure().lines.push(line);
  }
  flush();
  return validateKnowledgeDocument({ title: documentTitle, source, locale, chapters });
};

export const splitKnowledgeNarration = (narration, locale = "zh") => {
  const rows = string(narration).split(/\n+/).map((row) => row.trim()).filter(Boolean);
  const output = [];
  for (const row of rows) {
    const sentences = row.match(/[\s\S]+?(?:[。！？!?]|(?<!\d)\.(?=\s|$)|$)/g)?.map((part) => part.trim()).filter(Boolean) || [row];
    for (const sentence of sentences) {
      const tokens = locale === "en" ? [...sentence.matchAll(/\S+/g)] : [...sentence.matchAll(/[A-Za-z0-9]+(?:[._'-][A-Za-z0-9]+)*|[^\s]/g)];
      let start = 0;
      for (let index = 0; index < tokens.length; index++) {
        const count = index - start + 1;
        const length = tokens[index].index + tokens[index][0].length - tokens[start].index;
        if (index > start && (locale === "en" ? count > 25 : length > 88)) {
          output.push(sentence.slice(tokens[start].index, tokens[index].index).trim());
          start = index;
        }
      }
      if (tokens.length) output.push(sentence.slice(tokens[start].index).trim());
    }
  }
  return output;
};

export const estimateKnowledgeBeatMs = (text, locale = "zh") => Math.max(1800, Math.round((locale === "en" ? (text.match(/\S+/g) || []).length / 2.4 : text.replace(/\s/g, "").length / 4) * 1000));

const chapterOverview = (chapter) => {
  if (!/分工|分别|职责|对比|roles|definitions|differences|responsibilities/i.test(chapter.title)) return null;
  const paragraph = chapter.narration.split(/\n\s*\n|\n/)[0];
  const sentences = splitKnowledgeNarration(paragraph, chapter.locale || "zh");
  const items = [];
  for (const sentence of sentences) {
    const definition = sentence.match(/^(.{1,32}?)[，,]\s*(?:关注|指的是|意味着)/)
      || sentence.match(/^(.{1,32}?)(?:负责(?!人)|可以帮助|承担)/)
      || sentence.match(/^(.{1,70}?)\s+(?:means|refers to|focuses on|is responsible for|can help|handles?)\b/i);
    if (!definition) continue;
    items.push({ label: definition[1].trim(), detail: sentence });
  }
  if (items.length < 2 || items.length > 4 || new Set(items.map((item) => item.label)).size !== items.length) return null;
  return { type: "explanation", layout: "features", title: chapter.title, items };
};

export const retimeKnowledgeProps = (props) => {
  if (props?.contentMode !== "knowledge" && props?.templateId !== "knowledge") return props;
  props = alignKnowledgeSpeech(props);
  let beats = props.useSynthesizedTimeline ? props.beats || [] : assignBeatTiming(props.beats || [], props);
  const sceneDuration = Number(props.introDurationMs || 0) + (props.cases || []).reduce((sum, item) => sum + (Number(item.durationMs) || 0), 0);
  const fullDuration = props.useSynthesizedTimeline ? Number(props.narrationDurationMs) || sceneDuration : Math.max(sceneDuration, ...beats.map((beat) => beat.endMs || 0));
  if (beats.length && fullDuration > beats.at(-1).endMs) beats[beats.length - 1] = { ...beats.at(-1), endMs: fullDuration };
  let cursor = Number(props.introDurationMs) || 0;
  const chapters = (props.knowledge?.chapters || []).map((chapter, index) => {
    const matching = beats.filter((beat) => beat.caseIndex === index);
    const startMs = cursor;
    const endMs = Math.max(cursor + (Number(props.cases?.[index]?.durationMs) || 0), matching.at(-1)?.endMs || cursor);
    cursor = endMs;
    const visual = chapterOverview({ ...chapter, locale: props.locale });
    return { ...chapter, startMs, endMs, durationMs: endMs - startMs, ...(visual ? { visual } : {}) };
  });
  beats = beats.map((beat) => {
    const visual = chapters[beat.caseIndex]?.visual;
    if (!visual || beat.elements.some((element) => element.type === "chart" || element.type === "relationship")) return beat;
    const focus = visual.items.findIndex((item) => item.detail.includes(beat.say) || beat.say.includes(item.detail));
    if (focus < 0) return beat;
    return { ...beat, scene: "statement", chapterVisual: visual, chapterFocus: focus, elements: [visual, ...beat.elements.filter((element) => element.type === "image")].slice(0, 4) };
  });
  return { ...props, aspect: "landscape", beats, knowledge: { ...props.knowledge, chapters }, estimatedDurationMs: fullDuration, timingSource: props.useSynthesizedTimeline ? "speech" : "estimated" };
};

export const buildKnowledgeProps = (input) => {
  const document = validateKnowledgeDocument(input);
  const { locale, title, chapters } = document;
  const rawBeats = [];
  const cases = chapters.map((chapter, index) => {
    let cursor = 0;
    const cues = splitKnowledgeNarration(chapter.narration, locale).map((say) => {
      const duration = estimateKnowledgeBeatMs(say, locale);
      const cue = { text: say, startMs: cursor, endMs: cursor + duration };
      cursor += duration;
      rawBeats.push({ say, section: "case", caseIndex: index, chapterId: chapter.id, headline: chapter.title, accent: "", host: "point", elements: [] });
      return cue;
    });
    return { index: String(index + 1).padStart(2, "0"), title: chapter.title, subtitle: chapter.narration, sourceBody: chapter.narration, image: chapter.image || "", author: "", date: "", metric: "", fallback: chapter.title, color: "#5a74d8", durationMs: cursor, cues };
  });
  const props = { contentMode: "knowledge", templateId: "knowledge", aspect: "landscape", locale, knowledge: { title, source: document.source, chapters }, issueNumber: "", headerTitle: title, coverTitle: title, coverSubtitle: "", coverBadge: "", introSubtitle: "", introSourceBody: "", closingTitle: "", closingSubtitle: "", closingSourceBody: "", ticker: "", introDurationMs: 0, closingDurationMs: 0, useSynthesizedTimeline: false, cases };
  return retimeKnowledgeProps({ ...props, beats: enrichBeatScenes(rawBeats, props) });
};
