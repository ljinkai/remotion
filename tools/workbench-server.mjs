import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import esbuild from "esbuild";
import { synthesizeVideoProps } from "./synthesize-props.mjs";
import { embedLocalAudioAsDataUrls } from "./embed-audio-data-urls.mjs";
import { generateNarrationScript } from "./script-llm.mjs";
import { createQueuedJob, publicJobView, readJob } from "./render-job-store.mjs";
import { enqueueRenderJob } from "./render-job-worker.mjs";
import { normalizeRenderJobOptions } from "./render-job-options.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });
const outDir = path.join(root, "out");
const tmpDir = path.join(root, ".workbench");
const port = Number(process.env.PORT || 5177);
const host = process.env.HOST || "0.0.0.0";

let clientBundle = null;

const DEFAULT_RENDER_API_KEY = "vidflow-remotion-shared-key-2026";

const getConfiguredApiKey = () =>
  process.env.RENDER_API_KEY?.trim() || DEFAULT_RENDER_API_KEY;

const extractApiKey = (req) => {
  const headerKey = req.headers["x-api-key"];
  if (typeof headerKey === "string" && headerKey.trim()) {
    return headerKey.trim();
  }
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
};

const requireApiKey = (req, res) => {
  const expected = getConfiguredApiKey();
  if (extractApiKey(req) !== expected) {
    sendJson(res, 401, { error: "Unauthorized" });
    return false;
  }
  return true;
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, headers);
  res.end(body);
};

const sendJson = (res, status, body) => {
  send(res, status, JSON.stringify(body), {
    "content-type": "application/json; charset=utf-8",
  });
};

const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
};

const renderWorkbenchHtml = () => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Remotion Markdown Workbench</title>
    <link rel="stylesheet" href="/video.css" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: #f4f6f8;
        color: #17202a;
        font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      }
      button, textarea, input { font: inherit; }
      button {
        border: 0;
        border-radius: 8px;
        padding: 10px 14px;
        background: #17202a;
        color: white;
        font-weight: 700;
        cursor: pointer;
      }
      button.secondary { background: #e7ebef; color: #17202a; }
      button:disabled { cursor: not-allowed; opacity: .55; }
      a { color: #0f766e; font-weight: 700; text-decoration: none; }
      .shell {
        display: grid;
        grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
        height: 100vh;
        overflow: hidden;
      }
      .panel {
        display: flex;
        flex-direction: column;
        min-height: 0;
        padding: 16px 16px 12px;
        background: white;
        border-right: 1px solid #dde3ea;
      }
      .workspace {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        padding: 12px 12px 12px;
        overflow: hidden;
      }
      .workspaceMain {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.9fr);
        gap: 12px;
      }
      .previewCol {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
      }
      .cueCol {
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .brand {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
        flex: 0 0 auto;
      }
      h1 { margin: 0; font-size: 18px; line-height: 1.2; }
      .meta { margin-top: 4px; color: #687586; font-size: 12px; }
      .editorTabs {
        display: flex;
        gap: 4px;
        margin-bottom: 10px;
        padding: 3px;
        border-radius: 8px;
        background: #eef2f6;
        flex: 0 0 auto;
      }
      .editorTab {
        flex: 1;
        padding: 7px 10px;
        border-radius: 6px;
        background: transparent;
        color: #536170;
        font-size: 13px;
        font-weight: 700;
      }
      .editorTab.active {
        background: white;
        color: #17202a;
        box-shadow: 0 1px 2px rgba(15, 23, 42, .08);
      }
      .editorBody {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      textarea.mdEditor {
        width: 100%;
        flex: 1;
        min-height: 0;
        height: auto;
        resize: none;
        border: 1px solid #cdd5df;
        border-radius: 8px;
        padding: 12px;
        color: #17202a;
        background: #fbfcfd;
        line-height: 1.55;
      }
      .panelActions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
        flex: 0 0 auto;
      }
      .panelActions button { padding: 8px 12px; font-size: 13px; }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 14px;
        margin-bottom: 10px;
        padding: 8px 10px;
        border: 1px solid #dde3ea;
        border-radius: 8px;
        background: white;
        flex: 0 0 auto;
      }
      .toolbarGroup {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .toolbarGroup > span {
        color: #687586;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
      }
      .toolbarGrow { flex: 1; min-width: 8px; }
      .seg {
        display: inline-flex;
        padding: 2px;
        border-radius: 7px;
        background: #eef2f6;
      }
      .seg button {
        padding: 6px 10px;
        border-radius: 5px;
        background: transparent;
        color: #536170;
        font-size: 12px;
        font-weight: 700;
      }
      .seg button.active {
        background: white;
        color: #17202a;
        box-shadow: 0 1px 2px rgba(15, 23, 42, .08);
      }
      .swatchRow { display: inline-flex; gap: 6px; align-items: center; }
      .swatchBtn {
        width: 22px;
        height: 22px;
        padding: 0;
        border-radius: 999px;
        border: 2px solid transparent;
        background: #111;
      }
      .swatchBtn.active {
        border-color: #0f766e;
        box-shadow: 0 0 0 2px rgba(15, 118, 110, .2);
      }
      .swatchBtn[data-template="midnight"] {
        background: linear-gradient(135deg, #07090d, #38d6c6 55%, #ff7b68);
      }
      .swatchBtn[data-template="noir"] {
        background: linear-gradient(135deg, #050505, #e8c547 60%, #f5f5f5);
      }
      .swatchBtn[data-template="ocean"] {
        background: linear-gradient(135deg, #061018, #5ec8ff 55%, #7ad7c5);
      }
      .swatchBtn[data-template="ember"] {
        background: linear-gradient(135deg, #120a08, #ff8a5b 55%, #ffc857);
      }
      .swatchBtn[data-template="studio"] {
        background: linear-gradient(135deg, #0e1116, #64d2ff 50%, #a78bfa);
      }
      .toolbarActions { display: flex; flex-wrap: wrap; gap: 8px; }
      .toolbarActions button { padding: 7px 12px; font-size: 13px; }
      .stage {
        border-radius: 8px;
        overflow: hidden;
        background: #07090d;
        box-shadow: 0 10px 28px rgba(20, 29, 39, .14);
        max-height: min(52vh, 520px);
        display: flex;
        justify-content: center;
        align-items: center;
        flex: 0 0 auto;
      }
      .stage--portrait {
        background: #0b0e14;
        padding: 8px 0;
        max-height: min(56vh, 560px);
      }
      .previewMeta {
        margin: 8px 0 0;
        color: #536170;
        font-size: 12px;
        line-height: 1.5;
        flex: 0 0 auto;
      }
      .previewMeta code {
        font-size: 11px;
        background: #eef2f6;
        padding: 1px 5px;
        border-radius: 4px;
      }
      .status { min-height: 20px; margin-top: 8px; color: #536170; font-size: 12px; flex: 0 0 auto; }
      .status.error { color: #b42318; }
      .scriptPanel {
        flex: 1;
        min-height: 0;
        overflow: auto;
        border: 1px solid #dde3ea;
        border-radius: 8px;
        background: #fbfcfd;
        padding: 10px 12px;
      }
      .scriptPanel h3 {
        margin: 0 0 8px;
        font-size: 13px;
      }
      .scriptField {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 10px;
      }
      .scriptField label {
        font-size: 12px;
        font-weight: 700;
        color: #536170;
      }
      .scriptField textarea {
        width: 100%;
        min-height: 72px;
        height: auto;
        resize: vertical;
        border: 1px solid #cdd5df;
        border-radius: 8px;
        padding: 10px;
        background: white;
        line-height: 1.45;
      }
      .scriptEmpty {
        margin: 0;
        padding: 18px 8px;
        color: #687586;
        font-size: 13px;
        line-height: 1.5;
      }
      .cueTimeline {
        margin-top: 0;
        height: 100%;
        border: 1px solid #dde3ea;
        border-radius: 8px;
        background: white;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .cueTimeline.cueTimeline--empty {
        justify-content: flex-start;
      }
      .cueTimelineHeader {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        padding: 10px 12px;
        border-bottom: 1px solid #eef2f6;
        background: #fbfcfd;
        flex: 0 0 auto;
      }
      .cueTimeline h3 {
        margin: 0;
        font-size: 13px;
      }
      .cueTimelineNow {
        color: #0f766e;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.35;
      }
      .cueTimelineBody {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 8px 10px 12px;
      }
      .cueTimelineEmpty {
        margin: 0;
        padding: 12px;
        color: #687586;
        font-size: 12px;
        line-height: 1.5;
      }
      .cueSceneGroup + .cueSceneGroup {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #eef2f6;
      }
      .cueSceneGroup h4 {
        margin: 0 0 6px;
        color: #536170;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .02em;
        text-transform: uppercase;
      }
      .cueSceneGroup ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .cueRow {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: stretch;
        margin: 0 0 6px;
        padding: 8px 10px;
        border: 1px solid #e7ebef;
        border-radius: 8px;
        background: #fff;
        color: #17202a;
        text-align: left;
        cursor: pointer;
      }
      .cueRow:hover { background: #f7fafc; }
      .cueRow.active {
        border-color: #0f766e;
        background: #ecfdf8;
        box-shadow: inset 0 0 0 1px rgba(15, 118, 110, .08);
      }
      .cueTime {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 11px;
        font-weight: 800;
        color: #334155;
        font-variant-numeric: tabular-nums;
      }
      .cueTime small {
        font-size: 10px;
        font-weight: 600;
        color: #687586;
      }
      .cueText {
        font-size: 12px;
        line-height: 1.45;
      }
      @media (max-width: 1100px) {
        .workspaceMain {
          grid-template-columns: 1fr;
          overflow: auto;
        }
        .cueCol { min-height: 240px; }
        .stage, .stage--portrait { max-height: min(40vh, 420px); }
      }
      @media (max-width: 980px) {
        .shell {
          grid-template-columns: 1fr;
          height: auto;
          overflow: visible;
        }
        .panel {
          border-right: 0;
          border-bottom: 1px solid #dde3ea;
          max-height: 55vh;
        }
        .workspace { overflow: visible; }
        .workspaceMain { overflow: visible; }
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/bundle.js"></script>
  </body>
</html>`;

const getClientBundle = async () => {
  if (clientBundle && process.env.NODE_ENV === "production") {
    return clientBundle;
  }

  const result = await esbuild.build({
    entryPoints: [path.join(root, "tools", "workbench-client.jsx")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    define: {
      "process.env.NODE_ENV": JSON.stringify("development"),
    },
    loader: {
      ".ts": "ts",
      ".tsx": "tsx",
    },
  });

  clientBundle = result.outputFiles[0].text;
  return clientBundle;
};

const localRemotionCommand = () => {
  const binary = path.join(root, "node_modules", ".bin", "remotion");
  return { command: binary, prefix: [] };
};

const renderVideo = async (props) => {
  await mkdir(outDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });

  const id = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const propsPath = path.join(tmpDir, `props-${id}.json`);
  const aspect = props?.aspect === "portrait" ? "portrait" : "landscape";
  const compositionId =
    aspect === "portrait"
      ? "IndieWeeklyMarkdownPortrait"
      : "IndieWeeklyMarkdown";
  const outputName = `markdown-video-${aspect}-${id}.mp4`;
  const outputPath = path.join(outDir, outputName);
  const renderProps = await embedLocalAudioAsDataUrls(props, root);
  await writeFile(propsPath, JSON.stringify(renderProps, null, 2), "utf8");

  const { command, prefix } = localRemotionCommand();
  const args = [
    ...prefix,
    "render",
    compositionId,
    outputPath,
    `--props=${propsPath}`,
    "--public-dir=public",
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          stderr.slice(-2400) || `Remotion render failed with code ${code}`,
        ),
      );
    });
  });

  return { file: outputName, url: `/renders/${outputName}` };
};

const formatRenderError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("macOS 15") ||
    message.includes("AVCaptureDeviceTypeContinuityCamera")
  ) {
    return "当前 macOS 版本低于 Remotion 4.0.523 compositor 要求，页面预览可用，但本机无法合成 MP4。请在 macOS 15+ 或 CI/Linux 环境渲染。";
  }
  return message;
};

const servePublicAsset = async (pathname, res) => {
  const rel = decodeURIComponent(pathname.replace(/^\/+/, ""));
  const target = path.resolve(root, "public", rel);
  if (!target.startsWith(path.resolve(root, "public"))) {
    return false;
  }

  try {
    createReadStream(target)
      .on("error", () => send(res, 404, "Not found"))
      .pipe(res);
    return true;
  } catch {
    return false;
  }
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`,
    );
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/") {
      send(res, 200, renderWorkbenchHtml(), {
        "content-type": "text/html; charset=utf-8",
      });
      return;
    }

    if (req.method === "GET" && pathname === "/bundle.js") {
      send(res, 200, await getClientBundle(), {
        "content-type": "text/javascript; charset=utf-8",
      });
      return;
    }

    if (req.method === "GET" && pathname === "/video.css") {
      send(
        res,
        200,
        await readFile(path.join(root, "src", "index.css"), "utf8"),
        {
          "content-type": "text/css; charset=utf-8",
        },
      );
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/renders/")) {
      const name = path.basename(pathname);
      createReadStream(path.join(outDir, name))
        .on("error", () => send(res, 404, "Not found"))
        .pipe(res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/script") {
      const body = await readJson(req);
      if (!body.props || typeof body.props !== "object") {
        sendJson(res, 400, { error: "缺少 props" });
        return;
      }
      if (!Array.isArray(body.props.cases) || body.props.cases.length === 0) {
        sendJson(res, 400, { error: "props.cases 不能为空" });
        return;
      }
      const script = await generateNarrationScript(body.props, {
        markdown: body.markdown,
        root,
      });
      sendJson(res, 200, { script });
      return;
    }

    if (req.method === "POST" && pathname === "/api/synthesize") {
      const body = await readJson(req);
      if (!body.props || typeof body.props !== "object") {
        sendJson(res, 400, { error: "缺少 props" });
        return;
      }
      const result = await synthesizeVideoProps(body.props, { root });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && pathname === "/api/render") {
      const body = await readJson(req);
      const result = await renderVideo(body.props);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && pathname === "/api/v1/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "POST" && pathname === "/api/v1/render-jobs") {
      if (!requireApiKey(req, res)) {
        return;
      }
      const body = await readJson(req);
      const markdown =
        typeof body.markdown === "string" ? body.markdown.trim() : "";
      const callbackUrl =
        typeof body.callback_url === "string" ? body.callback_url.trim() : "";
      if (!markdown) {
        sendJson(res, 400, { error: "markdown 必填" });
        return;
      }
      if (!callbackUrl) {
        sendJson(res, 400, { error: "callback_url 必填" });
        return;
      }
      try {
        // eslint-disable-next-line no-new
        new URL(callbackUrl);
      } catch {
        sendJson(res, 400, { error: "callback_url 非法" });
        return;
      }
      const job = await createQueuedJob(root, {
        markdown,
        client_ref:
          body.client_ref === undefined || body.client_ref === null
            ? null
            : String(body.client_ref),
        callback_url: callbackUrl,
        options: normalizeRenderJobOptions(body.options),
      });
      enqueueRenderJob(root, job.job_id);
      sendJson(res, 202, {
        job_id: job.job_id,
        status: job.status,
        client_ref: job.client_ref,
        aspect: job.options?.aspect || "landscape",
      });
      return;
    }

    const jobMatch = pathname.match(/^\/api\/v1\/render-jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      if (!requireApiKey(req, res)) {
        return;
      }
      const job = await readJob(root, decodeURIComponent(jobMatch[1]));
      if (!job) {
        sendJson(res, 404, { error: "Job not found" });
        return;
      }
      sendJson(res, 200, publicJobView(job));
      return;
    }

    if (req.method === "GET" && (await servePublicAsset(pathname, res))) {
      return;
    }

    send(res, 404, "Not found");
  } catch (error) {
    sendJson(res, 500, {
      error: formatRenderError(error),
    });
  }
});

server.listen(port, host, () => {
  console.log(`Markdown video workbench: http://${host}:${port}`);
});
