import React from "react";
import { Img, interpolate, staticFile } from "remotion";
import type { HostPose } from "../demoScript";

export type HostSection = "intro" | "case" | "closing";

/** Two pose groups: point (PM-1/2) and present (PM-3/4), each closed + open mouth. */
const HOST_POSES = {
  point: { closed: "charactar/PM-1.png", open: "charactar/PM-2.png" },
  present: { closed: "charactar/PM-3.png", open: "charactar/PM-4.png" },
} as const;

const hostFile = (
  pose: HostPose,
  section: HostSection | undefined,
  open: boolean,
) => {
  const group =
    pose === "cheer" || section === "intro" || section === "closing"
      ? HOST_POSES.present
      : HOST_POSES.point;
  return open ? group.open : group.closed;
};

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const mouthAmount = (localFrame: number, speakFrom: number, speakTo: number) => {
  if (localFrame < speakFrom || localFrame >= speakTo) {
    return 0;
  }
  const elapsed = localFrame - speakFrom;
  const wave = (1 - Math.cos((elapsed / 14) * Math.PI)) / 2;
  const edgeIn = interpolate(localFrame, [speakFrom, speakFrom + 8], [0, 1], clamp);
  const edgeOut = interpolate(localFrame, [speakTo - 10, speakTo], [1, 0], clamp);
  return wave * Math.min(edgeIn, edgeOut);
};

export const Host: React.FC<{
  pose: HostPose;
  localFrame: number;
  speakFrom?: number;
  speakTo?: number;
  section?: HostSection;
}> = ({ pose, localFrame, speakFrom = 12, speakTo = 137, section }) => {
  const open = mouthAmount(localFrame, speakFrom, speakTo);
  const frameStyle = {
    position: "absolute" as const,
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain" as const,
  };

  return (
    <div
      style={{
        position: "absolute",
        right: -16,
        bottom: -36,
        width: 560,
        height: 747,
        zIndex: 4,
        pointerEvents: "none",
      }}
    >
      <Img src={staticFile(hostFile(pose, section, false))} style={frameStyle} />
      <Img
        src={staticFile(hostFile(pose, section, true))}
        style={{ ...frameStyle, opacity: open }}
      />
    </div>
  );
};
