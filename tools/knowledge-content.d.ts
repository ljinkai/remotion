export type KnowledgeChapter = { id: string; title: string; narration: string; kind?: 'concept' | 'case' | 'mechanism' | 'application' | 'limits' | 'summary'; image?: string; sourceNote?: string; sourceRefs?: string[] };
export type KnowledgeDocument = { title: string; source: string; locale: 'zh' | 'en'; chapters: KnowledgeChapter[] };
export function createKnowledgeOutline(input: {source: string; title?: string; locale?: string}): KnowledgeDocument;
export function validateKnowledgeDocument(input: unknown): KnowledgeDocument;
export function splitKnowledgeNarration(narration: string, locale?: string): string[];
export function estimateKnowledgeBeatMs(text: string, locale?: string): number;
export function buildKnowledgeProps(input: KnowledgeDocument): Record<string, unknown>;
export function retimeKnowledgeProps<T>(props: T): T;
