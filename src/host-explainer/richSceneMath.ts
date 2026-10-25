import type { HostBeat, HostElement } from "./hostTypes";
import { deriveHostScene } from "./sceneContent";

export const chartPresentation = (
  chart: Extract<HostElement, { type: "chart" }>,
) => ({
  kind:
    chart.chartType === "single" || chart.data.length < 2
      ? ("single" as const)
      : chart.chartType,
  maximum:
    chart.chartType === "proportion"
      ? 100
      : Math.max(1, ...chart.data.map((point) => point.value)),
  lowerBounds: chart.data.flatMap((point, index) =>
    point.display?.includes("+") ? [index] : [],
  ),
  unit: chart.unit,
});

export const sceneIdentity = (beat: HostBeat) => {
  const kind = deriveHostScene(beat.elements, beat.scene);
  if (kind === "product")
    return `product:${beat.caseIndex}:${beat.elements
      .filter((item) => item.type === "image")
      .map((item) => item.src)
      .join("|")}`;
  const relation = beat.elements.find((item) => item.type === "relationship");
  if (kind === "relationship" && relation?.type === "relationship")
    return `relationship:${beat.caseIndex}:${relation.nodes.join("|")}`;
  return null;
};

export const continuousSceneWindow = (
  beats: HostBeat[],
  index: number,
  frame: number,
  fps: number,
) => {
  const identity = sceneIdentity(beats[index]);
  let start = index,
    end = index;
  if (identity) {
    while (start > 0 && sceneIdentity(beats[start - 1]) === identity) start--;
    while (end < beats.length - 1 && sceneIdentity(beats[end + 1]) === identity)
      end++;
  }
  const from = Math.round((beats[start].startMs * fps) / 1000),
    to = Math.round((beats[end].endMs * fps) / 1000);
  return { frame: Math.max(0, frame - from), duration: Math.max(1, to - from) };
};

export const relationshipLabelLines = (label: string) => {
  const lines: string[] = [];
  let line = "",
    weight = 0;
  for (const letter of label) {
    const size = letter.charCodeAt(0) > 255 ? 1 : 0.55;
    if (weight + size > 6 && line) {
      lines.push(line.trim());
      line = "";
      weight = 0;
    }
    line += letter;
    weight += size;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
};

export const imageFocusGeometry = (
  naturalWidth: number,
  naturalHeight: number,
  width: number,
  height: number,
  focus: { x: number; y: number; width: number; height: number },
  amount: number,
) => {
  const fit = Math.min(width / naturalWidth, height / naturalHeight);
  const imageWidth = naturalWidth * fit,
    imageHeight = naturalHeight * fit;
  const targetScale = Math.min(
    8,
    width / (imageWidth * focus.width),
    height / (imageHeight * focus.height),
  );
  const left = (width - imageWidth) / 2,
    top = (height - imageHeight) / 2;
  const focusLeft =
    (width - imageWidth * focus.width * targetScale) / 2 -
    imageWidth * focus.x * targetScale;
  const focusTop =
    (height - imageHeight * focus.height * targetScale) / 2 -
    imageHeight * focus.y * targetScale;
  return {
    imageWidth,
    imageHeight,
    scale: 1 + (targetScale - 1) * amount,
    left: left + (focusLeft - left) * amount,
    top: top + (focusTop - top) * amount,
  };
};
