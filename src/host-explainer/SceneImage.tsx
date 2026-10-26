import { useHostLabels } from "./hostLocale";
import React, { useState } from "react";
import { Img } from "remotion";
import { assetSrc } from "../Composition";
import type { HostElement } from "./hostTypes";
import { theme } from "./theme";

export type ImageElement = Extract<HostElement, { type: "image" }>;

/** A failed Img must unmount so Remotion can release its pending frame. */
export const SceneImage: React.FC<{
  image: ImageElement;
  scale?: number;
  style?: React.CSSProperties;
  onDimensions?: (width: number, height: number) => void;
  onFailure?: () => void;
}> = ({ image, scale = 1, style, onDimensions, onFailure }) => {
  const labels = useHostLabels();
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === image.src) {
    return (
      <div
        data-scene-image-fallback
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          color: theme.muted,
          padding: 28,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 700, color: theme.ink }}>
          {image.caption || labels.source}
        </div>
        <div style={{ fontSize: 24 }}>{labels.unavailable}</div>
      </div>
    );
  }
  return (
    <Img
      data-scene-image={image.src}
      src={assetSrc(image.src)}
      alt={image.caption || labels.source}
      maxRetries={1}
      onError={() => {
        setFailedSource(image.src);
        onFailure?.();
      }}
      onLoad={(event) =>
        onDimensions?.(
          event.currentTarget.naturalWidth,
          event.currentTarget.naturalHeight,
        )
      }
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
        transform: `scale(${scale})`,
        ...style,
      }}
    />
  );
};
