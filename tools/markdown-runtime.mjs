import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

let cached = null;
let cachedMtimeMs = 0;

const sourceMtimeMs = async (root) => {
  const files = [
    path.join(root, "tools", "service-runtime-entry.ts"),
    path.join(root, "src", "markdown.ts"),
    path.join(root, "src", "subtitleLines.ts"),
    path.join(root, "src", "narrationScript.ts"),
    path.join(root, "src", "videoData.ts"),
  ];
  let latest = 0;
  for (const file of files) {
    try {
      const info = await stat(file);
      latest = Math.max(latest, info.mtimeMs);
    } catch {
      // ignore missing optional sources
    }
  }
  return latest;
};

/**
 * Bundle TypeScript markdown / narration helpers for the Node service.
 */
export const loadMarkdownRuntime = async (root) => {
  const mtimeMs = await sourceMtimeMs(root);
  if (cached && mtimeMs <= cachedMtimeMs) {
    return cached;
  }

  const outDir = path.join(root, ".workbench", "_runtime");
  const outfile = path.join(outDir, "service-runtime.mjs");
  await mkdir(outDir, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(root, "tools", "service-runtime-entry.ts")],
    bundle: true,
    write: true,
    outfile,
    format: "esm",
    platform: "node",
    packages: "bundle",
  });

  cached = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  cachedMtimeMs = mtimeMs;
  return cached;
};
