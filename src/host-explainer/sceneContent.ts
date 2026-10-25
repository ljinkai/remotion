import type { HostElement, HostSceneType } from "./hostTypes";

export const deriveHostScene = (
  elements: HostElement[],
  scene?: HostSceneType,
): HostSceneType => {
  if (scene) return scene;
  if (elements.some((item) => item.type === "relationship"))
    return "relationship";
  if (elements.some((item) => item.type === "chart")) return "metric";
  if (elements.some((item) => item.type === "image")) return "product";
  if (elements.some((item) => item.type === "bar")) return "metric";
  if (elements.some((item) => item.type === "phone")) return "steps";
  return "statement";
};

export const uniquePhrases = (values: (string | undefined)[]) => [
  ...new Set(
    values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  ),
];

export const scenePhrases = (elements: HostElement[]) =>
  uniquePhrases(
    elements.flatMap((item) => {
      if (item.type === "card")
        return item.lines?.length ? item.lines : [item.title];
      if (item.type === "text") return [item.text];
      if (item.type === "phone") return [item.body, item.action];
      if (item.type === "bar") return [item.label, item.note];
      return [];
    }),
  );

export const sceneSteps = (elements: HostElement[]) => {
  const lines = elements.flatMap((item) =>
    item.type === "card" ? (item.lines ?? []) : [],
  );
  const phone = elements.flatMap((item) =>
    item.type === "phone" ? [item.body, item.action] : [],
  );
  return uniquePhrases(
    lines.length >= 2 ? lines : phone.length ? phone : scenePhrases(elements),
  ).slice(0, 3);
};

/** Prefer authored text with its original currency/unit over a bare numeric bar. */
export const sceneMetric = (elements: HostElement[]) => {
  const bars = elements.filter(
    (item): item is Extract<HostElement, { type: "bar" }> =>
      item.type === "bar",
  );
  const texts = elements.filter(
    (item): item is Extract<HostElement, { type: "text" }> =>
      item.type === "text" && /\d/.test(item.text),
  );
  const numericText = texts.find((item) => item.size === "xl") ?? texts[0];
  const first = bars[0];
  return {
    value: numericText?.text ?? (first ? first.to.toLocaleString("en-US") : ""),
    label: first?.label ?? "",
    note: first?.note,
    additional: bars.slice(1),
  };
};
