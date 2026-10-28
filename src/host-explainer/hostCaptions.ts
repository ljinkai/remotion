/** Raised overlay captions, above the former footer placement. */
export const HOST_CAPTION_LAYOUT = {
  left: 64,
  top: 1540,
  width: 952,
  height: 132,
  fontSize: 40,
  lineHeight: 52,
  paddingX: 24,
} as const;
export const HOST_CAPTION_APPEARANCE = {
  color: "#FFE34D",
  WebkitTextStroke: "2px #151515",
  paintOrder: "stroke fill" as const,
  textShadow: "0 2px 3px rgba(0,0,0,0.9), 0 4px 8px rgba(0,0,0,0.65)",
  zIndex: 10,
} as const;

const units = (text: string) =>
  [...text].reduce((sum, char) => {
    if (/[\r\n]/.test(char)) return sum;
    if (char.codePointAt(0)! > 255) return sum + 1;
    if (/\s/.test(char)) return sum + 0.35;
    if (/[MWmw@%&#]/.test(char)) return sum + 1;
    if (/[iljt.,:;'!|]/.test(char)) return sum + 0.35;
    return sum + (/[A-Z0-9]/.test(char) ? 0.75 : 0.65);
  }, 0);
export type HostCaptionPage = { lines: string[]; weight: number };

type WordSegmenter = {
  segment: (text: string) => Iterable<{ segment: string }>;
};
// ES2018 is the project target; current render browsers provide Segmenter at runtime.
const Segmenter = (
  Intl as unknown as {
    Segmenter?: new (
      locale: string,
      options: { granularity: "word" },
    ) => WordSegmenter;
  }
).Segmenter;
const chineseWords = Segmenter
  ? new Segmenter("zh", { granularity: "word" })
  : null;
const closingPunctuation = /^[，。！？；、,.!?;：:）】》”’]+$/;

/** Preserve source characters. Chinese words, Latin terms and numeric facts stay together. */
export const hostCaptionPages = (
  text: string,
  layout: {
    width: number;
    paddingX: number;
    fontSize: number;
  } = HOST_CAPTION_LAYOUT,
): HostCaptionPage[] => {
  const limit = Math.max(
    1,
    (layout.width - layout.paddingX * 2) / (layout.fontSize * 1.07),
  );
  const original =
    text.match(
      /[$€£¥]?\d+(?:,\d{3})+(?:\.\d+)?%?|[$€£¥]?[A-Za-z0-9]+(?:[-'’./:+_][A-Za-z0-9]+)*%?|\p{Script=Han}+|\s+|[^\s]/gu,
    ) || [];
  const semantic = original.flatMap((token) =>
    /^\p{Script=Han}+$/u.test(token) && chineseWords
      ? [...chineseWords.segment(token)].map((word) => word.segment)
      : [token],
  );
  const attached: string[] = [];
  for (const token of semantic) {
    // Include closing punctuation in the preceding word's width before line breaking.
    if (
      closingPunctuation.test(token) &&
      attached.length &&
      !/\s$/.test(attached[attached.length - 1])
    )
      attached[attached.length - 1] += token;
    else attached.push(token);
  }
  // A long URL / compound word (or a Han run on old engines) must still fit the frame.
  const tokens = attached.flatMap((token) =>
    units(token) > limit ? [...token] : [token],
  );
  const lines: string[][] = [];
  let start = 0;
  // If two complete clauses already fit, use their natural boundary rather than fill line one.
  if (!/[\r\n]/.test(text) && units(text) > limit && units(text) <= limit * 2) {
    let best = -1,
      distance = Infinity,
      left = 0;
    for (let index = 0; index < tokens.length - 1; index++) {
      left += units(tokens[index]);
      const right = units(text) - left;
      if (
        /[，。！？；、,.!?;：:]$/.test(tokens[index]) &&
        left <= limit &&
        right <= limit &&
        Math.abs(left - right) < distance
      ) {
        best = index + 1;
        distance = Math.abs(left - right);
      }
    }
    if (best > 0) {
      lines.push(tokens.slice(0, best), tokens.slice(best));
      start = tokens.length;
    }
  }
  while (start < tokens.length) {
    let end = start,
      total = 0,
      preferred = -1;
    while (end < tokens.length && total + units(tokens[end]) <= limit) {
      total += units(tokens[end]);
      if (total >= limit * 0.55 && /[，。！？；、,.!?;：:]$/.test(tokens[end]))
        preferred = end + 1;
      end++;
      if (/[\r\n]/.test(tokens[end - 1])) break;
    }
    if (end < tokens.length && preferred > start) end = preferred;
    if (end === start) end++;
    lines.push(tokens.slice(start, end));
    start = end;
  }
  if (lines.length > 2 && lines.length % 2 === 1) {
    const tail = lines[lines.length - 1],
      donor = lines[lines.length - 2];
    if (
      !/[\r\n]/.test(donor.join("")) &&
      units(donor.join("") + tail.join("")) <= limit
    ) {
      donor.push(...tail);
      lines.pop();
    }
  }
  // Rebalance an orphan final page by moving whole trailing words, never by deleting text.
  if (lines.length > 2 && lines.length % 2 === 1) {
    const tail = lines[lines.length - 1],
      donor = lines[lines.length - 2];
    const minimum = Math.min(6, limit * 0.35);
    while (units(tail.join("")) < minimum && donor.length > 1) {
      const word = donor[donor.length - 1];
      if (
        units(tail.join("") + word) > limit ||
        units(donor.slice(0, -1).join("")) < minimum ||
        /[\r\n]/.test(word)
      )
        break;
      tail.unshift(donor.pop()!);
    }
  }
  const pages: HostCaptionPage[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const page = lines.slice(index, index + 2).map((line) => line.join(""));
    pages.push({ lines: page, weight: Math.max(1, units(page.join(""))) });
  }
  return pages.length ? pages : [{ lines: [""], weight: 1 }];
};

export const hostCaptionPageAtFrame = (
  pages: HostCaptionPage[],
  frame: number,
  durationFrames: number,
) => {
  const duration = Math.max(1, Math.floor(durationFrames));
  const available = Math.max(0, duration - pages.length);
  const total = pages.reduce((sum, page) => sum + page.weight, 0);
  let cumulative = 0,
    index = 0;
  const current = Math.max(0, Math.min(duration - 1, Math.floor(frame)));
  for (let page = 1; page < pages.length; page++) {
    cumulative += pages[page - 1].weight;
    const start =
      duration >= pages.length
        ? page + Math.floor((available * cumulative) / total)
        : Math.floor((duration * cumulative) / total);
    if (current >= start) index = page;
    else break;
  }
  return { index, page: pages[index] };
};
