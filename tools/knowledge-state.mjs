import { alignKnowledgeSpeech } from "./knowledge-timing.mjs";

export const KNOWLEDGE_STORAGE_KEY = "remotion-knowledge-draft-v1";
export const knowledgeContentKey = (state) =>
  JSON.stringify({
    title: state.title,
    source: state.source,
    locale: state.locale,
    chapters: state.document?.chapters || null,
  });
export const initialKnowledgeState = () => ({
  title: "",
  source: "",
  locale: "zh",
  document: null,
  voice: "zh-CN-XiaochenNeural",
  baseProps: null,
  props: null,
  plannedKey: "",
  download: "",
  revision: 0,
});
export const editKnowledge = (state, patch, { sourceChanged = false } = {}) => {
  const next = {
    ...state,
    ...patch,
    baseProps: null,
    props: null,
    plannedKey: "",
    download: "",
    revision: state.revision + 1,
  };
  if (sourceChanged) next.document = null;
  if (next.document)
    next.document = {
      ...next.document,
      source: next.source,
      title: next.title,
      locale: next.locale,
    };
  return next;
};
export const changeKnowledgeVoice = (state, voice) => ({
  ...state,
  voice,
  props: state.baseProps,
  download: "",
  revision: state.revision + 1,
});
export const knowledgePreviewProps = (state) =>
  state.plannedKey === knowledgeContentKey(state) && state.props?.beats?.length
    ? state.props
    : null;
export const knowledgeSnapshot = (state) => ({
  revision: state.revision,
  key: knowledgeContentKey(state),
  voice: state.voice,
});
export const acceptsKnowledgeResult = (state, snapshot) =>
  state.revision === snapshot.revision &&
  knowledgeContentKey(state) === snapshot.key &&
  state.voice === snapshot.voice;
export const restoreKnowledge = (value) => {
  if (!value || typeof value !== "object") return initialKnowledgeState();
  const state = {
    ...initialKnowledgeState(),
    ...value,
    locale: value.locale === "en" ? "en" : "zh",
    revision: 0,
  };
  if (!Array.isArray(state.document?.chapters)) state.document = null;
  if (state.props) state.props = alignKnowledgeSpeech(state.props);
  if (!knowledgePreviewProps(state))
    Object.assign(state, {
      baseProps: null,
      props: null,
      plannedKey: "",
      download: "",
    });
  return state;
};
