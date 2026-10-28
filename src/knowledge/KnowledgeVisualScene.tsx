import React, { useId } from "react";
import { interpolate } from "remotion";
import {
  knowledgeVisualFocus,
  type KnowledgeVisualPlan,
} from "./knowledgeVisualPlan";
import {
  hostCaptionPages,
  hostCaptionPageAtFrame,
} from "../host-explainer/hostCaptions";
import { theme } from "../host-explainer/theme";

const ink = theme.ink,
  accent = theme.accent,
  muted = theme.muted;
const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const Box: React.FC<{
  x: number;
  y: number;
  width?: number;
  label: string;
  sub?: string;
  active?: boolean;
  index?: number;
  frame: number;
  duration: number;
}> = ({ x, y, width = 220, label, sub, active, index, frame, duration }) => {
  const fontSize = label.length > 22 ? 19 : label.length > 15 ? 23 : 28;
  const pages = hostCaptionPages(label, {
    width: width - 32,
    paddingX: 0,
    fontSize,
  });
  const { page, index: pageIndex } = hostCaptionPageAtFrame(
    pages,
    frame,
    duration,
  );
  const firstY = (sub ? 54 : 65) - (page.lines.length - 1) * fontSize * 0.575;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        width={width}
        height={112}
        rx={20}
        fill={active ? "#fff0e4" : "#fffcf8"}
        stroke={active ? accent : "#d9d2c9"}
        strokeWidth={active ? 3 : 1.5}
      />
      {index !== undefined ? (
        <text
          x={20}
          y={30}
          fill={active ? accent : muted}
          fontSize={17}
          fontWeight={750}
        >
          {String(index + 1).padStart(2, "0")}
        </text>
      ) : null}
      <text
        data-knowledge-box-label="true"
        data-label-page={pageIndex}
        x={width / 2}
        y={firstY}
        fill={active ? accent : ink}
        fontSize={fontSize}
        fontWeight={750}
        textAnchor="middle"
      >
        {page.lines.map((line, index) => (
          <tspan key={index} x={width / 2} y={firstY + index * fontSize * 1.15}>
            {line}
          </tspan>
        ))}
      </text>
      {sub ? (
        <text
          x={width / 2}
          y={84}
          fill={muted}
          fontSize={18}
          textAnchor="middle"
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
};
const Person: React.FC<{ x: number; y: number; label: string }> = ({
  x,
  y,
  label,
}) => (
  <g transform={`translate(${x},${y})`}>
    <circle r={62} fill="#161616" />
    <circle cy={-15} r={16} fill="#ffddbd" />
    <path d="M-30 29 Q-30-1 0-1 Q30-1 30 29" fill="#ffddbd" />
    <text y={100} textAnchor="middle" fontSize={25} fontWeight={750} fill={ink}>
      {label}
    </text>
  </g>
);

export const KnowledgeVisualScene: React.FC<{
  plan: KnowledgeVisualPlan;
  frame: number;
  duration: number;
  narration: string;
  locale: "zh" | "en";
}> = ({ plan, frame, duration, narration, locale }) => {
  const en = locale === "en";
  const id = useId().replace(/:/g, "");
  const progress = Math.max(0, Math.min(1, frame / Math.max(1, duration - 1)));
  const focus = knowledgeVisualFocus(plan, narration, progress);
  const active = focus[0];
  const enter = interpolate(frame, [0, 15], [0.85, 1], clamp);
  const path = (d: string, index = 0) => (
    <g key={d}>
      <path d={d} fill="none" stroke="#dbd5cd" strokeWidth={3} />
      <path
        d={d}
        fill="none"
        stroke={accent}
        strokeWidth={3}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={
          1 - Math.max(0, Math.min(1, progress * 3 - index * 0.3))
        }
        markerEnd={`url(#${id})`}
      />
    </g>
  );
  const focused = (index: number) => focus.includes(index);
  const packet = (frame % 120) / 120;
  return (
    <div
      data-knowledge-visual={plan.kind}
      data-knowledge-diagram={plan.kind}
      style={{ height: "100%", opacity: enter }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 24,
          paddingBottom: 14,
          borderBottom: `2px solid ${ink}`,
          height: 58,
        }}
      >
        <strong style={{ fontSize: 27 }}>{plan.title}</strong>
        <span
          style={{
            color: muted,
            fontSize: 16,
            maxWidth: "50%",
            textAlign: "right",
          }}
        >
          {plan.qualifier}
        </span>
      </div>
      <svg
        viewBox="0 0 1328 530"
        style={{ width: "100%", height: "calc(100% - 58px)" }}
        role="img"
        aria-label={`${plan.title}: ${plan.labels.join(", ")}`}
      >
        <defs>
          <marker
            id={id}
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={7}
            markerHeight={7}
            orient="auto"
          >
            <path d="M0 0L10 5L0 10" fill={accent} />
          </marker>
        </defs>
        {plan.kind === "acquisition" ? (
          <>
            {path("M375 113 H945")}
            <text
              x={664}
              y={88}
              textAnchor="middle"
              fill={accent}
              fontSize={21}
              fontWeight={750}
            >
              {en ? "Acquisition" : "收购"}
            </text>
            <Box
              frame={frame}
              duration={duration}
              x={100}
              y={57}
              width={275}
              label={plan.labels[0]}
              active={progress < 0.35}
            />
            <Box
              frame={frame}
              duration={duration}
              x={945}
              y={57}
              width={275}
              label={plan.labels[1]}
              active={progress >= 0.35}
            />
            {plan.operator ? (
              <>
                {path("M1082 169 V235 H665 V300", 1)}
                <Person x={665} y={365} label={plan.operator} />
              </>
            ) : null}
            {plan.operator && plan.labels.includes("Claude") ? (
              <>
                {path("M602 365 H370", 2)}
                <Box
                  frame={frame}
                  duration={duration}
                  x={110}
                  y={310}
                  width={260}
                  label="Claude"
                  sub={en ? "AI collaboration" : "AI 协作"}
                  active={/Claude|AI/.test(narration)}
                />
              </>
            ) : null}
            {plan.operator &&
            plan.labels.some((s) => /顾问|Consultants/.test(s)) ? (
              <>
                {path("M728 365 H950", 2)}
                <Box
                  frame={frame}
                  duration={duration}
                  x={950}
                  y={310}
                  width={260}
                  label={en ? "Consultants" : "专业顾问"}
                  sub={en ? "Professional support" : "专业支持"}
                />
              </>
            ) : null}
          </>
        ) : plan.kind === "hub" ? (
          <>
            {[
              [150, 105],
              [930, 105],
              [150, 345],
              [930, 345],
            ].map(([x, y], i) => (
              <g key={i}>
                {path(
                  `M664 260 Q${x + 110} 260 ${x + 110} ${y + 56}`,
                  i * 0.25,
                )}
                <Box
                  frame={frame}
                  duration={duration}
                  x={x}
                  y={y}
                  label={plan.labels[i]}
                  active={focused(i)}
                  index={i}
                />
                {focused(i) ? (
                  <circle
                    cx={
                      664 +
                      (x + 110 - 664) *
                        Math.min(1, ((frame + i * 24) % 105) / 105)
                    }
                    cy={
                      260 +
                      (y + 56 - 260) *
                        Math.min(1, ((frame + i * 24) % 105) / 105)
                    }
                    r={6}
                    fill={accent}
                  />
                ) : null}
              </g>
            ))}
            <Person
              x={664}
              y={255}
              label={en ? "Core operator" : "核心操作者"}
            />
          </>
        ) : plan.kind === "timelines" ? (
          <>
            {plan.labels.map((label, i) => (
              <g key={label} transform={`translate(0,${65 + i * 145})`}>
                <text
                  x={20}
                  y={48}
                  fontSize={29}
                  fontWeight={800}
                  fill={focused(i) ? accent : ink}
                >
                  {label}
                </text>
                <line
                  x1={255}
                  x2={1290}
                  y1={60}
                  y2={60}
                  stroke="#ddd7cf"
                  strokeWidth={2}
                />
                {i === 0 ? (
                  <>
                    <rect
                      x={275}
                      y={19}
                      width={720}
                      height={30}
                      rx={8}
                      fill="#e4ded6"
                    />
                    <rect
                      x={275}
                      y={64}
                      width={interpolate(progress, [0, 1], [140, 470], clamp)}
                      height={30}
                      rx={8}
                      fill={accent}
                    />
                    <text x={1040} y={40} fill={muted} fontSize={17}>
                      {en ? "Original (illustration)" : "原耗时（示意）"}
                    </text>
                    <text x={1040} y={85} fill={muted} fontSize={17}>
                      {en ? "Shortened (illustration)" : "缩短后（示意）"}
                    </text>
                  </>
                ) : i === 1 ? (
                  [0, 1, 2].map((n) => (
                    <g key={n}>
                      <rect
                        x={275 + n * 305}
                        y={30}
                        width={240}
                        height={54}
                        rx={12}
                        fill={progress > n / 4 ? "#ffe0c9" : "#e9e4dd"}
                        stroke={progress > n / 4 ? accent : "none"}
                      />
                      <text
                        x={395 + n * 305}
                        y={64}
                        textAnchor="middle"
                        fontSize={22}
                        fill={ink}
                      >
                        {
                          (en
                            ? ["Task", "Handoff", "Review"]
                            : ["任务", "衔接", "判断"])[n]
                        }
                      </text>
                      {n < 2 ? (
                        <path
                          d={`M${525 + n * 305} 57 H${565 + n * 305}`}
                          stroke={accent}
                          strokeWidth={3}
                          markerEnd={`url(#${id})`}
                        />
                      ) : null}
                    </g>
                  ))
                ) : (
                  [0, 1, 2].map((n) => (
                    <g key={n}>
                      <rect
                        x={275}
                        y={n * 27}
                        width={820}
                        height={18}
                        rx={6}
                        fill="#e9e4dd"
                      />
                      <rect
                        x={275}
                        y={n * 27}
                        width={Math.max(
                          0,
                          Math.min(820, (progress - n * 0.08) * 1000),
                        )}
                        height={18}
                        rx={6}
                        fill={n === 1 ? "#576b7f" : accent}
                      />
                      <text x={1130} y={n * 27 + 15} fill={muted} fontSize={18}>
                        {en
                          ? `Work ${String.fromCharCode(65 + n)}`
                          : `工作 ${String.fromCharCode(65 + n)}`}
                      </text>
                    </g>
                  ))
                )}
              </g>
            ))}
          </>
        ) : plan.kind === "workbench" ? (
          <>
            <rect
              x={20}
              y={35}
              width={1288}
              height={445}
              rx={22}
              fill="#fffcf8"
              stroke="#d9d2c9"
            />
            <rect
              x={20}
              y={35}
              width={1288}
              height={54}
              rx={22}
              fill="#e9e4dc"
            />
            <circle cx={50} cy={62} r={6} fill={accent} />
            <circle cx={72} cy={62} r={6} fill="#b9b1a7" />
            <text x={110} y={70} fontSize={19} fill={ink}>
              {en ? "Project workspace · illustration" : "项目工作台 · 示意"}
            </text>
            {plan.labels.map((label, i) => (
              <g key={label} transform={`translate(${45 + i * 420},115)`}>
                <rect
                  width={395}
                  height={335}
                  rx={16}
                  fill={focused(i) ? "#fff0e4" : "#f4f1ea"}
                />
                <text x={22} y={42} fontSize={27} fontWeight={800} fill={ink}>
                  {label}
                </text>
                <rect
                  x={22}
                  y={70}
                  width={350}
                  height={92}
                  rx={12}
                  fill="white"
                />
                <text x={40} y={110} fontSize={22} fill={ink}>
                  {
                    (en
                      ? [
                          "Summarize progress",
                          "Prepare suggestions",
                          "Draft content",
                        ]
                      : ["汇总进度", "整理修改建议", "起草内容"])[i]
                  }
                </text>
                <text x={40} y={143} fontSize={18} fill={muted}>
                  {en ? "AI prepares · human reviews" : "AI 准备 · 人工检查"}
                </text>
                <rect
                  x={22}
                  y={168}
                  width={350}
                  height={6}
                  rx={3}
                  fill="#ded8cf"
                />
                <rect
                  x={22}
                  y={168}
                  width={35 + (((frame + i * 31) % 120) / 120) * 315}
                  height={6}
                  rx={3}
                  fill={accent}
                />
                <rect
                  x={22}
                  y={182}
                  width={350}
                  height={117}
                  rx={12}
                  fill="white"
                />
                <circle
                  cx={46}
                  cy={214}
                  r={6}
                  fill={focused(i) ? accent : "#9ca8a0"}
                />
                <text
                  x={63}
                  y={222}
                  fontSize={22}
                  fontWeight={750}
                  fill={focused(i) ? accent : ink}
                >
                  {
                    (en
                      ? [
                          "Decision needed",
                          "Check evidence",
                          "Approval required",
                        ]
                      : ["需要决定", "检查证据", "等待批准"])[i]
                  }
                </text>
                <text x={40} y={267} fontSize={18} fill={muted}>
                  {en ? "Result → next action" : "结果可查 → 接着推进"}
                </text>
              </g>
            ))}
          </>
        ) : (
          <>
            <text x={28} y={70} fontSize={22} fill={muted}>
              {plan.kind === "practice"
                ? en
                  ? "Start small, then validate"
                  : "先跑通一条，再检查是否可靠"
                : en
                  ? "AI moves work forward; humans retain judgment"
                  : "AI 推进事务 · 人保留判断与责任"}
            </text>
            {plan.labels.map((label, i) => {
              const x = 18 + i * 264;
              return (
                <g key={label}>
                  {i < 4 ? path(`M${x + 236} 258 H${x + 260}`, i * 0.3) : null}
                  <Box
                    frame={frame}
                    duration={duration}
                    x={x}
                    y={195}
                    width={236}
                    label={label}
                    index={i}
                    active={focused(i)}
                  />
                  <circle
                    cx={x + 118}
                    cy={155}
                    r={22}
                    fill={i <= active ? accent : "#e1dbd3"}
                  />
                  <text
                    x={x + 118}
                    y={162}
                    fontSize={20}
                    fill="white"
                    textAnchor="middle"
                  >
                    {i < active ? "✓" : i + 1}
                  </text>
                </g>
              );
            })}
            {plan.kind === "collaboration" ? (
              <>
                {path("M1192 317 V415 H136 V317", 2)}
                <circle
                  r={7}
                  fill={accent}
                  cx={
                    packet < 0.1
                      ? 1192
                      : packet < 0.9
                        ? 1192 - ((packet - 0.1) / 0.8) * 1056
                        : 136
                  }
                  cy={
                    packet < 0.1
                      ? 317 + packet * 980
                      : packet < 0.9
                        ? 415
                        : 415 - (packet - 0.9) * 980
                  }
                />
                <text
                  x={664}
                  y={448}
                  fontSize={22}
                  fill={muted}
                  textAnchor="middle"
                >
                  {en
                    ? "Review results before the next action"
                    : "交回结果，检查后再继续"}
                </text>
              </>
            ) : (
              <text
                x={664}
                y={430}
                fontSize={24}
                fontWeight={700}
                fill={muted}
                textAnchor="middle"
              >
                {en
                  ? "Reliable results before adding more work"
                  : "结果可靠，再接入下一条工作线"}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
};
