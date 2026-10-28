import assert from "node:assert/strict";
import test from "node:test";
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
const planned = () => {
  const state = {
    ...initialKnowledgeState(),
    title: "Pipeline",
    source: "Original notes",
    document: {
      title: "Pipeline",
      source: "Original notes",
      locale: "zh",
      chapters: [
        { id: "a", title: "Inputs", narration: "Keep this source text." },
      ],
    },
    voice: "voice-a",
  };
  state.props = state.baseProps = {
    contentMode: "knowledge",
    aspect: "landscape",
    beats: [{ startMs: 0, endMs: 4000, say: "Keep this source text." }],
  };
  state.plannedKey = knowledgeContentKey(state);
  return state;
};
test("knowledge draft storage is isolated from weekly keys and survives refresh", () => {
  assert.ok(KNOWLEDGE_STORAGE_KEY.startsWith("remotion-knowledge-"));
  assert.notEqual(KNOWLEDGE_STORAGE_KEY, "remotion-script-cache-v1");
  const state = planned();
  assert.deepEqual(
    knowledgePreviewProps(restoreKnowledge(JSON.parse(JSON.stringify(state)))),
    state.props,
  );
  assert.equal(restoreKnowledge(null).document, null);
});
test("source, narration, metadata and locale edits invalidate old preview, audio and downloads", () => {
  for (const patch of [
    { source: "new source" },
    { locale: "en" },
    { title: "New title" },
    {
      document: {
        ...planned().document,
        chapters: [{ id: "a", title: "Inputs", narration: "Revised text" }],
      },
    },
  ]) {
    const state = planned();
    const next = editKnowledge({ ...state, download: "/old.mp4" }, patch, {
      sourceChanged: "source" in patch || "locale" in patch,
    });
    assert.equal(knowledgePreviewProps(next), null);
    assert.equal(next.props, null);
    assert.equal(next.download, "");
    assert.equal(acceptsKnowledgeResult(next, knowledgeSnapshot(state)), false);
  }
});
test("voice changes retain real silent beats and remove old audio and exported file", () => {
  const state = planned();
  const next = changeKnowledgeVoice(
    {
      ...state,
      props: { ...state.props, narrationAudioSrc: "old.wav" },
      download: "old.mp4",
    },
    "voice-b",
  );
  assert.equal(next.props, state.baseProps);
  assert.equal(knowledgePreviewProps(next).narrationAudioSrc, undefined);
  assert.equal(next.download, "");
  assert.deepEqual(next.props.beats, state.props.beats);
});
test("late results are rejected even when edited text is reverted; preview/export share one current props object", () => {
  const state = planned(),
    snapshot = knowledgeSnapshot(state);
  assert.equal(acceptsKnowledgeResult(state, snapshot), true);
  const changed = editKnowledge(state, { title: "Changed" });
  const reverted = editKnowledge(changed, { title: state.title });
  assert.equal(acceptsKnowledgeResult(reverted, snapshot), false);
  assert.equal(knowledgePreviewProps(state), state.props);
  const staleCache = { ...state, title: "Other source" };
  assert.equal(knowledgePreviewProps(restoreKnowledge(staleCache)), null);
});
