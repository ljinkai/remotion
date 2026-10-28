import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";
import { KnowledgeExplainer } from "../src/knowledge/KnowledgeExplainer";
import { knowledgeDuration } from "../src/knowledge/knowledgeLayout";
import { knowledgeSample } from "./knowledge-sample.mjs";
import {
  KNOWLEDGE_STORAGE_KEY,
  initialKnowledgeState,
  restoreKnowledge,
  editKnowledge,
  changeKnowledgeVoice,
  knowledgeContentKey,
  knowledgePreviewProps,
  knowledgeSnapshot,
  acceptsKnowledgeResult,
} from "./knowledge-state.mjs";

const readDraft = () => {
  try {
    return restoreKnowledge(
      JSON.parse(localStorage.getItem(KNOWLEDGE_STORAGE_KEY) || "null"),
    );
  } catch {
    return initialKnowledgeState();
  }
};
const request = async (path, body) => {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "暂时无法完成，请稍后重试");
  return result;
};
function KnowledgeApp() {
  const [draft, setDraft] = useState(readDraft);
  const current = useRef(draft);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [voices, setVoices] = useState([]);
  const operation = useRef(0);
  const player = useRef(null);
  const commit = (next) => {
    current.current = next;
    setDraft(next);
    try {
      localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* Editing remains available if storage is full. */
    }
  };
  const edit = (patch, options) => {
    commit(editKnowledge(current.current, patch, options));
    setMessage("讲稿已更新，请重新生成分镜");
    setError("");
  };
  const changeSource = (patch) => {
    if (patch.locale && patch.locale !== current.current.locale)
      patch = {
        ...patch,
        voice:
          patch.locale === "en" ? "en-US-JennyNeural" : "zh-CN-XiaochenNeural",
      };
    edit(patch, { sourceChanged: true });
    setMessage("资料已更新，请整理章节");
  };
  useEffect(() => {
    let active = true;
    fetch(`/api/voices?locale=${draft.locale}`)
      .then((r) => r.json())
      .then((result) => {
        if (!active) return;
        const list = Array.isArray(result.voices) ? result.voices : [];
        setVoices(list);
        if (!current.current.voice) {
          const fallback =
            list[0]?.id ||
            (draft.locale === "en"
              ? "en-US-JennyNeural"
              : "zh-CN-XiaochenNeural");
          if (current.current.voice !== fallback)
            commit(changeKnowledgeVoice(current.current, fallback));
        }
      })
      .catch(() => {
        if (active) setVoices([]);
      });
    return () => {
      active = false;
    };
  }, [draft.locale]);
  const run = async (kind, action) => {
    const token = ++operation.current;
    const snapshot = knowledgeSnapshot(current.current);
    setBusy(kind);
    setError("");
    setMessage(kind);
    try {
      const result = await action(current.current);
      if (
        token !== operation.current ||
        !acceptsKnowledgeResult(current.current, snapshot)
      ) {
        setMessage("内容已变化，未使用旧任务结果。请按当前讲稿重新生成。");
        return;
      }
      result();
      player.current?.seekTo(0);
    } catch (err) {
      if (
        token === operation.current &&
        acceptsKnowledgeResult(current.current, snapshot)
      ) {
        setError(err.message || String(err));
        setMessage("");
      }
    } finally {
      if (token === operation.current) setBusy("");
    }
  };
  const outline = (useAi = false) =>
    run(useAi ? "正在润色讲稿…" : "正在整理章节…", async (state) => {
      const source =
        useAi && state.document
          ? state.document.chapters
              .map(
                (chapter) =>
                  `## ${chapter.title}\n${chapter.narration}\n${chapter.sourceNote || ""}`,
              )
              .join("\n\n")
          : state.source;
      const result = await request("/api/knowledge/outline", {
        source,
        title: state.title,
        locale: state.locale,
        useAi,
      });
      return () => {
        const document = { ...result.document, source: state.source };
        commit(
          editKnowledge(current.current, {
            document,
            title: document.title || state.title,
          }),
        );
        setMessage(
          useAi
            ? "讲稿润色完成，请核对事实与措辞，再生成分镜。"
            : "章节已整理，可逐章修改讲稿与来源备注。",
        );
      };
    });
  const plan = () =>
    run("正在生成分镜…", async (state) => {
      const result = await request("/api/knowledge/plan", {
        document: state.document,
      });
      return () => {
        commit({
          ...current.current,
          baseProps: result.props,
          props: result.props,
          plannedKey: knowledgeContentKey(current.current),
          download: "",
        });
        setMessage("分镜已就绪。可直接导出静音视频，或先生成讲解语音。");
      };
    });
  const synthesize = () =>
    run("正在生成讲解语音…", async (state) => {
      const result = await request("/api/synthesize", {
        props: knowledgePreviewProps(state),
        voice: state.voice,
        locale: state.locale,
      });
      return () => {
        const props = result.props;
        commit({ ...current.current, props, download: "" });
        setMessage("讲解语音已就绪，预览与导出将使用同一版讲稿和时间。");
      };
    });
  const render = () =>
    run("正在生成 MP4，请保留此页面…", async (state) => {
      const result = await request("/api/render", {
        props: knowledgePreviewProps(state),
      });
      if (!result.url) throw new Error("视频已生成，但未返回下载地址");
      return () => {
        commit({ ...current.current, download: result.url });
        setMessage("MP4 已生成，可下载或继续预览。");
      };
    });
  const chapters = draft.document?.chapters || [];
  const updateChapters = (next) =>
    edit({ document: { ...draft.document, chapters: next } });
  const updateChapter = (index, patch) =>
    updateChapters(
      chapters.map((chapter, i) =>
        i === index ? { ...chapter, ...patch } : chapter,
      ),
    );
  const moveChapter = (index, direction) => {
    const next = [...chapters];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    updateChapters(next);
  };
  const props = knowledgePreviewProps(draft);
  const duration = props ? knowledgeDuration(props.beats) : 30;
  const ready = !!props;
  const hasAudio =
    !!props?.narrationAudioSrc || !!props?.useSynthesizedTimeline;
  return (
    <>
      <header className="nav">
        <div className="logo">
          讲解工坊 <span className="muted">/ 知识视频</span>
        </div>
        <nav className="navlinks">
          <strong>知识讲解</strong>
          <a href="/">返回周刊工作台 →</a>
        </nav>
      </header>
      <main className="workspace">
        <div className="heading">
          <div>
            <h1>把知识，讲清楚</h1>
            <div className="muted">
              从资料到章节讲稿，再到一支完整的横屏讲解视频。
            </div>
          </div>
          <span className="badge">B站 · 16:9 横屏</span>
        </div>
        <div className="layout">
          <div>
            <section className="card">
              <h2>
                <span className="step">1</span>资料与主题
              </h2>
              <label>
                视频主题
                <input
                  placeholder="例如：AI Pipeline，为什么需要分阶段？"
                  value={draft.title}
                  onChange={(e) =>
                    draft.document
                      ? edit({ title: e.target.value })
                      : changeSource({ title: e.target.value })
                  }
                />
              </label>
              <div className="row">
                <label>
                  讲解语言
                  <select
                    value={draft.locale}
                    onChange={(e) =>
                      changeSource({
                        locale: e.target.value,
                        voice:
                          e.target.value === "en"
                            ? "en-US-JennyNeural"
                            : "zh-CN-XiaochenNeural",
                      })
                    }
                  >
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  发布方向
                  <input value="B站横屏 · 1920 × 1080" readOnly />
                </label>
              </div>
              <label>
                原始资料
                <textarea
                  className="source"
                  placeholder="粘贴文章、研究笔记或已有讲稿。使用 ## 标题可保留章节结构。"
                  value={draft.source}
                  onChange={(e) => changeSource({ source: e.target.value })}
                />
              </label>
              <div className="actions">
                <button
                  className="primary"
                  disabled={!!busy || !draft.source.trim()}
                  onClick={() => outline(false)}
                >
                  整理章节
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => {
                    changeSource({ ...knowledgeSample, document: null });
                    setMessage(
                      "Pipeline 示例资料已载入。点击「整理章节」开始制作。",
                    );
                  }}
                >
                  载入 Pipeline 示例
                </button>
              </div>
              <div className="help">
                整理章节在本地完成，不调用付费模型。资料与讲稿自动保存在此浏览器。
              </div>
            </section>
            <section className="card">
              <h2>
                <span className="step">2</span>章节与讲稿
                <span className="count">
                  {chapters.length ? `${chapters.length} 个章节` : "等待整理"}
                </span>
              </h2>
              {!draft.document ? (
                <div className="empty">
                  先整理资料，再在这里调整讲解顺序与每章内容。
                </div>
              ) : (
                <>
                  <div className="actions">
                    <button disabled={!!busy} onClick={() => outline(true)}>
                      AI 润色讲稿（付费服务）
                    </button>
                    <button
                      className="primary"
                      disabled={
                        !!busy ||
                        !chapters.length ||
                        !chapters.every((chapter) => chapter.narration.trim())
                      }
                      onClick={plan}
                    >
                      生成分镜
                    </button>
                  </div>
                  <div className="note">
                    讲稿可以分段。来源事实和个人观点请在备注中区分；润色后仍需自行核对。
                  </div>
                  {chapters.map((chapter, index) => (
                    <article className="chapter" key={chapter.id}>
                      <div className="chapterhead">
                        <strong>
                          CHAPTER {String(index + 1).padStart(2, "0")}
                        </strong>
                        <button
                          className="quiet"
                          aria-label={`上移第${index + 1}章`}
                          disabled={index === 0}
                          onClick={() => moveChapter(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="quiet"
                          aria-label={`下移第${index + 1}章`}
                          disabled={index === chapters.length - 1}
                          onClick={() => moveChapter(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          className="quiet danger"
                          onClick={() =>
                            updateChapters(
                              chapters.filter((_, i) => i !== index),
                            )
                          }
                        >
                          删除
                        </button>
                      </div>
                      <label>
                        章节标题
                        <input
                          value={chapter.title}
                          onChange={(e) =>
                            updateChapter(index, { title: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        讲解稿
                        <textarea
                          value={chapter.narration}
                          onChange={(e) =>
                            updateChapter(index, { narration: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        来源 / 作者观点备注
                        <input
                          placeholder="例如：资料事实、作者观察，或此处仅为类比"
                          value={chapter.sourceNote || ""}
                          onChange={(e) =>
                            updateChapter(index, { sourceNote: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        配图地址（可选）
                        <input
                          placeholder="https://… 或本地素材路径"
                          value={chapter.image || ""}
                          onChange={(e) =>
                            updateChapter(index, { image: e.target.value })
                          }
                        />
                      </label>
                    </article>
                  ))}
                  <button
                    style={{ marginTop: 14 }}
                    onClick={() =>
                      updateChapters([
                        ...chapters,
                        {
                          id: `chapter-${Date.now()}`,
                          title: "新章节",
                          narration: "",
                        },
                      ])
                    }
                  >
                    ＋ 添加章节
                  </button>
                </>
              )}
            </section>
          </div>
          <div className="previewcolumn sticky">
            <section className="card previewcard">
              <div className="previewhead">
                <h2>
                  <span className="step">3</span>视频预览
                </h2>
                <span className="badge">
                  {ready
                    ? hasAudio
                      ? "含讲解语音"
                      : "静音预览"
                    : "尚未生成分镜"}
                </span>
              </div>
              <div className="stage">
                {props ? (
                  <Player
                    key={`${draft.plannedKey}:${hasAudio}`}
                    ref={player}
                    component={KnowledgeExplainer}
                    inputProps={props}
                    durationInFrames={duration}
                    fps={30}
                    compositionWidth={1920}
                    compositionHeight={1080}
                    controls
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <div className="welcome">
                    <div className="placeholderIcon">▷</div>
                    <strong>从一份资料开始</strong>
                    <span>整理章节并生成分镜后，即可预览你的横屏讲解。</span>
                  </div>
                )}
              </div>
              {(message || busy) && (
                <div role="status" className="status">
                  {message || busy}
                </div>
              )}
              {error && (
                <div role="alert" className="status error">
                  {error}
                  <div className="small">
                    当前资料和讲稿已保留，可以修改后重试。
                  </div>
                </div>
              )}
              <div className="voice">
                <div className="row">
                  <label>
                    讲解音色
                    <select
                      value={draft.voice}
                      onChange={(e) => {
                        commit(
                          changeKnowledgeVoice(current.current, e.target.value),
                        );
                        setMessage(
                          "音色已更换；分镜保留，请重新生成语音或静音导出。",
                        );
                      }}
                    >
                      {!voices.some((voice) => voice.id === draft.voice) && (
                        <option value={draft.voice}>
                          {draft.voice || "选择音色"}
                        </option>
                      )}
                      {voices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.localName || voice.displayName || voice.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={!!busy || !ready || !draft.voice}
                    onClick={synthesize}
                  >
                    生成语音（可选）
                  </button>
                </div>
                <div className="help">
                  仅点击后调用语音服务。也可以跳过语音，直接生成静音视频。
                </div>
              </div>
              <div className="exportrow">
                <div>
                  <strong>导出横屏视频</strong>
                  <div className="muted">
                    {ready
                      ? `${Math.round(duration / 30)} 秒 · ${hasAudio ? "带语音" : "静音"} · MP4`
                      : "生成分镜后可导出"}
                  </div>
                </div>
                <button
                  className="primary"
                  disabled={!!busy || !ready}
                  onClick={render}
                >
                  生成 MP4
                </button>
              </div>
              {draft.download && (
                <div className="success">
                  视频已就绪 ·{" "}
                  <a href={draft.download} download>
                    下载 MP4 ↓
                  </a>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
createRoot(document.getElementById("knowledge-root")).render(<KnowledgeApp />);
