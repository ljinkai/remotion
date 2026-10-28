const smooth = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
export const FEMALE_BLINK_STARTS = [2.3, 6.7, 10.9, 16.1, 21.4, 26.8] as const;
export const femaleHostAnimation = ({
  frame,
  fps,
  localFrame,
  speakFrom,
  speakTo,
  enabled = true,
}: {
  frame: number;
  fps: number;
  localFrame: number;
  speakFrom: number;
  speakTo: number;
  enabled?: boolean;
}) => {
  const time = Math.max(0, frame / fps),
    phase = time % 31;
  let blink = 0;
  for (const start of FEMALE_BLINK_STARTS) {
    const elapsed = phase - start;
    if (elapsed >= 0 && elapsed <= 0.28)
      blink =
        elapsed < 0.1
          ? smooth(elapsed / 0.1)
          : elapsed < 0.125
            ? 1
            : 1 - smooth((elapsed - 0.125) / 0.155);
  }
  const speaking = localFrame >= speakFrom && localFrame < speakTo;
  const intensity = speaking
    ? smooth((localFrame - speakFrom) / fps / 0.25) *
      smooth((speakTo - localFrame) / fps / 0.25)
    : 0;
  // Small one-off listening/nod events share the absolute timeline, never restart with a beat.
  let nod = 0;
  for (const start of [4.8, 12.6, 20.2, 28.4]) {
    const elapsed = phase - start;
    if (elapsed > 0 && elapsed < 1.4)
      nod = Math.sin((Math.PI * elapsed) / 1.4) ** 2;
  }
  const amount = 0.4 + 0.6 * intensity;
  return {
    blink: enabled ? blink : 0,
    headAngle: enabled ? 0.18 * nod * amount : 0,
    headY: enabled ? 0.65 * nod * amount : 0,
    intensity,
    speaking,
    bodyX: 0,
    bodyY: 0,
    bodyAngle: 0,
    bodyScale: 1,
  };
};
export type FemaleHostAnimation = ReturnType<typeof femaleHostAnimation>;
