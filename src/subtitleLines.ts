/**
 * Keep in sync with tools/subtitle-lines.mjs (Node / workbench side).
 */

export const MAX_SUBTITLE_CHARS = 16;
export const HARD_SUBTITLE_CHARS = 22;

/** Split on any of these — each piece becomes its own on-screen subtitle. */
const SPLIT_PUNCT = /[，。！？、；：,.!?;:]+/u;
const STRIP_PUNCT = /[，。！？、；：,.!?;:]+/gu;

export const charLen = (text: string) => [...String(text || "")].length;

const normalizeNarration = (raw: string) =>
  String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "，")
    .replace(/\s*([，。！？、；：,.!?;:])\s*/g, "$1")
    .replace(/[.…]+/g, "。")
    .replace(/[!！]+/g, "！")
    .replace(/[?？]+/g, "？")
    .trim();

/** Display text: no commas / periods on screen. */
export const stripSubtitlePunctuation = (text: string) =>
  String(text || "")
    .replace(STRIP_PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();

const isLeadIn = (text: string) =>
  charLen(text) <= 8 &&
  /^(第[一二三四五六七八九十百零〇两\d]+条|接下来|先看|然后|另外|最后|再看|下面|开头|结尾)/u.test(
    text,
  );

const isAuthorLike = (text: string) => /作者|@/.test(text);

const isLatinChar = (ch: string) => /[A-Za-z0-9@._+-]/.test(ch || "");

type BreakToken = { type: "latin" | "cjk" | "space"; text: string };

/** Tokenize so English brand names stay atomic (never cut Instagram mid-word). */
export const tokenizeSubtitleAtoms = (text: string): BreakToken[] => {
  const chars = [...stripSubtitlePunctuation(text)];
  const tokens: BreakToken[] = [];
  let index = 0;
  while (index < chars.length) {
    const ch = chars[index] ?? "";
    if (ch === " ") {
      tokens.push({ type: "space", text: " " });
      index += 1;
      continue;
    }
    if (isLatinChar(ch)) {
      let end = index + 1;
      while (end < chars.length && isLatinChar(chars[end] ?? "")) {
        end += 1;
      }
      tokens.push({ type: "latin", text: chars.slice(index, end).join("") });
      index = end;
      continue;
    }
    tokens.push({ type: "cjk", text: ch });
    index += 1;
  }
  return tokens;
};

const tokenLen = (token: BreakToken) => charLen(token.text);

/**
 * Pack tokens into lines. Never split inside a Latin token.
 * Keep adjacent Latin words like "indie hacker" on the same line when they fit.
 */
const forceBreakClause = (clause: string): string[] => {
  const text = stripSubtitlePunctuation(clause);
  if (!text) {
    return [];
  }
  if (charLen(text) <= HARD_SUBTITLE_CHARS) {
    return [text];
  }

  const tokens = tokenizeSubtitleAtoms(text);
  if (tokens.length <= 1) {
    return [text];
  }

  const lines: string[] = [];
  let current: BreakToken[] = [];
  let currentLen = 0;

  const flush = () => {
    const line = current
      .map((item) => item.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (line) {
      lines.push(line);
    }
    current = [];
    currentLen = 0;
  };

  const peekLatinPhraseLen = (from: number) => {
    let len = 0;
    let index = from;
    let sawLatin = false;
    while (index < tokens.length) {
      const token = tokens[index];
      if (!token) {
        break;
      }
      if (token.type === "latin") {
        len += tokenLen(token);
        sawLatin = true;
        index += 1;
        continue;
      }
      if (token.type === "space" && sawLatin && tokens[index + 1]?.type === "latin") {
        len += 1;
        index += 1;
        continue;
      }
      break;
    }
    return sawLatin ? len : 0;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }

    if (token.type === "space" && current.length === 0) {
      continue;
    }

    // Prefer keeping "indie hacker" style phrases together.
    if (token.type === "latin" || (token.type === "space" && tokens[index + 1]?.type === "latin")) {
      const phraseLen = peekLatinPhraseLen(index);
      if (
        phraseLen > 0 &&
        currentLen > 0 &&
        currentLen + (token.type === "space" ? 0 : 0) + phraseLen > MAX_SUBTITLE_CHARS &&
        currentLen + phraseLen <= HARD_SUBTITLE_CHARS + 8 &&
        currentLen >= Math.min(6, MAX_SUBTITLE_CHARS)
      ) {
        // If phrase fits alone better on next line, flush first.
        if (phraseLen <= HARD_SUBTITLE_CHARS + 4) {
          flush();
        }
      }
    }

    const nextLen = currentLen + tokenLen(token);
    if (
      current.length > 0 &&
      nextLen > MAX_SUBTITLE_CHARS &&
      !(token.type === "latin" && currentLen + tokenLen(token) <= HARD_SUBTITLE_CHARS + 6)
    ) {
      // Don't flush if we'd only be splitting a Latin phrase by space.
      if (
        token.type === "space" &&
        current[current.length - 1]?.type === "latin" &&
        tokens[index + 1]?.type === "latin"
      ) {
        const joined =
          currentLen + 1 + tokenLen(tokens[index + 1]!);
        if (joined <= HARD_SUBTITLE_CHARS + 6) {
          current.push(token);
          currentLen += 1;
          continue;
        }
      }
      flush();
      if (token.type === "space") {
        continue;
      }
    }

    current.push(token);
    currentLen += tokenLen(token);
  }
  flush();
  return lines.length > 0 ? lines : [text];
};

/** Repair lines where an English word was cut in half across a newline. */
export const repairBrokenLatinLines = (lines: string[]): string[] => {
  const out: string[] = [];
  for (const rawLine of lines) {
    const line = stripSubtitlePunctuation(rawLine);
    if (!line) {
      continue;
    }
    if (out.length === 0) {
      out.push(line);
      continue;
    }

    const prev = out[out.length - 1] ?? "";
    const lastLatinRun = prev.match(/[A-Za-z0-9@._+-]+$/)?.[0] ?? "";
    // "Ins" + "tagram" → broken word, glue without space
    if (lastLatinRun && /^[a-z0-9]/.test(line) && lastLatinRun.length <= 4) {
      out[out.length - 1] = `${prev}${line}`;
      continue;
    }
    // Keep short Latin phrases together: "indie" + "hacker"
    if (
      lastLatinRun &&
      /^[A-Za-z]/.test(line) &&
      charLen(`${prev} ${line}`) <= HARD_SUBTITLE_CHARS + 8
    ) {
      const nextWord = line.split(/\s+/)[0] ?? "";
      if (
        /^[A-Za-z0-9@._+-]+$/.test(lastLatinRun) &&
        /^[A-Za-z0-9@._+-]+/.test(nextWord) &&
        charLen(lastLatinRun) <= 16 &&
        charLen(nextWord) <= 16
      ) {
        out[out.length - 1] = `${prev} ${line}`;
        continue;
      }
    }

    out.push(line);
  }
  return out;
};

/** Only merge tiny lead-ins like「第一条」with the next title — never join with commas. */
export const mergeSubtitleSegments = (segments: string[]): string[] => {
  const out: string[] = [];
  let index = 0;

  while (index < segments.length) {
    const current = stripSubtitlePunctuation(segments[index] ?? "");
    const next = stripSubtitlePunctuation(segments[index + 1] ?? "");

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

    if (charLen(current) > HARD_SUBTITLE_CHARS) {
      out.push(...forceBreakClause(current));
    } else {
      out.push(current);
    }
    index += 1;
  }

  return repairBrokenLatinLines(out).flatMap((line) => {
    if (charLen(line) > HARD_SUBTITLE_CHARS) {
      return forceBreakClause(line);
    }
    return [line];
  });
};

export const splitSubtitleLines = (raw: string): string[] => {
  const text = normalizeNarration(raw);
  if (!text) {
    return [];
  }

  const pieces = text
    .split(SPLIT_PUNCT)
    .map((item) => stripSubtitlePunctuation(item))
    .filter(Boolean);

  return mergeSubtitleSegments(pieces.length ? pieces : [stripSubtitlePunctuation(text)]);
};

export type ProvisionalCue = {
  text: string;
  startMs: number;
  endMs: number;
};

/** One cue per subtitle line, timed by character weight. */
export const buildProvisionalCues = (
  raw: string,
  durationMs: number,
): ProvisionalCue[] => {
  const lines = splitSubtitleLines(raw);
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
      index === lines.length - 1
        ? total
        : Math.max(Math.round(cursor), startMs + 200);
    return { text, startMs, endMs };
  });
};

type WordBoundaryLike = {
  text?: string;
  audioOffsetMs?: number;
  durationMs?: number;
  boundaryType?: number;
  /** UTF-16 offset into the spoken string (`narrationForSpeech`). */
  textOffset?: number;
  wordLength?: number;
};

const isPunctuationEvent = (text: string) =>
  /^[。！？!?，、；;：:\s]+$/u.test(String(text || "").trim());

/** UTF-16 ranges of each display line inside `lines.join("。") + "。"`. */
export const speechLineRanges = (lines: string[]) => {
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const line of lines) {
    const start = cursor;
    const end = start + String(line).length;
    ranges.push({ start, end });
    cursor = end + 1;
  }
  return ranges;
};

const splitWindowByCharWeight = (
  lines: string[],
  startMs: number,
  endMs: number,
): ProvisionalCue[] => {
  if (lines.length === 0) {
    return [];
  }
  if (lines.length === 1) {
    return [{ text: lines[0], startMs, endMs: Math.max(endMs, startMs + 160) }];
  }
  const weights = lines.map((line) => Math.max(charLen(line), 1));
  const totalWeight = weights.reduce((sum, item) => sum + item, 0) || 1;
  const span = Math.max(endMs - startMs, lines.length * 160);
  const starts = [startMs];
  let consumed = 0;
  for (let index = 0; index < lines.length - 1; index += 1) {
    consumed += weights[index] ?? 1;
    starts.push(Math.round(startMs + (span * consumed) / totalWeight));
  }
  return lines.map((text, index) => ({
    text,
    startMs: starts[index] ?? startMs,
    endMs: index === lines.length - 1 ? endMs : (starts[index + 1] ?? endMs),
  }));
};

/**
 * One cue per subtitle line. When Azure WordBoundary `textOffset` is present,
 * a line ends when the next line's first word starts (no overlap, no even split).
 */
export const buildTimedSubtitleCues = (
  raw: string,
  durationMs: number,
  boundaries: WordBoundaryLike[] = [],
): ProvisionalCue[] => {
  const lines = splitSubtitleLines(raw);
  if (lines.length === 0) {
    return [];
  }

  const total = Math.max(Number(durationMs) || 0, lines.length * 700);
  const wordEvents = (boundaries || []).filter((item) => {
    const text = String(item?.text || "").trim();
    return text.length > 0 && !isPunctuationEvent(text);
  });
  const offsetEvents = wordEvents.filter((item) =>
    Number.isFinite(Number(item.textOffset)),
  );

  if (offsetEvents.length === 0) {
    return buildProvisionalCues(lines.join("。"), total);
  }

  const ranges = speechLineRanges(lines);
  const wordsByLine: WordBoundaryLike[][] = lines.map(() => []);
  for (const event of offsetEvents) {
    const offset = Number(event.textOffset);
    const lineIndex = ranges.findIndex(
      (range) => offset >= range.start && offset < range.end,
    );
    if (lineIndex >= 0) {
      wordsByLine[lineIndex]?.push(event);
    }
  }

  const firstWordMs = (index: number): number | null => {
    const first = wordsByLine[index]?.[0];
    if (!first) {
      return null;
    }
    const ms = Number(first.audioOffsetMs);
    return Number.isFinite(ms) ? Math.max(0, ms) : null;
  };

  const starts: number[] = lines.map(() => 0);
  starts[0] = 0;
  for (let index = 1; index < lines.length; index += 1) {
    const ms = firstWordMs(index);
    const previous = starts[index - 1] ?? 0;
    starts[index] = ms == null ? previous + 200 : ms;
    if ((starts[index] ?? 0) < previous) {
      starts[index] = previous;
    }
  }

  return lines.map((text, index) => {
    const startMs = starts[index] ?? 0;
    const endMs =
      index === lines.length - 1 ? total : (starts[index + 1] ?? total);
    return {
      text,
      startMs,
      endMs: Math.max(endMs, startMs + 160),
    };
  });
};

/** Ensure every cue is a single on-screen line without punctuation. */
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
    const lines = splitSubtitleLines(String(cue.text || ""));
    if (lines.length <= 1) {
      const text = stripSubtitlePunctuation(lines[0] || String(cue.text || ""));
      if (text) {
        expanded.push({ ...cue, text });
      }
      continue;
    }
    expanded.push(
      ...splitWindowByCharWeight(lines, cue.startMs, cue.endMs),
    );
  }
  return expanded.length > 0
    ? expanded
    : buildTimedSubtitleCues(fallbackRaw, durationMs);
};

/** Spoken form for TTS — join lines with periods for natural pauses. */
export const narrationForSpeech = (raw: string): string => {
  const lines = splitSubtitleLines(raw);
  if (lines.length === 0) {
    return "";
  }
  return `${lines.join("。")}。`;
};

/**
 * Format narration for script editor:
 * one subtitle line per row, no commas/periods shown.
 */
export const optimizeNarrationForSubtitles = (raw: string): string => {
  const lines = splitSubtitleLines(raw);
  if (lines.length === 0) {
    return "";
  }
  return lines.join("\n");
};
