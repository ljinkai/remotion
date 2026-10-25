import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { enrichBeatScenes } from "./beat-spec.mjs";

const text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const chartTypes = new Set(["milestones", "comparison", "proportion", "single"]);
export const normalizeEvidenceFocus = (raw) => {
  if (!raw || ![raw.x, raw.y, raw.width, raw.height].every(finite)) return null;
  if (raw.x < 0 || raw.y < 0 || raw.width <= 0 || raw.height <= 0 || raw.x + raw.width > 1 || raw.y + raw.height > 1) return null;
  return { x: raw.x, y: raw.y, width: raw.width, height: raw.height, ...(text(raw.label, 60) ? { label: text(raw.label, 60) } : {}) };
};
const chart = (raw) => {
  if (!raw || !chartTypes.has(raw.chartType) || !text(raw.title, 80) || !text(raw.unit, 60) || !Array.isArray(raw.data) || !raw.data.length || raw.data.length > 12) return null;
  const data = raw.data.map((point) => {
    if (!point || !text(point.label, 60) || !finite(point.value) || point.value < 0) return null;
    return { label: text(point.label, 60), value: point.value, ...(text(point.display, 80) ? { display: text(point.display, 80) } : {}), ...(text(point.note, 160) ? { note: text(point.note, 160) } : {}) };
  });
  if (data.some((point) => !point) || (raw.chartType === "single" && data.length !== 1)) return null;
  // A proportion requires an explicitly reviewed denominator, not an inferred total.
  if (raw.chartType === "proportion") return null;
  return { type: "chart", chartType: raw.chartType, title: text(raw.title, 80), unit: text(raw.unit, 60), data, ...(text(raw.source, 240) ? { source: text(raw.source, 240) } : {}) };
};
const relationship = (raw) => {
  if (!raw || !Array.isArray(raw.nodes) || raw.nodes.length < 2 || raw.nodes.length > 8 || !["focus", "flow"].includes(raw.mode)) return null;
  const nodes = raw.nodes.map((node) => text(node, 40));
  if (nodes.some((node) => !node) || new Set(nodes).size !== nodes.length) return null;
  const focus = Number.isInteger(raw.focus) && raw.focus >= 0 && raw.focus < nodes.length ? raw.focus : 0;
  return { type: "relationship", title: text(raw.title, 80), nodes, focus, mode: raw.mode };
};

/** Only manually reviewed profiles bound to the exact local image bytes are exposed. */
export const loadHostEvidence = async (root) => {
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(root, "public/host-evidence.json"), "utf8")); } catch { return { profiles: [] }; }
  if (manifest?.version !== 1 || !Array.isArray(manifest.profiles)) return { profiles: [] };
  const publicRoot = await realpath(path.join(root, "public"));
  const profiles = [];
  for (const raw of manifest.profiles) {
    if (!raw || typeof raw.image !== "string" || !/^[a-f0-9]{64}$/i.test(raw.sha256 || "") || !text(raw.evidenceText, 2000)) continue;
    const image = raw.image.replace(/^\//, "");
    if (!image || image.split(/[\\/]/).includes("..") || /[:\\]/.test(image)) continue;
    try {
      const file = await realpath(path.join(publicRoot, image));
      if (!file.startsWith(publicRoot + path.sep)) continue;
      const digest = createHash("sha256").update(await readFile(file)).digest("hex");
      if (digest !== raw.sha256.toLowerCase()) continue;
      const focus = normalizeEvidenceFocus(raw.focus);
      const verifiedChart = raw.chart === undefined ? undefined : chart(raw.chart);
      const verifiedRelationship = raw.relationship === undefined ? undefined : relationship(raw.relationship);
      if ((raw.focus !== undefined && !focus) || (raw.chart !== undefined && !verifiedChart) || (raw.relationship !== undefined && !verifiedRelationship)) continue;
      profiles.push({ image: raw.image, sha256: digest, title: text(raw.title, 100), reviewedAt: text(raw.reviewedAt, 30), evidenceText: text(raw.evidenceText, 2000), ...(focus ? { focus } : {}), ...(verifiedChart ? { chart: verifiedChart } : {}), ...(verifiedRelationship ? { relationship: verifiedRelationship } : {}) });
    } catch { /* Stale/missing/unreadable images cannot supply evidence. */ }
  }
  return { profiles };
};

/** Replace client evidence and revalidate rich elements before planning or rendering. */
export const withVerifiedHostEvidence = async (props, root) => {
  if (!props || typeof props !== "object") throw new Error("缺少 props");
  const verified = { ...props, hostEvidence: (await loadHostEvidence(root)).profiles };
  return Array.isArray(props.beats) ? { ...verified, beats: enrichBeatScenes(props.beats, verified) } : verified;
};
