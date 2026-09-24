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
import { buildXhsPublishCopy } from "../src/xhsCopy";
import { CueTimelinePanel } from "./cue-timeline-panel";

const savedMarkdown =
  localStorage.getItem("remotion-markdown") || sampleMarkdown;
const savedTemplate = resolveTemplateId(
  localStorage.getItem("remotion-template"),
);
const savedAspect = resolveAspect(localStorage.getItem("remotion-aspect"));
const savedVoice =
  localStorage.getItem("remotion-voice") || "zh-CN-YunxiNeural";
const savedWeeklyLocale =
  localStorage.getItem("remotion-weekly-locale") === "en" ? "en" : "zh";

function App() {
  const playerRef = useRef(null);
  const previewAudioRef = useRef(null);
  const [markdown, setMarkdown] = useState(savedMarkdown);
  const [templateId, setTemplateId] = useState(savedTemplate);
  const [aspect, setAspect] = useState(savedAspect);
  const [voiceId, setVoiceId] = useState(savedVoice);
  const [voices, setVoices] = useState([]);
  const [voicesSource, setVoicesSource] = useState("");
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [scripting, setScripting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [script, setScript] = useState(null);
  const [synthesizedProps, setSynthesizedProps] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [editorTab, setEditorTab] = useState("markdown");
  const [xhsDraft, setXhsDraft] = useState(null);
  const [weeklyLocale, setWeeklyLocale] = useState(savedWeeklyLocale);
  const [weeklyIssues, setWeeklyIssues] = useState([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyFilling, setWeeklyFilling] = useState(null);

  const parsedProps = useMemo(
    () => parseMarkdownToVideo(markdown, { locale: weeklyLocale }),
    [markdown, weeklyLocale],
  );
  const scriptedProps = useMemo(
    () =>
      script
        ? applyNarrationScript(parsedProps, script, weeklyLocale)
        : parsedProps,
    [parsedProps, script, weeklyLocale],
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
  const xhsCopy = useMemo(() => buildXhsPublishCopy(props), [props]);
  const xhsView = xhsDraft ?? xhsCopy;

  useEffect(() => {
    setXhsDraft(null);
  }, [markdown, props.issueNumber, props.coverTitle, props.cases?.length]);

  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setError("");
      setStatus(`已复制${label}`);
    } catch {
      setError(`复制${label}失败，请手动选中复制`);
    }
  };

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

  const selectVoice = (id) => {
    const next = String(id || "").trim() || "zh-CN-YunxiNeural";
    setVoiceId(next);
    localStorage.setItem("remotion-voice", next);
    setSynthesizedProps(null);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/voices?locale=${weeklyLocale}`);
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "加载音色列表失败");
        }
        if (cancelled) {
          return;
        }
        setVoices(Array.isArray(body.voices) ? body.voices : []);
        setVoicesSource(body.source || "");
        const defaultVoice =
          body.defaultVoice ||
          (weeklyLocale === "en" ? "en-US-JennyNeural" : "zh-CN-YunxiNeural");
        const currentOk = (body.voices || []).some(
          (item) => item.id === voiceId,
        );
        if (!currentOk) {
          selectVoice(defaultVoice);
        } else if (
          body.defaultVoice &&
          !localStorage.getItem("remotion-voice")
        ) {
          setVoiceId(body.defaultVoice);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weeklyLocale]);

  useEffect(() => {
    let cancelled = false;
    setWeeklyLoading(true);
    (async () => {
      try {
        const response = await fetch(
          `/api/weekly/recent?limit=8&locale=${weeklyLocale}`,
        );
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "加载周刊列表失败");
        }
        if (cancelled) {
          return;
        }
        setWeeklyIssues(Array.isArray(body.issues) ? body.issues : []);
      } catch (err) {
        if (!cancelled) {
          console.warn(err);
          setWeeklyIssues([]);
        }
      } finally {
        if (!cancelled) {
          setWeeklyLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weeklyLocale]);

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

  const selectWeeklyLocale = (next) => {
    const locale = next === "en" ? "en" : "zh";
    if (locale === weeklyLocale) {
      return;
    }
    setWeeklyLocale(locale);
    localStorage.setItem("remotion-weekly-locale", locale);
    setScript(null);
    setSynthesizedProps(null);
    setCurrentFrame(0);
    setError("");
    setStatus(locale === "en" ? "已切换英文生成逻辑" : "已切换中文生成逻辑");
  };

  const alignVoiceToLocale = (locale) => {
    const isEn = locale === "en";
    const currentIsEn = /^en[-_]/i.test(voiceId);
    if (isEn === currentIsEn) {
      return;
    }
    const preferred = isEn ? "en-US-JennyNeural" : "zh-CN-YunxiNeural";
    const match = voices.find((item) => item.id === preferred);
    const fallback = voices.find((item) =>
      isEn ? /^en[-_]/i.test(item.id) : /^zh[-_]/i.test(item.id),
    );
    selectVoice(match?.id || fallback?.id || preferred);
  };

  const fillWeeklyIssue = async (issue) => {
    setWeeklyFilling(issue);
    setError("");
    setStatus(`正在拉取第 ${issue} 期...`);
    try {
      const response = await fetch(
        `/api/weekly/${issue}?locale=${weeklyLocale}`,
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "拉取周刊失败");
      }
      updateMarkdown(body.markdown || "");
      alignVoiceToLocale(weeklyLocale);
      setEditorTab("markdown");
      setStatus(
        `已填充第 ${issue} 期（${body.source === "github" ? "GitHub" : "本地"}）`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("");
    } finally {
      setWeeklyFilling(null);
    }
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
    setStatus(
      weeklyLocale === "en"
        ? "Generating English narration script..."
        : "正在生成逐字稿...",
    );
    try {
      const fromMarkdown = tryBuildScriptFromMarkdown(markdown, {
        locale: weeklyLocale,
      });
      if (fromMarkdown) {
        setScript(formatScript(fromMarkdown));
        setSynthesizedProps(null);
        setEditorTab("script");
        setStatus(
          weeklyLocale === "en"
            ? "Loaded narration from Markdown (EN)"
            : "已从 Markdown 旁白载入逐字稿（已按字幕行拆分）",
        );
        return;
      }

      const response = await fetch("/api/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          props: parsedProps,
          markdown,
          locale: weeklyLocale,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "生成逐字稿失败");
      }
      setScript(formatScript(body.script));
      setSynthesizedProps(null);
      setEditorTab("script");
      setStatus(
        weeklyLocale === "en"
          ? "English narration script ready — edit then synthesize"
          : "千问逐字稿已生成（已按字幕行拆分），可编辑后再合成",
      );
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
        body: JSON.stringify({
          props: scriptedProps,
          voice: voiceId,
          locale: weeklyLocale,
        }),
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
      const voiceNote = cache?.voice ? ` · ${cache.voice}` : ` · ${voiceId}`;
      setStatus(`语音合成完成（${body.synthId}${cacheNote}${voiceNote}）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("");
    } finally {
      setSynthesizing(false);
    }
  };

  const previewVoice = async () => {
    setPreviewingVoice(true);
    setError("");
    setStatus(`正在试听音色 ${voiceId}...`);
    try {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        URL.revokeObjectURL(previewAudioRef.current.src);
        previewAudioRef.current = null;
      }
      const response = await fetch("/api/voice-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voice: voiceId, locale: weeklyLocale }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "试听失败");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (previewAudioRef.current === audio) {
          previewAudioRef.current = null;
        }
      };
      await audio.play();
      setStatus(`正在播放试听：${voiceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("");
    } finally {
      setPreviewingVoice(false);
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

  const busy =
    rendering ||
    synthesizing ||
    scripting ||
    previewingVoice ||
    weeklyFilling != null;

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

        <div className="weeklyPicker">
          <div className="weeklyPickerHead">
            <strong>语言 / 最近周刊</strong>
            <div className="seg">
              <button
                type="button"
                className={weeklyLocale === "zh" ? "active" : ""}
                disabled={busy}
                onClick={() => selectWeeklyLocale("zh")}
              >
                中文
              </button>
              <button
                type="button"
                className={weeklyLocale === "en" ? "active" : ""}
                disabled={busy}
                onClick={() => selectWeeklyLocale("en")}
              >
                EN
              </button>
            </div>
          </div>
          {weeklyLoading ? (
            <p className="weeklyEmpty">加载期号中…</p>
          ) : weeklyIssues.length === 0 ? (
            <p className="weeklyEmpty">暂无可用期号（检查本地目录或 GitHub）</p>
          ) : (
            <div className="weeklyList">
              {weeklyIssues.map((item) => (
                <div className="weeklyRow" key={`${weeklyLocale}-${item.issue}`}>
                  <span className="issueNo">#{item.issue}</span>
                  <span className="issueTitle" title={item.title}>
                    {item.title}
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => fillWeeklyIssue(item.issue)}
                  >
                    {weeklyFilling === item.issue ? "拉取中" : "填充"}
                  </button>
                </div>
              ))}
            </div>
          )}
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
          <button
            type="button"
            role="tab"
            aria-selected={editorTab === "xhs"}
            className={`editorTab${editorTab === "xhs" ? " active" : ""}`}
            onClick={() => setEditorTab("xhs")}
          >
            小红书文案
          </button>
        </div>

        <div className="editorBody">
          {editorTab === "markdown" ? (
            <textarea
              className="mdEditor"
              value={markdown}
              onChange={(event) => updateMarkdown(event.target.value)}
            />
          ) : editorTab === "xhs" ? (
            <section className="scriptPanel">
              <h3>
                小红书发布文案
                <span className="meta"> · 可编辑后一键复制</span>
              </h3>
              <p className="scriptEmpty" style={{ marginBottom: 12 }}>
                不用接口：复制后到小红书 App 粘贴即可。建议先切「竖屏」再生成
                MP4。
              </p>
              <div className="scriptField">
                <label>标题</label>
                <textarea
                  rows={2}
                  value={xhsView.title}
                  onChange={(event) =>
                    setXhsDraft({ ...xhsView, title: event.target.value })
                  }
                />
                <div className="copyRow">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => copyText("标题", xhsView.title)}
                  >
                    复制标题
                  </button>
                </div>
              </div>
              <div className="scriptField">
                <label>正文</label>
                <textarea
                  rows={10}
                  value={xhsView.body}
                  onChange={(event) =>
                    setXhsDraft({ ...xhsView, body: event.target.value })
                  }
                />
                <div className="copyRow">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => copyText("正文", xhsView.body)}
                  >
                    复制正文
                  </button>
                </div>
              </div>
              <div className="scriptField">
                <label>话题标签</label>
                <textarea
                  rows={3}
                  value={xhsView.tags}
                  onChange={(event) =>
                    setXhsDraft({ ...xhsView, tags: event.target.value })
                  }
                />
                <div className="copyRow">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => copyText("话题", xhsView.tags)}
                  >
                    复制话题
                  </button>
                </div>
              </div>
              <div className="copyRow" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      "全文",
                      `${xhsView.title}\n\n${xhsView.body}\n\n${xhsView.tags}`,
                    )
                  }
                >
                  一键复制全文
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setXhsDraft(null)}
                >
                  重置为自动文案
                </button>
              </div>
            </section>
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
                    精选 {item.index} · {item.title}
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

          <div className="toolbarGroup">
            <span>音色</span>
            <select
              className="voiceSelect"
              value={voiceId}
              onChange={(event) => selectVoice(event.target.value)}
              disabled={busy}
              title={voicesSource ? `来源：${voicesSource}` : "Azure 中文音色"}
            >
              {(voices.some((item) => item.id === voiceId)
                ? voices
                : [
                    { id: voiceId, label: voiceId },
                    ...voices,
                  ]
              ).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label || item.id}
                </option>
              ))}
            </select>
            <button
              className="secondary voicePreviewBtn"
              type="button"
              onClick={previewVoice}
              disabled={busy}
            >
              {previewingVoice ? "试听中" : "试听"}
            </button>
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
