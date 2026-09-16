import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

let cached = null;

/**
 * Bundle TypeScript markdown / narration helpers for the Node service.
 */
export const loadMarkdownRuntime = async (root) => {
  if (cached) {
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
  return cached;
};
