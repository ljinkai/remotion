/**
 * Keep in sync with tools/subtitle-lines.mjs (Node / workbench side).
 */

export const MAX_SUBTITLE_CHARS = 16;
export const HARD_SUBTITLE_CHARS = 22;

export const charLen = (text: string) => [...String(text || "")].length;

const normalizeNarration = (raw: string) =>
  String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "。")
    .replace(/\s*([，。！？、；：,.!?;:])\s*/g, "$1")
    .replace(/[.…]+/g, "。")
    .replace(/[!！]+/g, "！")
    .replace(/[?？]+/g, "？")
    .replace(/。{2,}/g, "。")
    .trim();

const stripTrailingPunct = (text: string) =>
  text.replace(/[，。！？、；：,.!?;:]+$/u, "").trim();

const isLeadIn = (text: string) =>
  charLen(text) <= 8 &&
  /^(第[一二三四五六七八九十百零〇两\d]+条|接下来|先看|然后|另外|最后|再看|下面|开头|结尾)/u.test(
    text,
  );

const isAuthorLike = (text: string) => /作者|@/.test(text);

const forceBreakClause = (clause: string): string[] => {
  const text = clause.trim();
  if (!text) {
    return [];
  }
  if (charLen(text) <= HARD_SUBTITLE_CHARS) {
    return [text];
  }

  const chars = [...text];
  const target = Math.min(MAX_SUBTITLE_CHARS, Math.ceil(chars.length / 2));
  let splitAt = target;
  for (let i = target; i >= Math.floor(target * 0.55); i -= 1) {
    if ("的了在和与及到对把被让与或而".includes(chars[i] ?? "")) {
      splitAt = i + 1;
      break;
    }
  }

  const head = chars.slice(0, splitAt).join("").trim();
  const rest = chars.slice(splitAt).join("").trim();
  return [...forceBreakClause(head), ...forceBreakClause(rest)].filter(Boolean);
};

const splitLongClause = (sentence: string): string[] => {
  const body = stripTrailingPunct(sentence);
  if (!body) {
    return [];
  }
  if (charLen(body) <= MAX_SUBTITLE_CHARS) {
    return [body];
  }

  const parts = body
    .split(/(?<=[，、；;：:])/u)
    .map((part) => stripTrailingPunct(part))
    .filter(Boolean);

  if (parts.length <= 1) {
    return forceBreakClause(body);
  }

  const lines: string[] = [];
  for (const part of parts) {
    if (charLen(part) <= HARD_SUBTITLE_CHARS) {
      lines.push(part);
    } else {
      lines.push(...forceBreakClause(part));
    }
  }
  return lines;
};

/** Merge tiny lead-ins / pair short clauses for subtitle rhythm. */
export const mergeSubtitleSegments = (segments: string[]): string[] => {
  const out: string[] = [];
  let index = 0;

  while (index < segments.length) {
    const current = segments[index]?.trim() ?? "";
    const next = segments[index + 1]?.trim() ?? "";

    if (!current) {
      index += 1;
      continue;
    }

    if (
      next &&
      isLeadIn(current) &&
      !isAuthorLike(next) &&
      charLen(current) + 1 + charLen(next) <= HARD_SUBTITLE_CHARS + 4
    ) {
      out.push(`${current} ${next}`);
      index += 2;
      continue;
    }

    if (
      next &&
      !isLeadIn(next) &&
      !isAuthorLike(current) &&
      !isAuthorLike(next) &&
      charLen(current) <= 12 &&
      charLen(next) <= 12 &&
      charLen(current) + 1 + charLen(next) <= HARD_SUBTITLE_CHARS + 2
    ) {
      out.push(`${current}，${next}`);
      index += 2;
      continue;
    }

    out.push(current);
    index += 1;
  }

  return out;
};

export const splitSubtitleLines = (raw: string): string[] => {
  const text = normalizeNarration(raw);
  if (!text) {
    return [];
  }

  const sentences = text
    .split(/(?<=[。！？!?])/u)
    .map((item) => item.trim())
    .filter(Boolean);

  const clauses: string[] = [];
  for (const sentence of sentences.length ? sentences : [text]) {
    clauses.push(...splitLongClause(sentence));
  }

  return mergeSubtitleSegments(clauses).filter(Boolean);
};

export type ProvisionalCue = {
  text: string;
  startMs: number;
  endMs: number;
};

const finishLineText = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return "";
  }
  if (/[。！？!?]$/u.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}。`;
};

/** One cue per subtitle line, timed by character weight. */
export const buildProvisionalCues = (
  raw: string,
  durationMs: number,
): ProvisionalCue[] => {
  const lines = splitSubtitleLines(raw).map(finishLineText).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }
  const weights = lines.map((line) => Math.max(charLen(line), 1));
  const totalWeight = weights.reduce((sum, item) => sum + item, 0) || 1;
  const total = Math.max(Number(durationMs) || 0, lines.length * 700);
  let cursor = 0;
  return lines.map((text, index) => {
    const startMs = Math.round(cursor);
    cursor += (total * weights[index]) / totalWeight;
    const endMs =
      index === lines.length - 1 ? total : Math.max(Math.round(cursor), startMs + 200);
    return { text, startMs, endMs };
  });
};

type WordBoundaryLike = {
  text?: string;
  audioOffsetMs?: number;
  durationMs?: number;
  boundaryType?: number;
};

const normalizeCueChars = (value: string) =>
  String(value || "")
    .replace(/\s+/g, "")
    .replace(/[。！？!?，、；;：:·．.]/g, "");

/**
 * Build sequential single-line subtitle cues.
 * Prefers Azure word-boundary timing when available; otherwise character-weighted slices.
 */
export const buildTimedSubtitleCues = (
  raw: string,
  durationMs: number,
  boundaries: WordBoundaryLike[] = [],
): ProvisionalCue[] => {
  const lines = splitSubtitleLines(raw).map(finishLineText).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const total = Math.max(Number(durationMs) || 0, lines.length * 700);
  const wordEvents = (boundaries || []).filter((item) => {
    const text = String(item?.text || "").trim();
    return text.length > 0 && !/^[。！？!?，、；;：:\s]+$/u.test(text);
  });

  if (wordEvents.length < 2) {
    return buildProvisionalCues(lines.join("\n"), total);
  }

  let eventIndex = 0;
  let spokenNorm = "";
  const cues: ProvisionalCue[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const target = normalizeCueChars(line);
    const startEvent =
      wordEvents[Math.min(eventIndex, wordEvents.length - 1)] ?? wordEvents[0];
    const startMs = Math.max(
      0,
      Number(startEvent?.audioOffsetMs) || cues.at(-1)?.endMs || 0,
    );
    const startNormLen = spokenNorm.length;

    while (
      eventIndex < wordEvents.length &&
      spokenNorm.length - startNormLen < Math.max(target.length, 1)
    ) {
      spokenNorm += normalizeCueChars(String(wordEvents[eventIndex]?.text || ""));
      eventIndex += 1;
      if (spokenNorm.length - startNormLen >= target.length) {
        break;
      }
    }

    const endEvent =
      wordEvents[Math.max(Math.min(eventIndex, wordEvents.length) - 1, 0)] ??
      startEvent;
    let endMs =
      Number(endEvent?.audioOffsetMs || 0) + Number(endEvent?.durationMs || 0);
    if (lineIndex === lines.length - 1) {
      endMs = total;
    }
    cues.push({
      text: line,
      startMs,
      endMs: Math.max(endMs, startMs + 200),
    });
  }

  for (let index = 1; index < cues.length; index += 1) {
    if (cues[index].startMs < cues[index - 1].endMs) {
      cues[index].startMs = cues[index - 1].endMs;
    }
    if (cues[index].endMs <= cues[index].startMs) {
      cues[index].endMs = cues[index].startMs + 200;
    }
  }
  if (cues.length > 0) {
    cues[cues.length - 1].endMs = Math.max(cues[cues.length - 1].endMs, total);
  }
  return cues;
};

/** Ensure every cue is a single on-screen line (never a multi-line block). */
export const ensureSingleLineCues = (
  cues: ProvisionalCue[] | undefined,
  fallbackRaw: string,
  durationMs: number,
): ProvisionalCue[] => {
  if (!cues || cues.length === 0) {
    return buildTimedSubtitleCues(fallbackRaw, durationMs);
  }

  const expanded: ProvisionalCue[] = [];
  for (const cue of cues) {
    const lines = String(cue.text || "")
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (lines.length <= 1) {
      expanded.push({
        ...cue,
        text: finishLineText(lines[0] || String(cue.text || "")),
      });
      continue;
    }
    const span = Math.max(cue.endMs - cue.startMs, lines.length * 200);
    const slice = span / lines.length;
    lines.forEach((line, index) => {
      const startMs = Math.round(cue.startMs + index * slice);
      const endMs =
        index === lines.length - 1
          ? cue.endMs
          : Math.round(cue.startMs + (index + 1) * slice);
      expanded.push({
        text: finishLineText(line),
        startMs,
        endMs: Math.max(endMs, startMs + 160),
      });
    });
  }
  return expanded;
};

/**
 * Format narration for script editor + TTS:
 * one short subtitle line per row, ending with 。
 */
export const optimizeNarrationForSubtitles = (raw: string): string => {
  const lines = splitSubtitleLines(raw);
  if (lines.length === 0) {
    return "";
  }
  return lines.map(finishLineText).filter(Boolean).join("\n");
};
