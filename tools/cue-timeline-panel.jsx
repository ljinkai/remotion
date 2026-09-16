import React, { useMemo } from "react";
import {
  buildCueTimeline,
  formatCueMs,
  getActiveCueTimelineEntry,
} from "../src/videoData";

const groupByScene = (entries) => {
  const groups = [];
  const indexByScene = new Map();

  for (const entry of entries) {
    if (!indexByScene.has(entry.sceneId)) {
      indexByScene.set(entry.sceneId, groups.length);
      groups.push({
        sceneId: entry.sceneId,
        sceneLabel: entry.sceneLabel,
        cues: [],
      });
    }
    groups[indexByScene.get(entry.sceneId)].cues.push(entry);
  }

  return groups;
};

export function CueTimelinePanel({
  props,
  hasVoice,
  currentFrame,
  onSeek,
}) {
  const entries = useMemo(() => buildCueTimeline(props), [props]);
  const groups = useMemo(() => groupByScene(entries), [entries]);
  const activeEntry = useMemo(
    () => getActiveCueTimelineEntry(entries, currentFrame),
    [entries, currentFrame],
  );

  if (!hasVoice) {
    return (
      <section className="cueTimeline cueTimeline--empty">
        <div className="cueTimelineHeader">
          <h3>字幕时间轴</h3>
        </div>
        <p className="cueTimelineEmpty">
          合成语音后，这里会列出每句字幕；点击可跳到对应画面。
        </p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="cueTimeline cueTimeline--empty">
        <div className="cueTimelineHeader">
          <h3>字幕时间轴</h3>
        </div>
        <p className="cueTimelineEmpty">当前没有可用的字幕 cue。</p>
      </section>
    );
  }

  return (
    <section className="cueTimeline">
      <div className="cueTimelineHeader">
        <h3>字幕时间轴</h3>
        {activeEntry ? (
          <span className="cueTimelineNow">
            当前：{activeEntry.sceneLabel} · {formatCueMs(activeEntry.startMs)}-
            {formatCueMs(activeEntry.endMs)}
          </span>
        ) : (
          <span className="cueTimelineNow">当前：无匹配 cue</span>
        )}
      </div>

      <div className="cueTimelineBody">
        {groups.map((group) => (
          <div className="cueSceneGroup" key={group.sceneId}>
            <h4>{group.sceneLabel}</h4>
            <ul>
              {group.cues.map((entry) => {
                const isActive = activeEntry?.id === entry.id;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={`cueRow${isActive ? " active" : ""}`}
                      onClick={() => onSeek(entry.globalStartFrame)}
                    >
                      <span className="cueTime">
                        场景 {formatCueMs(entry.startMs)} – {formatCueMs(entry.endMs)}
                        <small>
                          全局 {formatCueMs(entry.globalStartMs)} –{" "}
                          {formatCueMs(entry.globalEndMs)}
                        </small>
                      </span>
                      <span className="cueText">{entry.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
