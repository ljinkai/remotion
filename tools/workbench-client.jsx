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
import { optimizeNarrationForSubtitles } from "../src/subtitleLines";
import { getDurationInFrames } from "../src/videoData";
import {
  VIDEO_TEMPLATES,
  resolveTemplateId,
} from "../src/videoTemplates";
import {
  VIDEO_FORMATS,
  getVideoFormat,
  resolveAspect,
} from "../src/videoFormats";
import { CueTimelinePanel } from "./cue-timeline-panel";

const savedMarkdown =
  localStorage.getItem("remotion-markdown") || sampleMarkdown;
const savedTemplate = resolveTemplateId(
  localStorage.getItem("remotion-template"),
);
const savedAspect = resolveAspect(localStorage.getItem("remotion-aspect"));

function App() {
  const playerRef = useRef(null);
  const [markdown, setMarkdown] = useState(savedMarkdown);
  const [templateId, setTemplateId] = useState(savedTemplate);
  const [aspect, setAspect] = useState(savedAspect);
  const [rendering, setRendering] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [scripting, setScripting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [script, setScript] = useState(null);
  const [synthesizedProps, setSynthesizedProps] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [editorTab, setEditorTab] = useState("markdown");

  const parsedProps = useMemo(
    () => parseMarkdownToVideo(markdown),
    [markdown],
  );
  const scriptedProps = useMemo(
    () => (script ? applyNarrationScript(parsedProps, script) : parsedProps),
    [parsedProps, script],
  );
  const props = useMemo(
    () => ({
      ...(synthesizedProps ?? scriptedProps),
      templateId,
      aspect,
    }),
    [synthesizedProps, scriptedProps, templateId, aspect],
  );
  const durationInFrames = useMemo(() => getDurationInFrames(props), [props]);
  const hasVoice = props.useSynthesizedTimeline === true;
  const hasScript = scriptIsComplete(script);
  const activeTemplate =
    VIDEO_TEMPLATES.find((item) => item.id === templateId) ||
    VIDEO_TEMPLATES[0];
  const activeFormat = getVideoFormat(aspect);

  const selectTemplate = (id) => {
    const next = resolveTemplateId(id);
    setTemplateId(next);
    localStorage.setItem("remotion-template", next);
  };

  const selectAspect = (id) => {
    const next = resolveAspect(id);
    setAspect(next);
    localStorage.setItem("remotion-aspect", next);
    setCurrentFrame(0);
    playerRef.current?.seekTo(0);
  };

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

  const formatScript = (raw) => {
    if (!raw || typeof raw !== "object") {
      return raw;
    }
    return {
      ...raw,
      intro: optimizeNarrationForSubtitles(raw.intro ?? ""),
      closing: optimizeNarrationForSubtitles(raw.closing ?? ""),
      cases: Array.isArray(raw.cases)
        ? raw.cases.map((item) => ({
            ...item,
            narration: optimizeNarrationForSubtitles(item.narration ?? ""),
          }))
        : [],
    };
  };

  const generateScript = async () => {
    setScripting(true);
    setError("");
    setStatus("正在生成逐字稿...");
    try {
      const fromMarkdown = tryBuildScriptFromMarkdown(markdown);
      if (fromMarkdown) {
        setScript(formatScript(fromMarkdown));
        setSynthesizedProps(null);
        setEditorTab("script");
        setStatus("已从 Markdown 旁白载入逐字稿（已按字幕行拆分）");
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
      setScript(formatScript(body.script));
      setSynthesizedProps(null);
      setEditorTab("script");
      setStatus("千问逐字稿已生成（已按字幕行拆分），可编辑后再合成");
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
      const cache = body.cache;
      const cacheNote = cache
        ? `，缓存命中 ${cache.hits}/未命中 ${cache.misses}`
        : "";
      setStatus(`语音合成完成（${body.synthId}${cacheNote}）`);
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

        <div className="editorTabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={editorTab === "markdown"}
            className={`editorTab${editorTab === "markdown" ? " active" : ""}`}
            onClick={() => setEditorTab("markdown")}
          >
            Markdown
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={editorTab === "script"}
            className={`editorTab${editorTab === "script" ? " active" : ""}`}
            onClick={() => setEditorTab("script")}
          >
            逐字稿{hasScript ? "" : " · 未生成"}
          </button>
        </div>

        <div className="editorBody">
          {editorTab === "markdown" ? (
            <textarea
              className="mdEditor"
              value={markdown}
              onChange={(event) => updateMarkdown(event.target.value)}
            />
          ) : script ? (
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
          ) : (
            <section className="scriptPanel">
              <p className="scriptEmpty">
                还没有逐字稿。点右侧工具栏「生成逐字稿」，或先在 Markdown
                里写好旁白后再生成。
              </p>
            </section>
          )}
        </div>

        <div className="panelActions">
          <button
            className="secondary"
            type="button"
            onClick={() => updateMarkdown(sampleMarkdown)}
          >
            示例
          </button>
        </div>
        <div className={`status${error ? " error" : ""}`}>
          {error || status}
        </div>
      </section>

      <section className="workspace">
        <div className="toolbar">
          <div className="toolbarGroup">
            <span>画幅</span>
            <div className="seg">
              {VIDEO_FORMATS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={aspect === item.id ? "active" : ""}
                  onClick={() => selectAspect(item.id)}
                  title={item.blurb}
                >
                  {item.id === "landscape" ? "横屏" : "竖屏"}
                </button>
              ))}
            </div>
          </div>

          <div className="toolbarGroup">
            <span>模板</span>
            <div className="swatchRow">
              {VIDEO_TEMPLATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`swatchBtn${templateId === item.id ? " active" : ""}`}
                  data-template={item.id}
                  onClick={() => selectTemplate(item.id)}
                  title={`${item.label} · ${item.blurb}`}
                  aria-label={item.label}
                />
              ))}
            </div>
            <span className="meta" style={{ marginTop: 0 }}>
              {activeTemplate.label}
            </span>
          </div>

          <div className="toolbarGrow" />

          <div className="toolbarActions">
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setEditorTab("script");
                generateScript();
              }}
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
            <button type="button" onClick={renderVideo} disabled={busy}>
              {rendering ? "渲染中" : "生成 MP4"}
            </button>
          </div>
        </div>

        <div className="workspaceMain">
          <div className="previewCol">
            <div
              className={`stage${aspect === "portrait" ? " stage--portrait" : ""}`}
            >
              <Player
                ref={playerRef}
                component={MyComponent}
                inputProps={props}
                durationInFrames={durationInFrames}
                fps={30}
                compositionWidth={activeFormat.width}
                compositionHeight={activeFormat.height}
                style={
                  aspect === "portrait"
                    ? {
                        width: "auto",
                        height: "min(52vh, 520px)",
                        aspectRatio: "9 / 16",
                      }
                    : {
                        width: "100%",
                        maxHeight: "min(52vh, 520px)",
                        aspectRatio: "16 / 9",
                      }
                }
                controls
              />
            </div>

            <p className="previewMeta">
              第{props.issueNumber}期 · {props.coverTitle} · {props.cases.length}{" "}
              条 · {Math.round(durationInFrames / 30)}s · {activeFormat.label} ·{" "}
              {activeTemplate.label} · 逐字稿{" "}
              <code>{hasScript ? script.source : "未生成"}</code> · 语音{" "}
              <code>{hasVoice ? "已合成" : "未合成"}</code>
            </p>
          </div>

          <aside className="cueCol">
            <CueTimelinePanel
              props={props}
              hasVoice={hasVoice}
              currentFrame={currentFrame}
              onSeek={seekToCue}
            />
          </aside>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
