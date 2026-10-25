import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { HostPose } from "../demoScript";
import { hostCharacter } from "./character.generated";
import {
  hostAnimationState,
  hostFrameLayout,
  type HostSection,
} from "./hostAnimation";

export type { HostSection } from "./hostAnimation";

const mouths = ["closed", "small", "open", "round"] as const;

export const Host: React.FC<{
  pose: HostPose;
  localFrame: number;
  speakFrom?: number;
  speakTo?: number;
  section?: HostSection;
  compact?: boolean;
}> = ({
  pose,
  localFrame,
  speakFrom = 12,
  speakTo = 137,
  section,
  compact = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = hostAnimationState({
    frame,
    fps,
    localFrame,
    speakFrom,
    speakTo,
    pose,
    section,
  });

  return (
    <div
      data-host-presenter
      style={{
        position: "absolute",
        right: -16,
        ...hostFrameLayout(compact),
        zIndex: 4,
        pointerEvents: "none",
      }}
    >
      <svg
        data-host-character="svg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={hostCharacter.viewBox}
        width="100%"
        height="100%"
        role="img"
        aria-label="程序员数字人主持人"
      >
        {/* Trusted build-time paths; these strings never change between frames. */}
        <g
          data-host-part="body"
          dangerouslySetInnerHTML={{ __html: hostCharacter.body }}
        />
        <g
          data-host-part="pointing-arm"
          transform={`rotate(${state.arm.toFixed(4)} 147 894)`}
          dangerouslySetInnerHTML={{ __html: hostCharacter.arm }}
        />
        <g
          data-host-part="eyelids"
          fill="#FFD0A0"
          stroke="#342821"
          strokeWidth={5}
          strokeLinecap="round"
          visibility={state.blink ? "visible" : "hidden"}
          dangerouslySetInnerHTML={{ __html: hostCharacter.eyelids }}
        />
        <g data-host-part="mouth" transform={hostCharacter.mouthTransform}>
          {mouths.map((mouth) => (
            <g
              key={mouth}
              data-host-mouth={mouth}
              visibility={state.mouth === mouth ? "visible" : "hidden"}
              dangerouslySetInnerHTML={{ __html: hostCharacter.mouths[mouth] }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
