import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import type { HostElement, HostSceneType } from "./hostTypes";
import { HostIcon } from "./icons";
import { SceneImage, type ImageElement } from "./SceneImage";
import {
  deriveHostScene,
  sceneMetric,
  scenePhrases,
  sceneSteps,
} from "./sceneContent";
import { sanitizeSvg } from "./sanitizeSvg";
import { theme } from "./theme";
import { EvidenceChart } from "./EvidenceChart";
import { SourceImageFocus } from "./SourceImageFocus";
import { RelationshipScene } from "./RelationshipScene";
import { ExplanationScene } from "./ExplanationScene";
import {
  explanationForElements,
  metricPresentation,
} from "./explanationContent";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const reveal = (frame: number, start: number, length: number) =>
  interpolate(frame, [start, start + length], [0, 1], clamp);
const shortStyle: React.CSSProperties = {
  overflowWrap: "anywhere",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
};

const ImageMount: React.FC<{
  images: ImageElement[];
  height: number;
  frame: number;
  fps: number;
  hero?: boolean;
}> = ({ images, height, frame, fps, hero = false }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        images.length === 1
          ? "1fr"
          : images.length === 2
            ? "1fr 1fr"
            : "repeat(2,1fr)",
      gap: 18,
      height,
    }}
  >
    {images.map((image, index) => (
      <div
        key={`${image.src}-${index}`}
        style={{
          minHeight: 0,
          minWidth: 0,
          background: theme.card,
          border: `2px solid ${theme.ink}`,
          borderRadius: 18,
          boxShadow: hero ? "0 12px 0 rgba(22,22,22,.06)" : "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 38,
            flexShrink: 0,
            display: "flex",
            gap: 6,
            alignItems: "center",
            padding: "0 14px",
            borderBottom: `1px solid ${theme.line}`,
          }}
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: dot === 0 ? theme.accent : theme.line,
              }}
            />
          ))}
          {image.caption ? (
            <span
              style={{
                fontSize: 15,
                marginLeft: 8,
                color: theme.muted,
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                overflow: "hidden",
              }}
            >
              {image.caption}
            </span>
          ) : null}
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: hero ? 22 : 14,
            opacity: reveal(frame, index * 3, 12),
          }}
        >
          <SceneImage
            image={image}
            scale={
              hero
                ? interpolate(
                    frame,
                    [0, Math.max(fps * 3, 1)],
                    [1, 1.014],
                    clamp,
                  )
                : 1
            }
          />
        </div>
      </div>
    ))}
  </div>
);

const Symbols: React.FC<{ elements: HostElement[] }> = ({ elements }) => {
  const icons = elements.filter(
    (item): item is Extract<HostElement, { type: "icon" }> =>
      item.type === "icon",
  );
  const svgs = elements.filter(
    (item): item is Extract<HostElement, { type: "svg" }> =>
      item.type === "svg",
  );
  if (!icons.length && !svgs.length) return null;
  return (
    <div
      style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 24 }}
    >
      {icons.map((item, index) => (
        <HostIcon key={index} name={item.name} size={52} />
      ))}
      {svgs.map((item, index) => (
        <div
          key={index}
          className="hostSceneSvg"
          style={{ height: 130, maxWidth: 340 }}
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(item.markup) }}
        />
      ))}
    </div>
  );
};

const ProductScene: React.FC<{
  elements: HostElement[];
  images: ImageElement[];
  frame: number;
  fps: number;
  expanded?: boolean;
}> = ({ elements, images, frame, fps, expanded }) => {
  const phrases = scenePhrases(elements).slice(0, 2);
  if (!images.length) {
    return (
      <StatementScene elements={elements} images={[]} frame={frame} fps={fps} />
    );
  }
  return (
    <div
      style={{
        opacity: reveal(frame, 0, 12),
        transform: `translateY(${interpolate(frame, [0, 18], [16, 0], clamp)}px)`,
      }}
    >
      {images.length === 1 ? (
        <SourceImageFocus
          key={images[0].src}
          image={images[0]}
          frame={frame}
          fps={fps}
          height={expanded ? 920 : 690}
        />
      ) : images.length ? (
        <ImageMount
          images={images}
          height={phrases.length ? 690 : 770}
          frame={frame}
          fps={fps}
          hero
        />
      ) : null}
      {phrases.length ? (
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 28,
            alignItems: "flex-start",
            opacity: reveal(frame, Math.round(fps * 0.45), 12),
          }}
        >
          <span
            style={{
              height: 42,
              width: 5,
              background: theme.accent,
              flexShrink: 0,
            }}
          />
          <div style={{ display: "flex", gap: 24, flex: 1 }}>
            {phrases.map((phrase, index) => (
              <div
                key={phrase}
                style={{
                  ...shortStyle,
                  flex: 1,
                  fontSize: phrases.length > 1 ? 31 : 39,
                  fontWeight: index === 0 ? 750 : 600,
                  lineHeight: 1.3,
                  color: index === 0 ? theme.ink : theme.muted,
                }}
              >
                {phrase}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const MetricScene: React.FC<{
  elements: HostElement[];
  images: ImageElement[];
  frame: number;
  fps: number;
  narration?: string;
  durationFrames?: number;
}> = ({ elements, images, frame, fps, narration, durationFrames }) => {
  const presentation = metricPresentation(elements);
  const chart =
    presentation.type === "chart" ? presentation.element : undefined;
  if (chart?.type === "chart") {
    const textElements = elements.filter(
      (element): element is Extract<HostElement, { type: "text" }> =>
        element.type === "text",
    );
    const context =
      textElements.find((element) => element.size === "xl") ??
      textElements.find((element) => /\d/.test(element.text));
    const annualContext =
      /MRR/i.test(chart.unit) &&
      /年收入|年度|ARR|annual/i.test(narration || "");
    return (
      <div>
        {annualContext ? (
          <div style={{ fontSize: 23, color: theme.muted, marginBottom: 20 }}>
            本句：{/ARR/i.test(narration || "") ? "年度 ARR" : "年度收入"}
            {context?.type === "text" ? ` ${context.text}` : ""} · 下图：月度
            MRR 阶段
          </div>
        ) : null}
        <EvidenceChart
          chart={chart}
          frame={frame}
          fps={fps}
          height={images.length ? 620 : 800}
        />
        {!annualContext &&
        context?.type === "text" &&
        !chart.data.some((point) => point.display === context.text) ? (
          <div style={{ fontSize: 23, color: theme.muted, marginTop: 18 }}>
            本句披露：{context.text}
          </div>
        ) : null}
        {images.length ? (
          <div style={{ marginTop: 22 }}>
            <ImageMount images={images} height={210} frame={frame} fps={fps} />
          </div>
        ) : null}
      </div>
    );
  }
  if (presentation.type === "explanation")
    return (
      <StatementScene
        elements={elements}
        images={images}
        frame={frame}
        fps={fps}
        narration={narration}
        durationFrames={durationFrames}
        emphasis
      />
    );
  const metric = sceneMetric(elements);
  const facts = scenePhrases(elements)
    .filter(
      (text) =>
        text !== metric.value && text !== metric.label && text !== metric.note,
    )
    .slice(0, 2);
  const hasImages = images.length > 0;
  const label = metric.label !== metric.value ? metric.label : "";
  const note =
    metric.note !== metric.value && metric.note !== metric.label
      ? metric.note
      : "";
  return (
    <div>
      <div
        style={{
          minHeight: hasImages ? 240 : 530,
          padding: "18px 12px 20px",
          borderTop: `3px solid ${theme.ink}`,
          position: "relative",
          opacity: reveal(frame, 0, 10),
        }}
      >
        {label ? (
          <div
            style={{
              fontSize: hasImages ? 24 : 28,
              fontWeight: 650,
              color: theme.muted,
              marginBottom: 14,
            }}
          >
            {label}
          </div>
        ) : null}
        <div
          style={{
            fontSize:
              metric.value.length > 16
                ? 76
                : metric.value.length > 10
                  ? 110
                  : hasImages
                    ? 124
                    : 158,
            fontWeight: 850,
            letterSpacing: "-.065em",
            lineHeight: 1.02,
            overflowWrap: "anywhere",
            color: theme.accent,
            transform: `translateX(${interpolate(frame, [0, Math.round(fps * 0.55)], [-22, 0], clamp)}px)`,
          }}
        >
          {metric.value || facts.shift()}
        </div>
        <div
          style={{
            height: 7,
            width: `${reveal(frame, Math.round(fps * 0.3), Math.round(fps * 0.55)) * 100}%`,
            background: theme.accent,
            marginTop: 18,
          }}
        />
        {note ? (
          <div
            style={{
              fontSize: hasImages ? 24 : 28,
              marginTop: 14,
              fontWeight: 650,
              color: theme.muted,
            }}
          >
            {note}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            gap: 26,
            marginTop: 14,
            opacity: reveal(frame, Math.round(fps * 0.65), 12),
          }}
        >
          {facts.map((fact) => (
            <div
              key={fact}
              style={{
                ...shortStyle,
                fontSize: hasImages ? 26 : 30,
                lineHeight: 1.25,
                fontWeight: 650,
              }}
            >
              {fact}
            </div>
          ))}
        </div>
      </div>
      {hasImages ? (
        <ImageMount
          images={images}
          height={facts.length || note ? 360 : 460}
          frame={frame}
          fps={fps}
        />
      ) : null}
      {metric.additional.length ? (
        <div style={{ display: "flex", gap: 30, marginTop: 25 }}>
          {metric.additional.map((bar, index) => (
            <div
              key={index}
              style={{
                borderLeft: `4px solid ${theme.accent}`,
                paddingLeft: 18,
                fontSize: 25,
              }}
            >
              <strong>{bar.to.toLocaleString("en-US")}</strong> {bar.label}
              {bar.note ? ` · ${bar.note}` : ""}
            </div>
          ))}
        </div>
      ) : null}
      <Symbols elements={elements} />
    </div>
  );
};

const StepsScene: React.FC<{
  elements: HostElement[];
  images: ImageElement[];
  frame: number;
  fps: number;
}> = ({ elements, images, frame, fps }) => {
  const steps = sceneSteps(elements);
  const phone = elements.find((item) => item.type === "phone");
  const hasImages = images.length > 0;
  return (
    <div>
      {phone?.type === "phone" ? (
        <div
          style={{
            fontSize: 27,
            fontWeight: 700,
            color: theme.muted,
            marginBottom: 24,
          }}
        >
          {phone.title}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: hasImages ? 14 : 24,
        }}
      >
        {steps.map((step, index) => {
          const progress = reveal(
            frame,
            index * Math.round(fps * 0.38),
            Math.round(fps * 0.28),
          );
          return (
            <React.Fragment key={`${step}-${index}`}>
              {index > 0 ? (
                <div
                  style={{
                    marginLeft: 29,
                    height: hasImages ? 20 : 35,
                    overflow: "hidden",
                    color: theme.accent,
                    fontSize: 32,
                    lineHeight: "28px",
                    opacity: progress,
                  }}
                >
                  ↓
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  gap: 25,
                  alignItems: "center",
                  opacity: progress,
                  transform: `translateX(${(1 - progress) * 28}px)`,
                  borderBottom: `1px solid ${theme.line}`,
                  paddingBottom: hasImages ? 14 : 28,
                }}
              >
                <div
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 18,
                    background: index === 0 ? theme.accent : theme.ink,
                    color: "white",
                    fontSize: 25,
                    fontWeight: 750,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div
                  style={{
                    ...shortStyle,
                    fontSize: hasImages ? 36 : 46,
                    fontWeight: 750,
                    lineHeight: 1.22,
                  }}
                >
                  {step}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {hasImages ? (
        <div style={{ marginTop: 25 }}>
          <ImageMount images={images} height={310} frame={frame} fps={fps} />
        </div>
      ) : null}
      <Symbols elements={elements} />
    </div>
  );
};

const StatementScene: React.FC<{
  elements: HostElement[];
  images: ImageElement[];
  frame: number;
  fps: number;
  durationFrames?: number;
  narration?: string;
  emphasis?: boolean;
}> = ({
  elements,
  images,
  frame,
  fps,
  durationFrames = 120,
  narration,
  emphasis,
}) => {
  const explanation = explanationForElements(elements, narration);
  return (
    <div>
      <ExplanationScene
        emphasis={emphasis}
        explanation={explanation}
        frame={frame}
        fps={fps}
        duration={durationFrames}
        height={images.length ? 640 : 850}
      />
      {images.length ? (
        <div style={{ marginTop: 20 }}>
          <ImageMount images={images} height={210} frame={frame} fps={fps} />
        </div>
      ) : null}
    </div>
  );
};

export const ElementStage: React.FC<{
  elements: HostElement[];
  localFrame: number;
  durationFrames: number;
  scene?: HostSceneType;
  sceneFrame?: number;
  sceneDuration?: number;
  expanded?: boolean;
  narration?: string;
}> = ({
  elements,
  localFrame,
  durationFrames,
  scene,
  sceneFrame,
  sceneDuration,
  expanded,
  narration,
}) => {
  const { fps } = useVideoConfig();
  const kind = deriveHostScene(elements, scene);
  const images = elements.filter(
    (item): item is ImageElement => item.type === "image",
  );
  const visualFrame = sceneFrame ?? localFrame;
  const visualDuration = sceneDuration ?? durationFrames;
  const fade = interpolate(
    visualFrame,
    [Math.max(0, visualDuration - 9), Math.max(1, visualDuration - 1)],
    [1, 0],
    clamp,
  );
  const shared = {
    elements,
    images,
    frame: visualFrame,
    fps,
    expanded,
    narration,
    durationFrames: visualDuration,
  };
  const relationship = elements.find(
    (element) => element.type === "relationship",
  );
  return (
    <div
      data-host-scene={kind}
      style={{
        position: "absolute",
        left: 64,
        top: expanded ? 340 : 360,
        width: 952,
        height: expanded ? 1050 : 900,
        opacity: fade,
      }}
    >
      <style>{`.hostSceneSvg svg{width:100%;height:100%;display:block}`}</style>
      {kind === "relationship" && relationship?.type === "relationship" ? (
        <>
          <RelationshipScene
            relation={relationship}
            frame={visualFrame}
            localFrame={localFrame}
            fps={fps}
            height={images.length ? 700 : 880}
          />
          {images.length ? (
            <ImageMount
              images={images}
              height={180}
              frame={visualFrame}
              fps={fps}
            />
          ) : null}
        </>
      ) : kind === "product" ? (
        <ProductScene {...shared} />
      ) : kind === "metric" ? (
        <MetricScene {...shared} />
      ) : kind === "steps" ? (
        <StepsScene {...shared} />
      ) : (
        <StatementScene {...shared} />
      )}
    </div>
  );
};
