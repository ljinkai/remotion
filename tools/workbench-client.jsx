import { Player } from "@remotion/player";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MyComponent } from "../src/Composition";
import {
  parseMarkdownToVideo,
  sampleMarkdown,
  tryBuildScriptFromMarkdown,
} from "../src/markdown";
import {
  applyNarrationScript,
  scriptIsComplete,
} from "../src/narrationScript";
import { getDurationInFrames } from "../src/videoData";
import { CueTimelinePanel } from "./cue-timeline-panel";

const savedMarkdown =
  localStorage.getItem("remotion-markdown") || sampleMarkdown;

function App() {
  const playerRef = useRef(null);
  const [markdown, setMarkdown] = useState(savedMarkdown);
  const [rendering, setRendering] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [scripting, setScripting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [script, setScript] = useState(null);
  const [synthesizedProps, setSynthesizedProps] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);

  const parsedProps = useMemo(
    () => parseMarkdownToVideo(markdown),
    [markdown],
  );
  const scriptedProps = useMemo(
    () => (script ? applyNarrationScript(parsedProps, script) : parsedProps),
    [parsedProps, script],
  );
  const props = synthesizedProps ?? scriptedProps;
  const durationInFrames = useMemo(() => getDurationInFrames(props), [props]);
  const hasVoice = props.useSynthesizedTimeline === true;
  const hasScript = scriptIsComplete(script);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return undefined;
    }

    const onFrameUpdate = ({ detail }) => {
      setCurrentFrame(detail.frame);
    };

    player.addEventListener("frameupdate", onFrameUpdate);
    return () => player.removeEventListener("frameupdate", onFrameUpdate);
  }, [hasVoice, props]);

  const updateMarkdown = (next) => {
    setMarkdown(next);
    localStorage.setItem("remotion-markdown", next);
    setScript(null);
    setSynthesizedProps(null);
    setCurrentFrame(0);
    setError("");
    setStatus("");
  };

  const loadFile = async (file) => {
    if (!file) {
      return;
    }
    updateMarkdown(await file.text());
  };

  const updateScriptField = (patch) => {
    setScript((prev) => {
      if (!prev) {
        return prev;
      }
      return { ...prev, ...patch, source: "manual" };
    });
    setSynthesizedProps(null);
  };

  const updateCaseNarration = (index, narration) => {
    setScript((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        source: "manual",
        cases: prev.cases.map((item) =>
          item.index === index ? { ...item, narration } : item,
        ),
      };
    });
    setSynthesizedProps(null);
  };

  const generateScript = async () => {
    setScripting(true);
    setError("");
    setStatus("正在生成逐字稿...");
    try {
      const fromMarkdown = tryBuildScriptFromMarkdown(markdown);
      if (fromMarkdown) {
        setScript(fromMarkdown);
        setSynthesizedProps(null);
        setStatus("已从 Markdown 旁白字段载入逐字稿（未调用千问）");
        return;
      }

      const response = await fetch("/api/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ props: parsedProps }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "生成逐字稿失败");
      }
      setScript(body.script);
      setSynthesizedProps(null);
      setStatus("千问逐字稿已生成，可编辑后再合成语音");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("");
    } finally {
      setScripting(false);
    }
  };

  const synthesizeSpeech = async () => {
    setSynthesizing(true);
    setError("");
    setStatus(
      hasScript
        ? "正在按逐字稿合成语音..."
        : "正在合成语音（未生成逐字稿，使用 MD 短句）...",
    );
    try {
      const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ props: scriptedProps }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "语音合成失败");
      }
      setSynthesizedProps(body.props);
      setCurrentFrame(0);
      playerRef.current?.seekTo(0);
      setStatus(`语音合成完成（${body.synthId}）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("");
    } finally {
      setSynthesizing(false);
    }
  };

  const renderVideo = async () => {
    setRendering(true);
    setError("");
    setStatus(hasVoice ? "渲染中..." : "渲染中（未合成语音，使用固定时长）...");
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

  const seekToCue = (frame) => {
    playerRef.current?.seekTo(frame);
    setCurrentFrame(frame);
  };

  const busy = rendering || synthesizing || scripting;

  return (
    <main className="shell">
      <section className="panel">
        <div className="brand">
          <div>
            <h1>Markdown 视频工作台</h1>
            <p className="meta">千问逐字稿 · Azure Speech</p>
          </div>
          <label>
            <input
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              hidden
              onChange={(event) => loadFile(event.target.files?.[0])}
            />
            <button className="secondary" type="button">
              导入 MD
            </button>
          </label>
        </div>
        <textarea
          value={markdown}
          onChange={(event) => updateMarkdown(event.target.value)}
        />
        <div className="actions">
          <button type="button" onClick={() => updateMarkdown(sampleMarkdown)}>
            示例
          </button>
          <button
            className="secondary"
            type="button"
            onClick={generateScript}
            disabled={busy}
          >
            {scripting ? "生成中" : "生成逐字稿"}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={synthesizeSpeech}
            disabled={busy}
          >
            {synthesizing ? "合成中" : "合成语音"}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={renderVideo}
            disabled={busy}
          >
            {rendering ? "渲染中" : "生成 MP4"}
          </button>
        </div>
        <div className={`status${error ? " error" : ""}`}>
          {error || status}
        </div>
        {!hasScript ? (
          <p className="meta">
            建议先点「生成逐字稿」（千问），编辑口播后再「合成语音」。
          </p>
        ) : null}

        {script ? (
          <section className="scriptPanel">
            <h3>
              逐字稿
              <span className="meta"> · {script.source}</span>
            </h3>
            <div className="scriptField">
              <label>封面 / 导语</label>
              <textarea
                value={script.intro}
                onChange={(event) =>
                  updateScriptField({ intro: event.target.value })
                }
              />
            </div>
            {script.cases.map((item) => (
              <div className="scriptField" key={item.index}>
                <label>
                  案例 {item.index} · {item.title}
                </label>
                <textarea
                  value={item.narration}
                  onChange={(event) =>
                    updateCaseNarration(item.index, event.target.value)
                  }
                />
              </div>
            ))}
            <div className="scriptField">
              <label>结尾</label>
              <textarea
                value={script.closing}
                onChange={(event) =>
                  updateScriptField({ closing: event.target.value })
                }
              />
            </div>
          </section>
        ) : null}
      </section>

      <section className="preview">
        <div className="stage">
          <Player
            ref={playerRef}
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
        <CueTimelinePanel
          props={props}
          hasVoice={hasVoice}
          currentFrame={currentFrame}
          onSeek={seekToCue}
        />
        <p className="meta">
          逐字稿：<code>{hasScript ? script.source : "未生成"}</code> · 语音：
          <code>{hasVoice ? "已合成" : "未合成"}</code> · 输出：
          <code>out/</code>
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
