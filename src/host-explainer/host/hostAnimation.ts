import type { HostPose } from "../demoScript";

export type HostSection = "intro" | "case" | "closing";
export type HostMouth = "closed" | "small" | "open" | "round";

export const hostFrameLayout = (compact = false) => ({
  bottom: compact ? -24 : -36,
  width: compact ? 360 : 560,
  height: compact ? 480 : 747,
});

const mouthSequence: readonly HostMouth[] = [
  "small",
  "open",
  "small",
  "closed",
  "round",
  "small",
  "open",
  "closed",
];

/** Synthetic frame timeline only: no audio or wall-clock state. */
export const hostAnimationState = ({
  frame,
  fps,
  localFrame,
  speakFrom,
  speakTo,
  pose,
  section,
}: {
  frame: number;
  fps: number;
  localFrame: number;
  speakFrom: number;
  speakTo: number;
  pose: HostPose;
  section?: HostSection;
}) => {
  const timelineFrame = (frame * 30) / fps;
  const loopFrame = ((timelineFrame % 240) + 240) % 240;
  const loopTime = loopFrame / 30;
  const blink = [48, 115, 192, 222].some(
    (start) => loopFrame >= start && loopFrame < start + 4,
  );
  const speaking = localFrame >= speakFrom && localFrame < speakTo;
  const mouth = speaking
    ? mouthSequence[
        Math.floor(((localFrame - speakFrom) / fps) * 7) % mouthSequence.length
      ]
    : "closed";

  // The verified master has one pointing hand. Cheer/section cues vary its
  // timing, rather than claiming a second, unavailable full-body gesture.
  const expressive =
    pose === "cheer" || section === "intro" || section === "closing";
  const armTime = (loopTime + (expressive ? 1 : 0)) % 8;
  const arm =
    armTime >= 1.2 && armTime < 3.5
      ? -4 * Math.sin((Math.PI * (armTime - 1.2)) / 2.3)
      : armTime >= 4.4 && armTime < 6.4
        ? 3 * Math.sin((Math.PI * (armTime - 4.4)) / 2)
        : 0;
  return { mouth, blink, arm, speaking };
};
