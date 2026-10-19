import React from "react";
import { Img, staticFile } from "remotion";
import type { HostPose } from "../demoScript";

const speakingNow = (
  localFrame: number,
  mouthOpen: boolean | undefined,
) => {
  if (mouthOpen === undefined) {
    return localFrame >= 12 && localFrame <= 137;
  }
  return mouthOpen;
};

const hostFile = (pose: HostPose, speaking: boolean, globalFrame: number) => {
  const open = speaking && Math.floor(globalFrame / 6) % 2 === 1;
  if (pose === "cheer") {
    return open ? "host/cheer-open.png" : "host/cheer.png";
  }
  return open ? "host/point-open.png" : "host/point.png";
};

export const Host: React.FC<{
  pose: HostPose;
  localFrame: number;
  globalFrame: number;
  mouthOpen?: boolean;
}> = ({ pose, localFrame, globalFrame, mouthOpen }) => {
  const bob = Math.sin(globalFrame / 8) * 5;
  const src = hostFile(pose, speakingNow(localFrame, mouthOpen), globalFrame);

  return (
    <div
      style={{
        position: "absolute",
        right: -16,
        bottom: -36,
        width: 560,
        height: 747,
        zIndex: 4,
        transform: `translateY(${bob}px)`,
        pointerEvents: "none",
      }}
    >
      <Img
        src={staticFile(src)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
};
