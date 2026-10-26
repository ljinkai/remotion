import type { HostBeat, HostCaseRef, HostElement } from "./hostTypes";

/** Rotate source images over the whole case audio, independently of sentence count.
 * Narration beats and subtitle timing stay intact; only the displayed image changes.
 */
export const postGalleryElements = (
  beat: HostBeat,
  beats: HostBeat[],
  cases: HostCaseRef[],
  timeMs: number,
): HostElement[] => {
  if (beat.section !== "case" || beat.caseIndex === null) return beat.elements;
  const sources = [...new Set(cases[beat.caseIndex]?.images || [])];
  if (sources.length < 2) return beat.elements;
  const caseBeats = beats.filter(
    (item) => item.section === "case" && item.caseIndex === beat.caseIndex,
  );
  const start = Math.min(...caseBeats.map((item) => item.startMs));
  const end = Math.max(...caseBeats.map((item) => item.endMs));
  const progress = Math.max(0, Math.min(1, (timeMs - start) / Math.max(1, end - start)));
  const src = sources[Math.min(sources.length - 1, Math.floor(progress * sources.length))];
  // Image-specific crops/captions must never be carried onto another source.
  const original = beat.elements.find(
    (element) => element.type === "image" && element.src === src,
  );
  const image: HostElement = original || { type: "image", src };
  return [image, ...beat.elements.filter((element) => element.type !== "image")];
};
