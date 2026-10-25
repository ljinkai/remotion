export function sanitizeSvg(markup: string): string;
export function compositionIdForProps(props: {
  templateId?: string;
  aspect?: string;
}): string;

export function enrichBeatScenes<T extends { say: string; elements: unknown[]; caseIndex?: number | null; scene?: string }>(beats: T[], props: unknown): Array<T & { scene: "product" | "metric" | "steps" | "statement" | "relationship" }>;
