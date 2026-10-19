import React from "react";
import { Img, interpolate, spring, useVideoConfig } from "remotion";
import { assetSrc } from "../Composition";
import { sanitizeSvg } from "./sanitizeSvg";
import type { HostElement } from "./hostTypes";
import { HostIcon } from "./icons";
import { theme } from "./theme";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const slotStyle = (
  count: number,
  index: number,
): React.CSSProperties => {
  if (count === 3 && index === 0) {
    return { gridColumn: "1 / -1" };
  }
  return {};
};

const BarElement: React.FC<{
  label: string;
  to: number;
  max: number;
  note?: string;
  enter: number;
  tall: boolean;
}> = ({ label, to, max, note, enter, tall }) => {
  const full = tall ? 620 : 240;
  const ratio = max > 0 ? Math.max(0, Math.min(1, to / max)) : 1;
  const height = full * ratio * enter;
  return (
    <div
      style={{
        height: full + 88,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          marginBottom: 8,
          background: theme.ink,
          color: "#ffffff",
          borderRadius: 12,
          padding: "6px 10px",
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: tall ? 220 : 120,
          height,
          borderRadius: 24,
          background: theme.accent,
          border: `3px solid ${theme.ink}`,
        }}
      />
      {note ? (
        <div
          style={{
            marginTop: 10,
            borderTop: `3px dashed ${theme.ink}`,
            paddingTop: 6,
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
};

const ElementView: React.FC<{
  element: HostElement;
  enter: number;
  tall: boolean;
  barMax: number;
}> = ({ element, enter, tall, barMax }) => {
  const rise = interpolate(enter, [0, 1], [24, 0], clamp);
  const frame = (
    <div
      style={{
        opacity: enter,
        transform: `translateY(${rise}px)`,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {element.type === "text" ? (
        <div
          style={{
            fontWeight: 760,
            lineHeight: 1.05,
            color: element.size === "xl" ? theme.accent : theme.ink,
            fontSize: element.size === "xl" ? (tall ? 120 : 72) : element.size === "m" ? 40 : tall ? 84 : 52,
          }}
        >
          {element.text}
        </div>
      ) : null}
      {element.type === "bar" ? (
        <BarElement
          label={element.label}
          to={element.to}
          max={element.max ?? barMax}
          note={element.note}
          enter={enter}
          tall={tall}
        />
      ) : null}
      {element.type === "image" ? (
        <div>
          <Img
            src={assetSrc(element.src)}
            style={{
              width: "100%",
              height: tall ? 640 : 280,
              objectFit: "cover",
              borderRadius: 28,
              border: `3px solid ${theme.ink}`,
              background: theme.card,
            }}
          />
          {element.caption ? (
            <div style={{ marginTop: 10, fontSize: 22, fontWeight: 700 }}>
              {element.caption}
            </div>
          ) : null}
        </div>
      ) : null}
      {element.type === "phone" ? (
        <div
          style={{
            width: tall ? 420 : 250,
            height: tall ? 700 : 380,
            margin: "0 auto",
            background: theme.ink,
            borderRadius: 42,
            padding: 16,
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 30,
              background: theme.card,
              padding: tall ? 28 : 18,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: tall ? 36 : 22, fontWeight: 760, lineHeight: 1.15 }}>
              {element.title}
            </div>
            <div
              style={{
                flex: 1,
                marginTop: 22,
                border: `3px solid ${theme.ink}`,
                borderRadius: 22,
                padding: tall ? 22 : 14,
                display: "flex",
                alignItems: "center",
                fontSize: tall ? 40 : 24,
                fontWeight: 760,
                lineHeight: 1.2,
              }}
            >
              {element.body}
            </div>
            {element.action ? (
              <div
                style={{
                  marginTop: 16,
                  display: "inline-block",
                  background: theme.accent,
                  color: "#ffffff",
                  borderRadius: 999,
                  padding: "8px 14px",
                  fontWeight: 700,
                }}
              >
                {element.action}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {element.type === "card" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            alignSelf: "stretch",
            minHeight: tall ? 460 : 240,
            background: theme.card,
            border: `3px solid ${theme.ink}`,
            borderRadius: 28,
            padding: tall ? 36 : 22,
            boxShadow: "0 12px 0 rgba(22,22,22,0.06)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: tall ? 52 : 32, fontWeight: 760, lineHeight: 1.1 }}>
            {element.title}
          </div>
          {element.bars && element.bars.length > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 10,
                height: 120,
                marginTop: 18,
              }}
            >
              {element.bars.map((value, index) => (
                <div
                  key={`${value}-${index}`}
                  style={{
                    width: 22,
                    height: Math.max(12, Math.min(110, value)),
                    borderRadius: 6,
                    background: index % 2 === 0 ? theme.accent : theme.ink,
                  }}
                />
              ))}
            </div>
          ) : null}
          {(element.lines || []).map((line) => (
            <div key={line} style={{ marginTop: 16, fontSize: tall ? 32 : 22, fontWeight: 700, color: theme.ink }}>
              {line}
            </div>
          ))}
        </div>
      ) : null}
      {element.type === "icon" ? (
        <HostIcon name={element.name} size={tall ? 320 : 200} />
      ) : null}
      {element.type === "svg" ? (
        <div
          className="hostSvgSlot"
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(element.markup) }}
        />
      ) : null}
    </div>
  );
  return frame;
};

export const ElementStage: React.FC<{
  elements: HostElement[];
  localFrame: number;
  durationFrames: number;
}> = ({ elements, localFrame, durationFrames }) => {
  const { fps } = useVideoConfig();
  const count = Math.min(elements.length, 4);
  const shown = elements.slice(0, 4);
  const fade = interpolate(
    localFrame,
    [Math.max(0, durationFrames - 12), Math.max(1, durationFrames - 1)],
    [1, 0],
    clamp,
  );
  const barValues = shown.flatMap((item) =>
    item.type === "bar" ? [item.max ?? item.to] : [],
  );
  const barMax = barValues.length > 0 ? Math.max(...barValues) : 1;
  const tall = count <= 2;

  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        top: 360,
        width: 952,
        height: 920,
        opacity: fade,
        display: "grid",
        gridTemplateColumns: count === 1 ? "1fr" : "1fr 1fr",
        gridTemplateRows: count <= 2 ? "1fr" : "1fr 1fr",
        gap: 28,
        alignItems: "stretch",
        justifyItems: "stretch",
      }}
    >
      <style>{`.hostSvgSlot svg{width:100%;height:220px;display:block}`}</style>
      {shown.map((element, index) => {
        const enter = spring({
          frame: localFrame - index * 6,
          fps,
          config: { damping: 14, stiffness: 120 },
        });
        return (
          <div
            key={`${element.type}-${index}`}
            style={{
              ...slotStyle(count, index),
              height: "100%",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ElementView
              element={element}
              enter={enter}
              tall={tall && !(count === 3 && index > 0)}
              barMax={barMax}
            />
          </div>
        );
      })}
    </div>
  );
};
