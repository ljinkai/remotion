import React from "react";
import { CHECKLIST_ITEMS, CHECKLIST_TITLE } from "../demoScript";
import { theme } from "../theme";

export const Checklist: React.FC<{
  activeIndex: number | null;
  progress: string;
  title?: string;
  items?: string[];
  entries?: { label: string; index: number }[];
  compact?: boolean;
}> = ({
  activeIndex,
  progress,
  title = CHECKLIST_TITLE,
  items = CHECKLIST_ITEMS,
  entries,
  compact = false,
}) => {
  const rows =
    entries ??
    items.map((label, index) => ({
      label,
      index,
    }));
  if (compact) {
    const current = rows.find((row) => row.index === activeIndex);
    return (
      <div
        data-chapter-strip
        style={{
          position: "absolute",
          left: 48,
          top: 1460,
          width: 640,
          borderTop: `2px solid ${theme.ink}`,
          borderBottom: `1px solid ${theme.line}`,
          padding: "19px 0",
          display: "flex",
          gap: 20,
          alignItems: "center",
          zIndex: 3,
        }}
      >
        <span
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: theme.accent,
            whiteSpace: "nowrap",
          }}
        >
          {progress}
        </span>
        <span
          style={{
            fontSize: 25,
            fontWeight: 700,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {current?.label || title}
        </span>
      </div>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        top: 1320,
        left: 48,
        width: 640,
        zIndex: 3,
        background: theme.card,
        borderRadius: 28,
        border: `3px solid ${theme.ink}`,
        padding: "22px 24px 20px",
        boxShadow: "0 10px 0 rgba(22,22,22,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 700, color: theme.ink }}>
          {title}
        </span>
        <span style={{ fontSize: 26, fontWeight: 760, color: theme.accent }}>
          {progress}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {rows.map(({ label, index }) => {
          const selected = index === activeIndex;
          return (
            <span
              key={`${index}-${label}`}
              style={{
                fontSize: 24,
                fontWeight: 700,
                maxWidth: "100%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                padding: "10px 16px",
                borderRadius: 14,
                background: selected ? theme.ink : theme.line,
                color: selected ? "#ffffff" : theme.ink,
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
};
