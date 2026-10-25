import React from "react";
import { interpolate } from "remotion";
import type { HostElement } from "./hostTypes";
import { theme } from "./theme";
import { chartPresentation } from "./richSceneMath";

type Chart = Extract<HostElement, { type: "chart" }>;
const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const compact = (n: number) =>
  n >= 1000000
    ? `${Number((n / 1000000).toFixed(1))}M`
    : n >= 1000
      ? `${Number((n / 1000).toFixed(1))}k`
      : String(n);

export const EvidenceChart: React.FC<{
  chart: Chart;
  frame: number;
  fps: number;
  height?: number;
}> = ({ chart, frame, fps, height = 710 }) => {
  const data = chart.data;
  const model = chartPresentation(chart);
  const max = model.maximum;
  const amount = interpolate(frame, [0, fps * 1.2], [0, 1], clamp);
  const active = Math.min(data.length - 1, Math.floor(amount * data.length));
  const single = model.kind === "single";
  const hasBound = data.some((point) => point.display?.includes("+"));
  const sourceName = (chart.source || "原文披露")
    .split(/[；;]/)[0]
    .split("·")[0]
    .trim();
  const sourceSummary =
    chart.chartType === "milestones"
      ? `${sourceName} · 横轴为阶段，非日期${hasBound ? " · + 表示下界" : ""}`
      : chart.source || "数据来自原文";
  const label = (point: Chart["data"][number]) =>
    point.display ||
    `${point.value.toLocaleString("en-US")}${chart.unit ? ` ${chart.unit}` : ""}`;
  if (single)
    return (
      <div
        data-chart-type="single"
        style={{ padding: "34px 0 24px", borderTop: `3px solid ${theme.ink}` }}
      >
        <div style={{ fontSize: 26, color: theme.muted, marginBottom: 28 }}>
          {chart.title}
        </div>
        <div
          style={{
            fontSize: 140,
            fontWeight: 850,
            color: theme.accent,
            lineHeight: 1.1,
            letterSpacing: "-.05em",
          }}
        >
          {data[0] ? label(data[0]) : ""}
        </div>
        <div style={{ fontSize: 30, fontWeight: 650, marginTop: 24 }}>
          {data[0]?.label}
        </div>
        {data[0]?.note ? (
          <div style={{ fontSize: 24, color: theme.muted, marginTop: 14 }}>
            {data[0].note}
          </div>
        ) : null}
        <div
          style={{
            borderTop: `1px solid ${theme.line}`,
            marginTop: 35,
            paddingTop: 18,
            fontSize: 21,
            color: theme.muted,
          }}
        >
          {chart.source || "原文披露"}
        </div>
      </div>
    );
  const milestones = chart.chartType === "milestones";
  const left = 90,
    right = 900,
    top = 106,
    bottom = height - 120;
  const x = (i: number) =>
    left + (i * (right - left)) / Math.max(1, data.length - 1);
  const y = (value: number) => bottom - ((bottom - top) * value) / max;
  const stepPath = data
    .map((point, index) =>
      index === 0
        ? `M${x(0)},${y(point.value)}`
        : `H${x(index)} V${y(point.value)}`,
    )
    .join(" ");
  return (
    <div data-chart-type={chart.chartType} style={{ paddingTop: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.2 }}>
          {chart.title}
        </div>
        <div
          style={{
            fontSize: 22,
            color: theme.muted,
            fontWeight: 650,
            whiteSpace: "nowrap",
          }}
        >
          {chart.unit}
        </div>
      </div>
      <svg
        viewBox={`0 0 952 ${height}`}
        style={{ width: "100%", height, overflow: "visible" }}
        role="img"
        aria-label={`${chart.title}，${chart.unit}`}
      >
        {milestones
          ? [0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <g key={ratio}>
                <line
                  x1={left}
                  x2={right}
                  y1={y(max * ratio)}
                  y2={y(max * ratio)}
                  stroke={ratio === 0 ? theme.ink : theme.line}
                  strokeWidth={ratio === 0 ? 2 : 1.5}
                />
                <text
                  x={left - 16}
                  y={y(max * ratio) + 7}
                  fontSize={20}
                  fill={theme.muted}
                  textAnchor="end"
                >
                  {compact(max * ratio)}
                </text>
              </g>
            ))
          : null}
        {milestones ? (
          <>
            <path
              d={stepPath}
              fill="none"
              stroke={theme.accent}
              strokeWidth={6}
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - amount}
            />
            {data.map((point, index) => {
              const shown = interpolate(
                frame,
                [index * fps * 0.16, index * fps * 0.16 + fps * 0.25],
                [0, 1],
                clamp,
              );
              return (
                <g key={index} opacity={shown}>
                  <circle
                    cx={x(index)}
                    cy={y(point.value)}
                    r={active === index ? 11 : 8}
                    fill={
                      point.display?.includes("+")
                        ? theme.card
                        : active === index
                          ? theme.accent
                          : theme.ink
                    }
                    stroke={
                      point.display?.includes("+") ? theme.accent : theme.paper
                    }
                    strokeWidth={point.display?.includes("+") ? 3 : 4}
                  />
                  {point.display?.includes("+") ? (
                    <g stroke={theme.accent} strokeWidth={2.5} fill="none">
                      <path
                        d={`M${x(index) + 15},${y(point.value) - 17} V${y(point.value) - 49}`}
                        strokeDasharray="4 4"
                      />
                      <path
                        d={`M${x(index) + 10},${y(point.value) - 43} L${x(index) + 15},${y(point.value) - 49} L${x(index) + 20},${y(point.value) - 43}`}
                      />
                    </g>
                  ) : null}
                  <text
                    x={x(index)}
                    y={y(point.value) - 25}
                    textAnchor={
                      index === 0
                        ? "start"
                        : index === data.length - 1
                          ? "end"
                          : "middle"
                    }
                    fill={theme.ink}
                    fontSize={26}
                    fontWeight={800}
                  >
                    {point.display || compact(point.value)}
                  </text>
                  <text
                    x={x(index)}
                    y={bottom + 42}
                    textAnchor={
                      index === 0
                        ? "start"
                        : index === data.length - 1
                          ? "end"
                          : "middle"
                    }
                    fill={theme.muted}
                    fontSize={22}
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
            <text
              x={(left + right) / 2}
              y={height - 23}
              textAnchor="middle"
              fontSize={21}
              fill={theme.muted}
            >
              原文阶段顺序
            </text>
          </>
        ) : (
          data.map((point, index) => {
            const row = (height - 140) / data.length;
            const cy = 70 + index * row;
            const width =
              (point.value / max) *
              610 *
              interpolate(
                frame,
                [index * fps * 0.15, index * fps * 0.15 + fps * 0.65],
                [0, 1],
                clamp,
              );
            return (
              <g key={index}>
                <text
                  x={0}
                  y={cy}
                  fontSize={27}
                  fontWeight={700}
                  fill={theme.ink}
                >
                  {point.label}
                </text>
                <rect
                  x={0}
                  y={cy + 20}
                  width={610}
                  height={Math.min(55, row * 0.3)}
                  rx={5}
                  fill={theme.line}
                />
                <rect
                  x={0}
                  y={cy + 20}
                  width={Math.max(0, width)}
                  height={Math.min(55, row * 0.3)}
                  rx={5}
                  fill={index === active ? theme.accent : theme.ink}
                />
                <text
                  x={645}
                  y={cy + 57}
                  fontSize={30}
                  fontWeight={800}
                  fill={theme.accent}
                >
                  {label(point)}
                </text>
              </g>
            );
          })
        )}
      </svg>
      <div
        title={[chart.source, ...data.map((point) => point.note)]
          .filter(Boolean)
          .join("；")}
        aria-label={chart.source}
        style={{
          fontSize: 21,
          color: theme.muted,
          borderTop: `1px solid ${theme.line}`,
          paddingTop: 15,
          lineHeight: 1.35,
        }}
      >
        {sourceSummary}
        {chart.chartType !== "milestones" && data.some((point) => point.note)
          ? ` · ${data
              .filter((point) => point.note)
              .map((point) => point.note)
              .join("；")}`
          : ""}
      </div>
    </div>
  );
};
