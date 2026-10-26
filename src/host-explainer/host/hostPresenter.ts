import type { HostLocale } from "../hostLocale";
import type { HostMouth } from "./hostAnimation";

export const hostPresenterForLocale = (locale: HostLocale) =>
  locale === "zh" ? "asian-female" : "male";

// Each quadrant contains the same character and framing, varying only the mouth.
export const femaleHostSprite = {
  src: "charactar/asian-female-host-sprite.png",
  width: 1024,
  height: 1536,
} as const;

export const femaleHostMouthCell = (mouth: HostMouth) => {
  const cells = {
    closed: { column: 0, row: 0 },
    small: { column: 1, row: 0 },
    open: { column: 0, row: 1 },
    round: { column: 1, row: 1 },
  } as const;
  const cell = cells[mouth];
  return {
    x: (cell.column * femaleHostSprite.width) / 2,
    y: (cell.row * femaleHostSprite.height) / 2,
    width: femaleHostSprite.width / 2,
    height: femaleHostSprite.height / 2,
  };
};
