import React from "react";
import { useCurrentFrame } from "remotion";

export const PlayButton: React.FC<{ style?: React.CSSProperties }> = ({
  style,
}) => {
  const frame = useCurrentFrame();
  const scale = 1.03 + Math.sin(frame / 6) * 0.03;

  return (
    <div
      style={{
        width: 88,
        height: 88,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scale})`,
        filter: "drop-shadow(0 8px 0 rgba(22,22,22,0.08))",
        ...style,
      }}
    >
      <svg width="88" height="88" viewBox="0 0 88 88">
        <path
          d="M24 16 L72 44 L24 72 Z"
          fill="#fffcf8"
          stroke="#161616"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
