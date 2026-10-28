import React, { useId } from "react";
import { Img, staticFile } from "remotion";
import type { HostMouth } from "./hostAnimation";
import { femaleHostMouthCell, femaleHostSprite } from "./hostPresenter";
import type { FemaleHostAnimation } from "./femaleHostAnimation";

export const FemaleHost: React.FC<{
  mouth: HostMouth;
  animation: FemaleHostAnimation;
}> = ({ mouth, animation }) => {
  const id = useId().replace(/:/g, "");
  const cell = femaleHostMouthCell(mouth);
  const source = (
    <foreignObject
      x={-cell.x}
      y={-cell.y}
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
  );
  const p = animation.blink;
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
      style={{ overflow: "hidden" }}
    >
      <defs>
        <clipPath id={`${id}-cell`}>
          <rect x={0} y={0} width={cell.width} height={cell.height} />
        </clipPath>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" />
          <stop offset="0.81" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask
          id={`${id}-body`}
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={512}
          height={768}
        >
          <rect width={512} height={768} fill="white" />
          <rect x={104} y={0} width={376} height={350} fill="black" />
        </mask>
        <mask
          id={`${id}-head`}
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={512}
          height={768}
        >
          <rect
            x={104}
            y={0}
            width={376}
            height={430}
            fill={`url(#${id}-fade)`}
          />
        </mask>
        <linearGradient id={`${id}-left-skin`} x1="0" y1="0" x2="0.3" y2="1">
          <stop stopColor="#f3be9a" />
          <stop offset="1" stopColor="#fac9ad" />
        </linearGradient>
        <linearGradient id={`${id}-right-skin`} x1="0" y1="0" x2="0.3" y2="1">
          <stop stopColor="#fbd4b5" />
          <stop offset="1" stopColor="#fac7aa" />
        </linearGradient>
        <filter
          id={`${id}-skin-feather`}
          x="-15%"
          y="-20%"
          width="130%"
          height="140%"
        >
          <feGaussianBlur stdDeviation={1.2} />
        </filter>
        <clipPath id={`${id}-left-closing`}>
          <path
            d={`M175 195 H252 V${212 + 46 * p} Q210 ${220 + 46 * p} 175 ${212 + 46 * p}Z`}
          />
        </clipPath>
        <clipPath id={`${id}-right-closing`}>
          <path
            d={`M263 185 H342 V${195 + 57 * p} Q300 ${203 + 57 * p} 263 ${195 + 57 * p}Z`}
          />
        </clipPath>
      </defs>
      <g
        transform={`translate(${cell.x} ${cell.y})`}
        clipPath={`url(#${id}-cell)`}
      >
        <g data-female-part="anchored-body" mask={`url(#${id}-body)`}>
          {source}
        </g>
        <g
          data-female-part="head"
          transform={`translate(0 ${animation.headY.toFixed(5)}) rotate(${animation.headAngle.toFixed(5)} 270 390)`}
        >
          <g mask={`url(#${id}-head)`}>{source}</g>
          {p > 0 ? (
            <g data-female-part="eyelids" data-blink={p.toFixed(5)}>
              <g clipPath={`url(#${id}-left-closing)`}>
                <path
                  d="M194 216 C211 210 231 215 244 230 L246 249 C226 262 201 258 188 248 L181 232Z"
                  fill={`url(#${id}-left-skin)`}
                  filter={`url(#${id}-skin-feather)`}
                />
              </g>
              <g clipPath={`url(#${id}-right-closing)`}>
                <path
                  d="M280 205 C296 196 321 198 334 211 L332 236 C310 250 284 242 271 232 L270 218Z"
                  fill={`url(#${id}-right-skin)`}
                  filter={`url(#${id}-skin-feather)`}
                />
              </g>
              <path
                d={`M188 235 Q212 ${228 + 20 * p} 238 236`}
                stroke="#654638"
                strokeWidth={1.15}
                strokeLinecap="round"
                fill="none"
                opacity={p}
              />
              <path
                d={`M277 221 Q301 ${211 + 22 * p} 327 215`}
                stroke="#654638"
                strokeWidth={1.15}
                strokeLinecap="round"
                fill="none"
                opacity={p}
              />
            </g>
          ) : null}
        </g>
      </g>
    </svg>
  );
};
