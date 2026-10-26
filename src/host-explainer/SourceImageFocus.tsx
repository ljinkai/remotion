import { useHostLabels } from "./hostLocale";
import React, { useState } from "react";
import { Easing, interpolate } from "remotion";
import { SceneImage, type ImageElement } from "./SceneImage";
import { imageFocusGeometry } from "./richSceneMath";
import { theme } from "./theme";

export const SourceImageFocus: React.FC<{
  image: ImageElement;
  frame: number;
  fps: number;
  width?: number;
  height?: number;
}> = ({ image, frame, fps, width = 952, height = 870 }) => {
  const labels = useHostLabels();
  const [dimensions, setDimensions] = useState({ width: 1000, height: 1200 });
  const [failed, setFailed] = useState(false);
  const focus = image.focus || { x: 0, y: 0, width: 1, height: 0.48 };
  const amount = failed
    ? 0
    : interpolate(frame, [fps * 0.65, fps * 1.6], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
  const viewportHeight = height - 52;
  const geometry = imageFocusGeometry(
    dimensions.width,
    dimensions.height,
    width - 4,
    viewportHeight,
    focus,
    amount,
  );
  const thumb = imageFocusGeometry(
    dimensions.width,
    dimensions.height,
    136,
    160,
    focus,
    0,
  );
  return (
    <div
      data-source-focus={amount > 0.05 ? "detail" : "overview"}
      style={{
        width,
        height,
        border: `2px solid ${theme.ink}`,
        borderRadius: 20,
        overflow: "hidden",
        background: theme.card,
        boxShadow: "0 12px 0 rgba(22,22,22,.06)",
      }}
    >
      <div
        style={{
          height: 50,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          borderBottom: `1px solid ${theme.line}`,
          fontSize: 21,
          color: theme.muted,
        }}
      >
        <span
          style={{
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {image.caption || labels.source}
        </span>
        <span
          style={{
            color: amount > 0.05 ? theme.accent : theme.ink,
            fontWeight: 750,
            whiteSpace: "nowrap",
          }}
        >
          {amount > 0.05
            ? `${labels.detail}${focus.label ? ` · ${focus.label}` : ""}`
            : labels.overview}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: viewportHeight,
          overflow: "hidden",
          background: "#fffdf9",
        }}
      >
        {failed ? (
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
              fontSize: 28,
            }}
          >
            <strong style={{ fontSize: 40, color: theme.ink }}>
              {image.caption || labels.source}
            </strong>
            <span>{labels.unavailable}</span>
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: geometry.imageWidth,
              height: geometry.imageHeight,
              transformOrigin: "0 0",
              transform: `translate(${geometry.left}px,${geometry.top}px) scale(${geometry.scale})`,
            }}
          >
            <SceneImage
              image={image}
              onFailure={() => setFailed(true)}
              onDimensions={(w, h) =>
                setDimensions((current) =>
                  current.width === w && current.height === h
                    ? current
                    : { width: w, height: h },
                )
              }
            />
          </div>
        )}
        {amount > 0.05 ? (
          <div
            style={{
              position: "absolute",
              right: 18,
              bottom: 18,
              padding: 10,
              border: `2px solid ${theme.ink}`,
              borderRadius: 12,
              background: theme.paper,
              boxShadow: "0 5px 20px #0002",
              opacity: amount,
            }}
          >
            <div
              style={{
                position: "relative",
                width: 136,
                height: 160,
                background: "white",
              }}
            >
              <SceneImage image={image} />
              <div
                style={{
                  position: "absolute",
                  left: thumb.left + thumb.imageWidth * focus.x,
                  top: thumb.top + thumb.imageHeight * focus.y,
                  width: thumb.imageWidth * focus.width,
                  height: thumb.imageHeight * focus.height,
                  border: `2px solid ${theme.accent}`,
                  background: "rgba(255,77,28,.08)",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 17,
                color: theme.muted,
                textAlign: "center",
                paddingTop: 6,
              }}
            >
              {labels.position}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
