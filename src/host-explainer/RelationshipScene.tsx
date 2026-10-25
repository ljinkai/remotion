import React, { useId } from "react";
import { interpolate } from "remotion";
import type { HostElement } from "./hostTypes";
import { theme } from "./theme";
import { relationshipLabelLines } from "./richSceneMath";

type Relationship = Extract<HostElement, { type: "relationship" }>;
const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
export const RelationshipScene: React.FC<{
  relation: Relationship;
  frame: number;
  localFrame: number;
  fps: number;
  height?: number;
}> = ({ relation, frame, localFrame, fps, height = 900 }) => {
  const markerId = useId().replace(/:/g, "");
  const nodes = relation.nodes.slice(0, 6);
  const focused =
    relation.focus !== undefined &&
    relation.focus >= 0 &&
    relation.focus < nodes.length;
  const emphasis = focused
    ? interpolate(localFrame, [0, fps * 0.5], [0, 1], clamp)
    : 0;
  const points = nodes.map((_, index) => {
    if (relation.mode === "flow") {
      const column = index < 3 ? index : 5 - index;
      return {
        x: nodes.length === 2 ? 250 + index * 450 : 150 + column * 326,
        y: nodes.length <= 3 ? 440 : index < 3 ? 270 : 650,
      };
    }
    const angle = ((-90 + (index * 360) / nodes.length) * Math.PI) / 180;
    return { x: 476 + Math.cos(angle) * 310, y: 440 + Math.sin(angle) * 295 };
  });
  return (
    <div data-relationship-focus={focused ? relation.focus : "all"}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          paddingBottom: 18,
          borderBottom: `2px solid ${theme.ink}`,
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 800 }}>{relation.title}</div>
        <div style={{ fontSize: 22, color: theme.muted }}>
          {focused ? "重点展开" : "关系全貌"}
        </div>
      </div>
      <svg
        viewBox="0 0 952 900"
        style={{ width: "100%", height }}
        role="img"
        aria-label={`${relation.title}：${nodes.join("、")}`}
      >
        <defs>
          <marker
            id={markerId}
            markerWidth={10}
            markerHeight={10}
            refX={7}
            refY={5}
            orient="auto"
          >
            <path
              d="M0,0 L8,5 L0,10"
              fill="none"
              stroke={theme.accent}
              strokeWidth={1.5}
            />
          </marker>
        </defs>
        {points.map((point, index) => {
          const previous = points[Math.max(0, index - 1)];
          const distance = Math.max(
            1,
            Math.hypot(point.x - previous.x, point.y - previous.y),
          );
          const dx = (point.x - previous.x) / distance,
            dy = (point.y - previous.y) / distance;
          const active = !focused || relation.focus === index;
          const opacity =
            interpolate(
              frame,
              [index * fps * 0.1, index * fps * 0.1 + fps * 0.4],
              [0, 1],
              clamp,
            ) * (active ? 1 : 1 - emphasis * 0.75);
          return (
            <g key={index} opacity={opacity}>
              {relation.mode === "flow" ? (
                index > 0 ? (
                  <line
                    x1={previous.x + dx * 100}
                    y1={previous.y + dy * 100}
                    x2={point.x - dx * 110}
                    y2={point.y - dy * 110}
                    stroke={theme.accent}
                    strokeWidth={3}
                    markerEnd={`url(#${markerId})`}
                  />
                ) : null
              ) : (
                <line
                  x1={476}
                  y1={440}
                  x2={point.x}
                  y2={point.y}
                  stroke={focused && active ? theme.accent : theme.line}
                  strokeWidth={focused && active ? 6 : 3}
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={active && focused ? 97 : 89}
                fill={active && focused ? theme.accent : theme.card}
                stroke={active && focused ? theme.accent : theme.ink}
                strokeWidth={2}
              />
              <text
                x={point.x}
                y={point.y - 38}
                textAnchor="middle"
                fontSize={19}
                fill={active && focused ? "#fff9" : theme.muted}
              >
                {relation.mode === "flow" ? "步骤" : "渠道"}{" "}
                {String(index + 1).padStart(2, "0")}
              </text>
              <text
                x={point.x}
                y={
                  point.y +
                  (relationshipLabelLines(nodes[index]).length > 2 ? -9 : 5)
                }
                textAnchor="middle"
                fontSize={28}
                fontWeight={800}
                fill={active && focused ? "white" : theme.ink}
              >
                {relationshipLabelLines(nodes[index]).map((line, lineIndex) => (
                  <tspan
                    key={lineIndex}
                    x={point.x}
                    dy={lineIndex === 0 ? 0 : 31}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        {relation.mode !== "flow" ? (
          <>
            <circle cx={476} cy={440} r={111} fill={theme.ink} />
            <text
              x={476}
              y={431}
              textAnchor="middle"
              fontSize={23}
              fill="#fff9"
            >
              增长渠道
            </text>
          </>
        ) : null}
        {relation.mode !== "flow" ? (
          <text
            x={476}
            y={470}
            textAnchor="middle"
            fontSize={32}
            fontWeight={800}
            fill="white"
          >
            {focused ? "聚焦一项" : "渠道选项"}
          </text>
        ) : null}
      </svg>
    </div>
  );
};
