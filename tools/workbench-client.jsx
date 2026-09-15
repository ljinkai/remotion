import { Player } from "@remotion/player";
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MyComponent } from "../src/Composition";
import { parseMarkdownToVideo, sampleMarkdown } from "../src/markdown";
import { getDurationInFrames } from "../src/videoData";

const savedMarkdown =
  localStorage.getItem("remotion-markdown") || sampleMarkdown;

function App() {
  const [markdown, setMarkdown] = useState(savedMarkdown);
  const [rendering, setRendering] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const props = useMemo(() => parseMarkdownToVideo(markdown), [markdown]);
  const durationInFrames = useMemo(() => getDurationInFrames(props), [props]);

  const updateMarkdown = (next) => {
    setMarkdown(next);
    localStorage.setItem("remotion-markdown", next);
    setError("");
    setStatus("");
  };

  const loadFile = async (file) => {
    if (!file) {
      return;
    }
    updateMarkdown(await file.text());
  };

  const renderVideo = async () => {
    setRendering(true);
    setError("");
    setStatus("渲染中...");
    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ props }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "渲染失败");
      }
      setStatus("渲染完成");
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("");
    } finally {
      setRendering(false);
    }
  };

  return (
    <main className="shell">
      <section className="panel">
        <div className="brand">
          <div>
            <h1>Markdown 视频工作台</h1>
            <p className="meta">IndieWeeklyMarkdown</p>
          </div>
          <label>
            <input
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              hidden
              onChange={(event) => loadFile(event.currentTarget.files?.[0])}
            />
            <button className="secondary" type="button">
              导入 MD
            </button>
          </label>
        </div>
        <textarea
          value={markdown}
          onChange={(event) => updateMarkdown(event.currentTarget.value)}
        />
        <div className="actions">
          <button type="button" onClick={() => updateMarkdown(sampleMarkdown)}>
            示例
          </button>
          <button
            className="secondary"
            type="button"
            onClick={renderVideo}
            disabled={rendering}
          >
            {rendering ? "渲染中" : "生成 MP4"}
          </button>
        </div>
        <div className={`status${error ? " error" : ""}`}>
          {error || status}
        </div>
      </section>

      <section className="preview">
        <div className="stage">
          <Player
            component={MyComponent}
            inputProps={props}
            durationInFrames={durationInFrames}
            fps={30}
            compositionWidth={1920}
            compositionHeight={1080}
            style={{ width: "100%", aspectRatio: "16 / 9" }}
            controls
            loop
          />
        </div>
        <div className="summary">
          <div className="stat">
            <span>期号</span>
            <strong>{props.issueNumber}</strong>
          </div>
          <div className="stat">
            <span>主题</span>
            <strong>{props.coverTitle}</strong>
          </div>
          <div className="stat">
            <span>条目</span>
            <strong>{props.cases.length}</strong>
          </div>
          <div className="stat">
            <span>时长</span>
            <strong>{Math.round(durationInFrames / 30)}s</strong>
          </div>
        </div>
        <p className="meta">
          输出目录：<code>out/</code>
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
