import type { HostElement } from "./hostTypes";

export type Explanation = Extract<HostElement, { type: "explanation" }>;

export const metricPresentation = (elements: HostElement[]) => {
  const chart = elements.find(
    (element): element is Extract<HostElement, { type: "chart" }> =>
      element.type === "chart",
  );
  if (chart) return { type: "chart" as const, element: chart };
  const explanation = elements.find(
    (element): element is Explanation => element.type === "explanation",
  );
  return explanation
    ? { type: "explanation" as const, element: explanation }
    : { type: "legacy" as const };
};

export const explanationItemWindow = (
  items: Explanation["items"],
  layout: Explanation["layout"],
  frame: number,
  duration: number,
) => {
  const size = layout === "spotlight" ? 1 : layout === "contrast" ? 2 : 4;
  const count = Math.max(1, Math.ceil(items.length / size));
  const index = Math.min(
    count - 1,
    Math.max(0, Math.floor((frame / Math.max(1, duration)) * count)),
  );
  const start = Math.floor((index * duration) / count),
    end = Math.floor(((index + 1) * duration) / count);
  return {
    items: items.slice(index * size, (index + 1) * size),
    index,
    count,
    frame: Math.max(0, frame - start),
    duration: Math.max(1, end - start),
    offset: index * size,
  };
};
const weight = (text: string) =>
  [...text].reduce(
    (sum, char) =>
      sum +
      (/\s/.test(char)
        ? 0.3
        : char.codePointAt(0)! > 255 || /[MWmw@%]/.test(char)
          ? 1
          : 0.65),
    0,
  );

/** Lossless, semantic pages; normal Latin words remain atomic. */
export const explanationTextPages = (text: string, budget: number) => {
  const tokens = (
    text.match(/[A-Za-z0-9]+(?:[-'’./:+_][A-Za-z0-9]+)*|\s+|[^\s]/gu) || []
  ).flatMap((token) => (weight(token) > budget ? [...token] : [token]));
  const pages: string[] = [];
  let start = 0;
  while (start < tokens.length) {
    let end = start,
      total = 0,
      preferred = -1;
    while (end < tokens.length && total + weight(tokens[end]) <= budget) {
      total += weight(tokens[end]);
      if (total > budget * 0.5 && /[，。！？；、,.!?;：:]$/.test(tokens[end]))
        preferred = end + 1;
      end++;
    }
    if (end < tokens.length && preferred > start) end = preferred;
    if (end === start) end++;
    pages.push(tokens.slice(start, end).join(""));
    start = end;
  }
  return pages.length ? pages : [""];
};

export const explanationPageAt = (
  text: string,
  budget: number,
  frame: number,
  duration: number,
) => {
  const pages = explanationTextPages(text, budget);
  const total = pages.reduce((sum, page) => sum + Math.max(1, weight(page)), 0);
  const current = Math.max(0, Math.min(duration - 1, frame));
  let sum = 0,
    index = 0,
    startFrame = 0;
  for (let next = 1; next < pages.length; next++) {
    sum += Math.max(1, weight(pages[next - 1]));
    const boundary =
      duration >= pages.length
        ? next + Math.floor(((duration - pages.length) * sum) / total)
        : (duration * sum) / total;
    if (current >= boundary) {
      index = next;
      startFrame = boundary;
    } else break;
  }
  return { text: pages[index], index, count: pages.length, startFrame };
};

const itemFrom = (text: string) => {
  const parts = explanationTextPages(text, 22);
  return {
    label: parts[0],
    ...(parts.length > 1 ? { detail: parts.slice(1).join("") } : {}),
  };
};

export const explanationForElements = (
  elements: HostElement[],
  narration?: string,
): Explanation => {
  const authored = elements.find(
    (element): element is Explanation => element.type === "explanation",
  );
  if (authored) return authored;
  const cards = elements.filter(
    (element): element is Extract<HostElement, { type: "card" }> =>
      element.type === "card",
  );
  const phrases = [
    ...new Set(
      elements
        .flatMap((element) =>
          element.type === "card"
            ? element.lines?.length
              ? element.lines
              : [element.title]
            : element.type === "text"
              ? [element.text]
              : element.type === "phone"
                ? [element.body, element.action || ""]
                : [],
        )
        .filter(Boolean),
    ),
  ];
  if (phrases.length >= 2)
    return {
      type: "explanation",
      layout: "features",
      title: cards[0]?.title || "",
      items: phrases.map(itemFrom),
    };
  const source = narration || phrases[0] || cards[0]?.title || "";
  return {
    type: "explanation",
    layout: "spotlight",
    title: cards[0]?.title && cards[0].title !== source ? cards[0].title : "",
    items: [itemFrom(source)],
  };
};

export const explanationFocus = (
  frame: number,
  duration: number,
  count: number,
) =>
  Math.min(
    count - 1,
    Math.max(
      0,
      Math.floor((Math.max(0, frame) / (Math.max(1, duration) * 0.78)) * count),
    ),
  );
