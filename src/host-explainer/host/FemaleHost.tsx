import React, { useId } from "react";
import { Img, staticFile } from "remotion";
import type { HostMouth } from "./hostAnimation";
import { femaleHostMouthCell, femaleHostSprite } from "./hostPresenter";

export const FemaleHost: React.FC<{
  mouth: HostMouth;
}> = ({ mouth }) => {
  const clipId = useId();
  const cell = femaleHostMouthCell(mouth);
  // Keep the body anchored; only the mouth sprite changes while speaking.
  return (
    <svg
      data-host-character="asian-female"
      data-host-mouth={mouth}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${cell.x} ${cell.y} ${cell.width} ${cell.height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label="亚洲女性数字人主持人"
      style={{
        overflow: "hidden",
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={cell.x} y={cell.y} width={cell.width} height={cell.height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <foreignObject
          width={femaleHostSprite.width}
          height={femaleHostSprite.height}
        >
          <Img
            src={staticFile(femaleHostSprite.src)}
            style={{
              display: "block",
              width: femaleHostSprite.width,
              height: femaleHostSprite.height,
            }}
          />
        </foreignObject>
      </g>
    </svg>
  );
};
