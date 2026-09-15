import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out");
const tmpDir = path.join(root, ".workbench");
const port = Number(process.env.PORT || 5177);

let clientBundle = null;

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
      .shell { display: grid; grid-template-columns: minmax(360px, 440px) minmax(0, 1fr); min-height: 100vh; }
      .panel { padding: 24px; background: white; border-right: 1px solid #dde3ea; }
      .preview { padding: 24px; min-width: 0; }
      .brand { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
      h1 { margin: 0; font-size: 22px; line-height: 1.2; }
      .meta { margin-top: 6px; color: #687586; font-size: 13px; }
      textarea {
        width: 100%;
        height: calc(100vh - 220px);
        min-height: 420px;
        resize: vertical;
        border: 1px solid #cdd5df;
        border-radius: 8px;
        padding: 14px;
        color: #17202a;
        background: #fbfcfd;
        line-height: 1.55;
      }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      .stage { border-radius: 8px; overflow: hidden; background: #07090d; box-shadow: 0 18px 50px rgba(20, 29, 39, .18); }
      .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
      .stat { border-radius: 8px; background: white; border: 1px solid #dde3ea; padding: 12px; }
      .stat span { display: block; color: #687586; font-size: 12px; }
      .stat strong { display: block; margin-top: 4px; font-size: 18px; }
      .status { min-height: 24px; margin-top: 10px; color: #536170; font-size: 13px; }
      .status.error { color: #b42318; }
      @media (max-width: 980px) {
        .shell { grid-template-columns: 1fr; }
        .panel { border-right: 0; border-bottom: 1px solid #dde3ea; }
        textarea { height: 360px; min-height: 320px; }
        .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/bundle.js"></script>
  </body>
</html>`;

const getClientBundle = async () => {
  if (clientBundle) {
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
  const outputName = `markdown-video-${id}.mp4`;
  const outputPath = path.join(outDir, outputName);
  await writeFile(propsPath, JSON.stringify(props, null, 2), "utf8");

  const { command, prefix } = localRemotionCommand();
  const args = [
    ...prefix,
    "render",
    "IndieWeeklyMarkdown",
    outputPath,
    `--props=${propsPath}`,
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

    if (req.method === "POST" && pathname === "/api/render") {
      const body = await readJson(req);
      const result = await renderVideo(body.props);
      sendJson(res, 200, result);
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

server.listen(port, () => {
  console.log(`Markdown video workbench: http://localhost:${port}`);
});
