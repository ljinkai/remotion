import React, { useState } from "react";
import { AbsoluteFill, Img } from "remotion";
import { assetSrc } from "../Composition";
import { Host } from "./host/Host";
import { theme } from "./theme";

/** The intro and exported poster share this fully visible, frame-zero layout. */
export const SinglePostCover: React.FC<{
  title: string;
  summary: string;
  image?: string;
  sourceUrl?: string;
  sourceAuthor?: string;
  localFrame: number;
  durationFrames: number;
}> = ({
  title,
  summary,
  image,
  sourceUrl,
  sourceAuthor,
  localFrame,
  durationFrames,
}) => {
  const [failedImage, setFailedImage] = useState(false);
  let source = sourceUrl || "";
  try {
    source = new URL(source).hostname.replace(/^www\./, "");
  } catch {
    /* Historical jobs may lack a source URL. */
  }
  const showImage = Boolean(image && !failedImage);
  return (
    <AbsoluteFill
      data-single-post-cover
      style={{
        backgroundColor: theme.paper,
        color: theme.ink,
        fontFamily: theme.font,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, ${theme.dot} 1px, transparent 1.5px)`,
          backgroundSize: "22px 22px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 80,
          right: 80,
          fontSize: 25,
          letterSpacing: "0.12em",
          color: theme.accent,
          fontWeight: 750,
        }}
      >
        THE INDIE BRIEF
      </div>
      <h1
        style={{
          position: "absolute",
          top: 240,
          left: 80,
          right: 80,
          margin: 0,
          fontSize: title.length > 95 ? 58 : title.length > 65 ? 66 : 78,
          fontWeight: 800,
          lineHeight: 1.07,
          letterSpacing: "-0.04em",
          overflowWrap: "break-word",
        }}
      >
        {title}
      </h1>
      <div
        data-cover-content={showImage ? "source-image" : "key-point"}
        style={{
          position: "absolute",
          top: 550,
          left: 80,
          right: 80,
          height: 720,
          padding: 36,
          boxSizing: "border-box",
          background: theme.card,
          border: `2px solid ${theme.line}`,
          borderRadius: 28,
          boxShadow: "10px 12px 0 rgba(28,28,28,0.09)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {showImage ? (
          <Img
            src={assetSrc(image!)}
            onError={() => setFailedImage(true)}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <>
            <div
              style={{
                color: theme.accent,
                fontSize: 24,
                fontWeight: 750,
                letterSpacing: "0.12em",
                marginBottom: 30,
              }}
            >
              THE KEY POINT
            </div>
            <div
              style={{
                fontSize: summary.length > 220 ? 43 : 52,
                fontWeight: 720,
                lineHeight: 1.22,
                overflowWrap: "break-word",
              }}
            >
              {summary}
            </div>
          </>
        )}
      </div>
      {showImage ? (
        <div
          style={{
            position: "absolute",
            top: 1340,
            left: 80,
            width: 420,
            fontSize: 35,
            fontWeight: 650,
            lineHeight: 1.22,
          }}
        >
          {summary}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          bottom: 245,
          left: 80,
          width: 420,
          fontSize: 24,
          lineHeight: 1.4,
          color: theme.muted,
          overflowWrap: "anywhere",
        }}
      >
        <div style={{ fontSize: 20, letterSpacing: "0.08em", marginBottom: 8 }}>
          SOURCE
        </div>
        {sourceAuthor ? <div>{sourceAuthor}</div> : null}
        <div>{source}</div>
      </div>
      <AbsoluteFill>
        <Host
          pose="point"
          section="intro"
          localFrame={localFrame}
          speakFrom={12}
          speakTo={Math.max(13, durationFrames - 12)}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
