/**
 * Keep in sync with src/subtitleLines.ts (Remotion / browser side).
 */

export const MAX_SUBTITLE_CHARS = 16;
export const HARD_SUBTITLE_CHARS = 22;

const SPLIT_PUNCT = /[，。！？、；：,.!?;:]+/u;
const STRIP_PUNCT = /[，。！？、；：,.!?;:]+/gu;

export const charLen = (text) => [...String(text || "")].length;

const normalizeNarration = (raw) =>
  String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "，")
    .replace(/\s*([，。！？、；：,.!?;:])\s*/g, "$1")
    .replace(/[.…]+/g, "。")
    .replace(/[!！]+/g, "！")
    .replace(/[?？]+/g, "？")
    .trim();

export const stripSubtitlePunctuation = (text) =>
  String(text || "")
    .replace(STRIP_PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim();

const isLeadIn = (text) =>
  charLen(text) <= 8 &&
  /^(第[一二三四五六七八九十百零〇两\d]+条|接下来|先看|然后|另外|最后|再看|下面|开头|结尾)/u.test(
    text,
  );

const isAuthorLike = (text) => /作者|@/.test(text);

const isLatinChar = (ch) => /[A-Za-z0-9@._+-]/.test(ch || "");

export const tokenizeSubtitleAtoms = (text) => {
  const chars = [...stripSubtitlePunctuation(text)];
  const tokens = [];
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

const tokenLen = (token) => charLen(token.text);

const forceBreakClause = (clause) => {
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

  const lines = [];
  let current = [];
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

  const peekLatinPhraseLen = (from) => {
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

    if (
      token.type === "latin" ||
      (token.type === "space" && tokens[index + 1]?.type === "latin")
    ) {
      const phraseLen = peekLatinPhraseLen(index);
      if (
        phraseLen > 0 &&
        currentLen > 0 &&
        currentLen + phraseLen > MAX_SUBTITLE_CHARS &&
        currentLen + phraseLen <= HARD_SUBTITLE_CHARS + 8 &&
        currentLen >= Math.min(6, MAX_SUBTITLE_CHARS)
      ) {
        if (phraseLen <= HARD_SUBTITLE_CHARS + 4) {
          flush();
        }
      }
    }

    const nextLen = currentLen + tokenLen(token);
    if (
      current.length > 0 &&
      nextLen > MAX_SUBTITLE_CHARS &&
      !(
        token.type === "latin" &&
        currentLen + tokenLen(token) <= HARD_SUBTITLE_CHARS + 6
      )
    ) {
      if (
        token.type === "space" &&
        current[current.length - 1]?.type === "latin" &&
        tokens[index + 1]?.type === "latin"
      ) {
        const joined = currentLen + 1 + tokenLen(tokens[index + 1]);
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

export const repairBrokenLatinLines = (lines) => {
  const out = [];
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

export const mergeSubtitleSegments = (segments) => {
  const out = [];
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

export const splitSubtitleLines = (raw) => {
  const text = normalizeNarration(raw);
  if (!text) {
    return [];
  }

  const pieces = text
    .split(SPLIT_PUNCT)
    .map((item) => stripSubtitlePunctuation(item))
    .filter(Boolean);

  return mergeSubtitleSegments(
    pieces.length ? pieces : [stripSubtitlePunctuation(text)],
  );
};

export const buildProvisionalCues = (raw, durationMs) => {
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

const normalizeCueChars = (value) =>
  String(value || "")
    .replace(/\s+/g, "")
    .replace(/[。！？!?，、；;：:·．.]/g, "");

export const buildTimedSubtitleCues = (raw, durationMs, boundaries = []) => {
  const lines = splitSubtitleLines(raw);
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
  const cues = [];

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

export const ensureSingleLineCues = (cues, fallbackRaw, durationMs) => {
  if (!cues || cues.length === 0) {
    return buildTimedSubtitleCues(fallbackRaw, durationMs);
  }

  const expanded = [];
  for (const cue of cues) {
    const lines = splitSubtitleLines(String(cue.text || ""));
    if (lines.length <= 1) {
      const text = stripSubtitlePunctuation(lines[0] || String(cue.text || ""));
      if (text) {
        expanded.push({ ...cue, text });
      }
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
        text: line,
        startMs,
        endMs: Math.max(endMs, startMs + 160),
      });
    });
  }
  return expanded.length > 0
    ? expanded
    : buildTimedSubtitleCues(fallbackRaw, durationMs);
};

export const narrationForSpeech = (raw) => {
  const lines = splitSubtitleLines(raw);
  if (lines.length === 0) {
    return "";
  }
  return `${lines.join("。")}。`;
};

export const optimizeNarrationForSubtitles = (raw) => {
  const lines = splitSubtitleLines(raw);
  if (lines.length === 0) {
    return "";
  }
  return lines.join("\n");
};
