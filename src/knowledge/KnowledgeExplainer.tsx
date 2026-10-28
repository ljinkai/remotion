import React from "react";
import { KnowledgeVisualScene } from "./KnowledgeVisualScene";
import {
  knowledgeVisualPlan,
  knowledgeChapterWindow,
  type KnowledgeVisualPlan,
} from "./knowledgeVisualPlan";
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig } from "remotion";
import { assetSrc } from "../Composition";
import type { HostBeat, HostElement } from "../host-explainer/hostTypes";
import { Host } from "../host-explainer/host/Host";
import { HostLocaleProvider } from "../host-explainer/hostLocale";
import {
  hostCaptionPages,
  hostCaptionPageAtFrame,
  HOST_CAPTION_APPEARANCE,
} from "../host-explainer/hostCaptions";
import {
  ExplanationScene,
  PagedText,
} from "../host-explainer/ExplanationScene";
import { explanationForElements } from "../host-explainer/explanationContent";
import { EvidenceChart } from "../host-explainer/EvidenceChart";
import { RelationshipScene } from "../host-explainer/RelationshipScene";
import { SourceImageFocus } from "../host-explainer/SourceImageFocus";
import { theme } from "../host-explainer/theme";
import {
  KNOWLEDGE_CAPTIONS,
  KNOWLEDGE_STAGE,
  knowledgeBeatIndex,
} from "./knowledgeLayout";

type KnowledgeBeat = HostBeat & {
  chapterVisual?: Extract<HostElement, { type: "explanation" }>;
  chapterFocus?: number;
};
export type KnowledgeChapter = {
  id?: string;
  title: string;
  narration?: string;
  kind?: string;
  sourceNote?: string;
  image?: string;
  startMs?: number;
  endMs?: number;
};
export type KnowledgeVideoProps = {
  contentMode?: "knowledge";
  templateId?: string;
  aspect?: string;
  locale?: "zh" | "en";
  knowledge?: { title: string; chapters: KnowledgeChapter[]; source?: string };
  cases?: { title: string; sourceBody?: string }[];
  beats?: KnowledgeBeat[];
  narrationAudioSrc?: string;
};

const KnowledgeSpotlight: React.FC<{
  explanation: ReturnType<typeof explanationForElements>;
  frame: number;
  duration: number;
}> = ({ explanation, frame, duration }) => (
  <div
    data-knowledge-spotlight
    style={{ height: "100%", display: "flex", flexDirection: "column" }}
  >
    <div
      style={{
        height: 70,
        flexShrink: 0,
        borderBottom: `2px solid ${theme.ink}`,
        fontSize: 24,
        color: theme.muted,
        marginBottom: 20,
      }}
    >
      <PagedText
        text={explanation.title}
        budget={84}
        frame={frame}
        duration={duration}
      />
    </div>
    <div
      style={{
        flex: 1,
        minHeight: 0,
        borderLeft: `7px solid ${theme.accent}`,
        background: "linear-gradient(120deg,#fff2e9,transparent)",
        padding: "24px 36px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 24,
      }}
    >
      {explanation.items.map((item, index) => (
        <React.Fragment key={index}>
          <PagedText
            text={item.label}
            budget={80}
            frame={frame}
            duration={duration}
            style={{
              fontSize: 54,
              fontWeight: 850,
              color: theme.accent,
              lineHeight: 1.25,
            }}
          />
          {item.detail ? (
            <PagedText
              text={item.detail}
              budget={120}
              frame={frame}
              duration={duration}
              style={{ fontSize: 34, lineHeight: 1.4 }}
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  </div>
);

const KnowledgeStage: React.FC<{
  beat: KnowledgeBeat;
  localFrame: number;
  duration: number;
  fps: number;
  visualPlan?: KnowledgeVisualPlan | null;
  locale: "zh" | "en";
  chapterImages: Extract<HostElement, { type: "image" }>[];
}> = ({
  beat,
  localFrame,
  duration,
  fps,
  visualPlan,
  locale,
  chapterImages,
}) => {
  const chart = beat.elements.find((item) => item.type === "chart");
  const relation = beat.elements.find((item) => item.type === "relationship");
  const images = chapterImages;
  const authored = beat.elements.find((item) => item.type === "explanation");
  const explanation =
    beat.chapterVisual || explanationForElements(beat.elements, beat.say);
  const fullImage =
    !visualPlan &&
    images.length === 1 &&
    !chart &&
    !relation &&
    !authored &&
    beat.scene === "product";
  const image = images[0];
  return (
    <div
      data-knowledge-stage
      style={{ position: "absolute", ...KNOWLEDGE_STAGE }}
    >
      {fullImage ? (
        <SourceImageFocus
          key={image.src}
          image={image}
          frame={localFrame}
          fps={fps}
          width={KNOWLEDGE_STAGE.width}
          height={KNOWLEDGE_STAGE.height}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: image
              ? "minmax(0, 1fr) 320px"
              : "minmax(0, 1fr)",
            gap: 26,
            height: "100%",
          }}
        >
          <div style={{ minWidth: 0 }}>
            {chart?.type === "chart" ? (
              <EvidenceChart
                chart={chart}
                frame={localFrame}
                fps={fps}
                height={520}
              />
            ) : relation?.type === "relationship" ? (
              <RelationshipScene
                relation={relation}
                frame={localFrame}
                localFrame={localFrame}
                fps={fps}
                height={520}
              />
            ) : visualPlan ? (
              <KnowledgeVisualScene
                plan={visualPlan}
                frame={localFrame}
                duration={duration}
                narration={beat.say}
                locale={locale}
              />
            ) : explanation.layout === "spotlight" ? (
              <KnowledgeSpotlight
                explanation={explanation}
                frame={localFrame}
                duration={duration}
              />
            ) : (
              <ExplanationScene
                explanation={explanation}
                frame={localFrame}
                fps={fps}
                duration={duration}
                height={KNOWLEDGE_STAGE.height}
                focusIndex={beat.chapterFocus}
              />
            )}
          </div>
          {images.length ? (
            <div
              data-knowledge-source-images
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                height: KNOWLEDGE_STAGE.height,
              }}
            >
              {images.map((sourceImage) => (
                <SourceImageFocus
                  key={sourceImage.src}
                  image={sourceImage}
                  frame={localFrame}
                  fps={fps}
                  width={320}
                  height={
                    (KNOWLEDGE_STAGE.height - (images.length - 1) * 12) /
                    images.length
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export const KnowledgeExplainer: React.FC<KnowledgeVideoProps> = ({
  knowledge,
  cases = [],
  beats = [],
  locale = "zh",
  narrationAudioSrc,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const en = locale === "en";
  const title = knowledge?.title || (en ? "Knowledge explained" : "知识讲解");
  const chapters = knowledge?.chapters || cases;
  if (!beats.length)
    return (
      <AbsoluteFill
        style={{
          background: theme.paper,
          fontFamily: theme.font,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.muted,
          fontSize: 42,
        }}
      >
        {en
          ? "Plan scenes to preview your video"
          : "生成分镜后，在这里预览你的知识视频"}
      </AbsoluteFill>
    );
  const beat = beats[knowledgeBeatIndex(beats, frame, fps)];
  const chapterIndex = Math.max(
    0,
    Math.min(chapters.length - 1, beat.caseIndex ?? 0),
  );
  const chapter = chapters[chapterIndex];
  const localFrame = Math.max(
    0,
    frame - Math.round((beat.startMs * fps) / 1000),
  );
  const duration = Math.max(
    1,
    Math.round(((beat.endMs - beat.startMs) * fps) / 1000),
  );
  const caption = hostCaptionPageAtFrame(
    hostCaptionPages(beat.say, { width: KNOWLEDGE_CAPTIONS.width, fontSize: 38, paddingX: 24 }),
    localFrame,
    duration,
  ).page;
  const progress =
    (frame * 1000) / fps / Math.max(1, beats[beats.length - 1].endMs);
  const sourceNote =
    chapter && "sourceNote" in chapter ? String(chapter.sourceNote || "") : "";
  const visualStart =
    chapter && "startMs" in chapter ? chapter.startMs : undefined;
  const visualEnd = chapter && "endMs" in chapter ? chapter.endMs : undefined;
  const chapterText =
    chapter && "narration" in chapter
      ? chapter.narration || ""
      : chapter && "sourceBody" in chapter
        ? String(chapter.sourceBody || "")
        : "";
  const chapterBeats = beats.filter(
    (item) => (item.caseIndex ?? 0) === chapterIndex,
  );
  const visualPlan = knowledgeVisualPlan(
    chapterText || chapterBeats.map((item) => item.say).join("\n"),
    locale,
  );
  const chapterImages = [
    ...new Map(
      chapterBeats
        .flatMap((item) =>
          item.elements.filter(
            (element): element is Extract<HostElement, { type: "image" }> =>
              element.type === "image",
          ),
        )
        .map((image) => [image.src, image]),
    ).values(),
  ];
  if (!chapterImages.length && chapter && "image" in chapter && chapter.image)
    chapterImages.push({ type: "image", src: chapter.image });
  const window = knowledgeChapterWindow(beats, chapterIndex, frame, fps);
  const chapterVisual =
    beat.chapterVisual && visualStart !== undefined && visualEnd !== undefined;
  return (
    <HostLocaleProvider value={locale}>
      <AbsoluteFill
        data-knowledge-video
        style={{
          background: theme.paper,
          color: theme.ink,
          fontFamily: theme.font,
        }}
      >
        {narrationAudioSrc ? (
          <Audio src={assetSrc(narrationAudioSrc)} volume={0.95} />
        ) : null}
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(circle, ${theme.dot} 1px, transparent 1.3px)`,
            backgroundSize: "20px 20px",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 42,
            right: 72,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: theme.muted,
            gap: 30,
          }}
        >
          <div
            style={{
              maxWidth: 1250,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </div>
          <div>
            {"独立开发新知"}{" "}
            <span style={{ color: theme.accent, fontWeight: 800 }}>
              {" "}
              {chapterIndex + 1}/{chapters.length || 1}
            </span>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 112,
            width: 1328,
            height: 112,
          }}
        >
          <PagedText
            text={beat.headline || chapter?.title || title}
            budget={en ? 50 : 42}
            frame={localFrame}
            duration={duration}
            style={{
              fontSize: en ? 48 : 54,
              fontWeight: 850,
              lineHeight: 1.15,
              letterSpacing: "-.025em",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            top: 130,
            right: 72,
            width: 340,
            borderTop: `3px solid ${theme.accent}`,
            paddingTop: 15,
          }}
        >
          <div style={{ fontSize: 19, color: theme.muted, marginBottom: 12 }}>
            {en ? "CURRENT CHAPTER" : "当前章节"}
          </div>
          <div
            style={{
              height: 104,
              fontSize: 29,
              fontWeight: 750,
              lineHeight: 1.2,
            }}
          >
            <PagedText
              text={chapter?.title || title}
              budget={en ? 30 : 24}
              frame={localFrame}
              duration={duration}
              style={{ lineHeight: 1.2 }}
            />
          </div>
          {chapters[chapterIndex + 1] ? (
            <div
              style={{
                height: 58,
                fontSize: 19,
                color: theme.muted,
                marginTop: 10,
              }}
            >
              <PagedText
                text={`${en ? "Next: " : "接下来："}${chapters[chapterIndex + 1].title}`}
                budget={en ? 36 : 28}
                frame={localFrame}
                duration={duration}
              />
            </div>
          ) : null}
        </div>
        <KnowledgeStage
          visualPlan={visualPlan}
          chapterImages={chapterImages}
          locale={locale}
          key={
            visualPlan || chapterVisual
              ? `chapter-${chapterIndex}`
              : `${beat.startMs}-${beat.endMs}`
          }
          beat={beat}
          localFrame={
            visualPlan
              ? window.frame
              : chapterVisual
                ? Math.max(0, frame - Math.round((visualStart * fps) / 1000))
                : localFrame
          }
          duration={
            visualPlan
              ? window.duration
              : chapterVisual
                ? Math.max(
                    1,
                    Math.round(((visualEnd - visualStart) * fps) / 1000),
                  )
                : duration
          }
          fps={fps}
        />
        {sourceNote ? (
          <div
            style={{
              position: "absolute",
              left: 72,
              top: 866,
              width: 1328,
              fontSize: 18,
              color: theme.muted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sourceNote}
          </div>
        ) : null}
        <Host
          pose={beat.host}
          section={beat.section}
          localFrame={localFrame}
          speakFrom={0}
          speakTo={duration}
        />
        <div
          data-knowledge-captions
          style={{
            position: "absolute",
            ...KNOWLEDGE_CAPTIONS,
            ...HOST_CAPTION_APPEARANCE,
            fontWeight: 800,
            fontSize: 38,
            lineHeight: "48px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {caption.lines.map((line, index) => (
            <div key={index} style={{ whiteSpace: "pre-wrap" }}>
              {line.trim()}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            bottom: 28,
            height: 4,
            background: theme.line,
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(100, progress * 100))}%`,
              height: "100%",
              background: theme.accent,
            }}
          />
        </div>
      </AbsoluteFill>
    </HostLocaleProvider>
  );
};
