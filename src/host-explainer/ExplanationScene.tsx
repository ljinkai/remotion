import React, { useContext } from "react";
import { HostLocaleContext } from "./hostLocale";
import { interpolate } from "remotion";
import { theme } from "./theme";
import {
  explanationPageAt,
  explanationFocus,
  explanationItemWindow,
  type Explanation,
} from "./explanationContent";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
export const PagedText: React.FC<{
  text: string;
  budget: number;
  frame: number;
  duration: number;
  style?: React.CSSProperties;
}> = ({ text, budget, frame, duration, style }) => {
  const page = explanationPageAt(text, budget, frame, duration);
  return (
    <div
      data-explanation-page={page.index}
      data-explanation-pages={page.count}
      style={{
        overflowWrap: "break-word",
        whiteSpace: "pre-wrap",
        lineHeight: 1.3,
        ...style,
        opacity:
          page.count > 1
            ? interpolate(frame - page.startFrame, [0, 4], [0.4, 1], clamp)
            : 1,
      }}
    >
      {page.text.trim()}
    </div>
  );
};

export const ExplanationScene: React.FC<{
  explanation: Explanation;
  frame: number;
  fps: number;
  duration: number;
  height?: number;
  emphasis?: boolean;
  focusIndex?: number;
}> = ({
  explanation,
  frame,
  fps,
  duration,
  height = 850,
  emphasis = false,
  focusIndex,
}) => {
  const english = useContext(HostLocaleContext) === "en";
  const compact = height < 750;
  const group = explanationItemWindow(
    explanation.items,
    explanation.layout,
    frame,
    duration,
  );
  const items = group.items;
  const focus = focusIndex === undefined ? explanationFocus(group.frame, group.duration, items.length) : focusIndex - group.offset;
  const mainHeight = height - 90;
  const overview = interpolate(
    frame,
    [0, Math.round(fps * 0.35)],
    [0, 1],
    clamp,
  );
  const layout = explanation.layout;
  return (
    <div
      data-explanation-layout={layout}
      data-explanation-group={group.index}
      data-explanation-groups={group.count}
      style={{ height, opacity: overview }}
    >
      {explanation.title ? (
        <div
          style={{
            height: 70,
            marginBottom: 20,
            borderBottom: `2px solid ${theme.ink}`,
            paddingBottom: 14,
            fontSize: 26,
            fontWeight: 650,
            color: theme.muted,
          }}
        >
          <PagedText
            text={explanation.title}
            budget={32}
            frame={group.frame}
            duration={group.duration}
          />
        </div>
      ) : (
        <div
          style={{
            height: 35,
            marginBottom: 15,
            borderTop: `3px solid ${theme.ink}`,
          }}
        />
      )}
      {layout === "flow" ? (
        <div
          style={{
            height: mainHeight,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {items.map((item, index) => {
            const active = focus === index;
            return (
              <div
                key={index}
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "grid",
                  gridTemplateColumns: item.detail
                    ? "74px 300px 1fr"
                    : "74px 1fr",
                  gap: 22,
                  alignItems: "center",
                  padding: compact ? "12px 18px" : "20px 24px",
                  background: active ? "#fff0e6" : theme.card,
                  border: `${active ? 3 : 1}px solid ${active ? theme.accent : theme.line}`,
                  borderRadius: 20,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: 64,
                    width: 64,
                    borderRadius: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: active ? theme.accent : theme.ink,
                    color: "white",
                    fontSize: 27,
                    fontWeight: 800,
                  }}
                >
                  {String(group.offset + index + 1).padStart(2, "0")}
                </div>
                <PagedText
                  text={item.label}
                  budget={item.detail ? (compact ? 16 : 20) : 28}
                  frame={group.frame}
                  duration={group.duration}
                  style={{
                    fontSize: item.detail
                      ? compact
                        ? 34
                        : 42
                      : items.length <= 2
                        ? compact
                          ? 50
                          : 64
                        : compact
                          ? 36
                          : 48,
                    fontWeight: 800,
                    color: active ? theme.accent : theme.ink,
                  }}
                />
                {item.detail ? (
                  <PagedText
                    text={item.detail}
                    budget={compact ? 36 : 48}
                    frame={group.frame}
                    duration={group.duration}
                    style={{
                      fontSize: compact ? 25 : 29,
                      fontWeight: 550,
                      color: theme.ink,
                    }}
                  />
                ) : null}
                {index < items.length - 1 ? (
                  <span
                    style={{
                      position: "absolute",
                      left: 46,
                      bottom: -23,
                      zIndex: 2,
                      color: theme.accent,
                      fontSize: 29,
                      lineHeight: "29px",
                    }}
                  >
                    ↓
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : layout === "spotlight" ? (
        <div
          style={{
            height: mainHeight,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: compact ? "18px 28px" : "28px 36px",
            borderLeft: `7px solid ${theme.accent}`,
            background: "linear-gradient(120deg, #fff2e9 0%, transparent 85%)",
            gap: compact ? 26 : 42,
          }}
        >
          {items.map((item, index) => (
            <React.Fragment key={index}>
              <PagedText
                text={item.label}
                budget={compact ? 30 : 34}
                frame={group.frame}
                duration={group.duration}
                style={{
                  fontSize: compact ? 58 : 74,
                  lineHeight: 1.18,
                  letterSpacing: "-.025em",
                  fontWeight: 850,
                  color: theme.accent,
                }}
              />
              {item.detail ? (
                <PagedText
                  text={item.detail}
                  budget={compact ? 65 : 82}
                  frame={group.frame}
                  duration={group.duration}
                  style={{
                    fontSize: compact ? 31 : 38,
                    fontWeight: 650,
                    lineHeight: 1.4,
                  }}
                />
              ) : null}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div
          style={{
            height: mainHeight,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: items.length > 2 ? "1fr 1fr" : "1fr",
            gap: 22,
            position: "relative",
          }}
        >
          {items.map((item, index) => {
            const active = focus === index;
            const large = items.length <= 2;
            return (
              <div
                key={index}
                style={{
                  gridColumn:
                    (items.length === 3 && index === 2) || items.length === 1
                      ? "1 / -1"
                      : undefined,
                  minWidth: 0,
                  minHeight: 0,
                  position: "relative",
                  padding: compact ? "22px 24px" : "30px 28px",
                  borderRadius: 24,
                  background:
                    layout === "contrast"
                      ? index === 0
                        ? theme.card
                        : "#ffe6d7"
                      : active
                        ? "#fff0e6"
                        : theme.card,
                  border: `${active ? 3 : 1}px solid ${active ? theme.accent : theme.line}`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: compact ? 14 : 22,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 22,
                    fontSize: compact ? 64 : 92,
                    lineHeight: 1,
                    fontWeight: 850,
                    color: theme.ink,
                    opacity: 0.055,
                  }}
                >
                  {String(group.offset + index + 1).padStart(2, "0")}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    color: theme.muted,
                    fontWeight: 650,
                    letterSpacing: 2,
                  }}
                >
                  {layout === "contrast"
                    ? index === 0
                      ? "A"
                      : "B"
                    : String(group.offset + index + 1).padStart(2, "0")}
                </div>
                <PagedText
                  text={item.label}
                  budget={
                    english
                      ? (items.length === 3 && index === 2) ||
                        items.length === 1
                        ? 64
                        : 36
                      : emphasis && !item.detail
                        ? 14
                        : large
                          ? 22
                          : 20
                  }
                  frame={group.frame}
                  duration={group.duration}
                  style={{
                    fontSize: english
                      ? compact
                        ? 32
                        : emphasis
                          ? 44
                          : 38
                      : emphasis && !item.detail
                        ? compact
                          ? 42
                          : 56
                        : large
                          ? compact
                            ? 42
                            : 56
                          : compact
                            ? 32
                            : 38,
                    lineHeight: 1.2,
                    fontWeight: 800,
                    color: active ? theme.accent : theme.ink,
                  }}
                />
                {item.detail ? (
                  <PagedText
                    text={item.detail}
                    budget={large ? (compact ? 36 : 48) : compact ? 30 : 40}
                    frame={group.frame}
                    duration={group.duration}
                    style={{
                      fontSize: large ? (compact ? 28 : 32) : compact ? 25 : 27,
                      lineHeight: 1.4,
                      fontWeight: 550,
                      color: theme.ink,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          {layout === "contrast" && items.length > 1 ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%,-50%)",
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: theme.ink,
                color: "white",
                fontSize: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
              }}
            >
              ≠
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
