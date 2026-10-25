import React, { useMemo } from "react";
import {
  HOST_CAPTION_LAYOUT,
  HOST_CAPTION_APPEARANCE,
  hostCaptionPages,
  hostCaptionPageAtFrame,
} from "./hostCaptions";

export const HostCaptions: React.FC<{
  text: string;
  localFrame: number;
  durationFrames: number;
}> = ({ text, localFrame, durationFrames }) => {
  const pages = useMemo(() => hostCaptionPages(text), [text]);
  const { page, index } = hostCaptionPageAtFrame(
    pages,
    localFrame,
    durationFrames,
  );
  return (
    <div
      data-host-caption-safe-area
      data-caption-page={index}
      data-caption-pages={pages.length}
      style={{
        position: "absolute",
        left: HOST_CAPTION_LAYOUT.left,
        top: HOST_CAPTION_LAYOUT.top,
        width: HOST_CAPTION_LAYOUT.width,
        height: HOST_CAPTION_LAYOUT.height,
        padding: `14px ${HOST_CAPTION_LAYOUT.paddingX}px`,
        boxSizing: "border-box",
        ...HOST_CAPTION_APPEARANCE,
        fontSize: HOST_CAPTION_LAYOUT.fontSize,
        lineHeight: `${HOST_CAPTION_LAYOUT.lineHeight}px`,
        fontWeight: 800,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {page.lines.map((line, lineIndex) => (
        <div
          data-host-caption-line
          key={lineIndex}
          style={{
            whiteSpace: "pre",
            minHeight: HOST_CAPTION_LAYOUT.lineHeight,
          }}
        >
          {line.replace(/[\r\n]/g, " ").trim()}
        </div>
      ))}
    </div>
  );
};
