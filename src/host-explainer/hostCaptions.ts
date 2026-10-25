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

/** Keep every input character; break at punctuation/word boundaries where possible. */
export const hostCaptionPages = (text: string): HostCaptionPage[] => {
  const limit =
    (HOST_CAPTION_LAYOUT.width - HOST_CAPTION_LAYOUT.paddingX * 2) /
    (HOST_CAPTION_LAYOUT.fontSize * 1.07);
  const original =
    text.match(/[A-Za-z0-9]+(?:[-'’./:+_][A-Za-z0-9]+)*|\s+|[^\s]/gu) || [];
  const tokens = original.flatMap((token) =>
    units(token) > limit ? [...token] : [token],
  );
  const lines: string[] = [];
  let start = 0;
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
    // A closing punctuation mark belongs to the phrase before it.
    if (
      end < tokens.length &&
      /^[，。！？；、,.!?;：:]$/.test(tokens[end]) &&
      total + units(tokens[end]) <= limit + 1
    )
      end++;
    lines.push(tokens.slice(start, end).join(""));
    start = end;
  }
  const pages: HostCaptionPage[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const page = lines.slice(index, index + 2);
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
