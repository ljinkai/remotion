import type { HostBeat } from "../host-explainer/hostTypes";

export const KNOWLEDGE_VIDEO = { width: 1920, height: 1080, fps: 30 } as const;
export const KNOWLEDGE_STAGE = { left: 72, top: 248, width: 1328, height: 604 } as const;
export const KNOWLEDGE_CAPTIONS = { left: 72, top: 900, width: 1328, height: 116 } as const;

export const knowledgeBeatIndex = (beats: HostBeat[], frame: number, fps = 30) => {
  const ms = (Math.max(0, frame) * 1000) / fps;
  const active = beats.findIndex((beat) => ms >= beat.startMs && ms < beat.endMs);
  if (active >= 0) return active;
  const upcoming = beats.findIndex((beat) => ms < beat.startMs);
  return upcoming >= 0 ? Math.max(0, upcoming - 1) : Math.max(0, beats.length - 1);
};

export const knowledgeDuration = (beats: HostBeat[] = [], fps = 30) =>
  Math.max(1, Math.ceil((Math.max(0, ...beats.map((beat) => Number(beat.endMs) || 0)) * fps) / 1000));
