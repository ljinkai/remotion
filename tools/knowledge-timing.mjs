// Browser-safe: also repairs previously persisted synthesized drafts on reload.
const textKey = (text) => String(text || "").replace(/[\p{P}\s]/gu, "");

export const alignKnowledgeSpeech = (props) => {
  if (!props?.useSynthesizedTimeline || (props.contentMode !== "knowledge" && props.templateId !== "knowledge")) return props;
  let chapterStart = Number(props.introDurationMs) || 0;
  const chapters = (props.cases || []).map((item) => {
    const startMs = chapterStart;
    chapterStart += Number(item.durationMs) || 0;
    return { startMs, endMs: chapterStart };
  });
  const total = Number(props.narrationDurationMs) || chapterStart;
  if (!(total > 0)) return props;
  const beats = [...(props.beats || [])];
  chapters.forEach((chapter, caseIndex) => {
    const entries = beats.map((beat, index) => ({ beat, index })).filter(({ beat }) => beat.caseIndex === caseIndex);
    let length = 0;
    const cues = (props.cases[caseIndex].cues || []).map((cue) => {
      const start = length;
      length += textKey(cue.text).length;
      return { ...cue, start, end: length };
    }).filter((cue) => cue.end > cue.start);
    const script = entries.map(({ beat }) => textKey(beat.say)).join("");
    const matches = script === (props.cases[caseIndex].cues || []).map((cue) => textKey(cue.text)).join("");
    const at = (offset, end) => {
      // End boundaries belong to the previous cue; starts belong to the next.
      const cue = cues.find((cue) => end ? offset > cue.start && offset <= cue.end : offset >= cue.start && offset < cue.end);
      if (!cue) return end ? chapter.endMs : chapter.startMs;
      const fraction = (offset - cue.start) / (cue.end - cue.start);
      return chapter.startMs + Number(cue.startMs) + fraction * (Number(cue.endMs) - Number(cue.startMs));
    };
    let offset = 0;
    entries.forEach(({ beat, index }) => {
      const start = offset;
      offset += textKey(beat.say).length;
      // When cue text is incomplete, stay within this chapter instead of adding
      // estimated seconds beyond the real audio or consuming the next chapter.
      const span = chapter.endMs - chapter.startMs;
      const startMs = matches && cues.length ? at(start, false) : chapter.startMs + span * start / Math.max(1, script.length);
      const endMs = matches && cues.length ? at(offset, true) : chapter.startMs + span * offset / Math.max(1, script.length);
      beats[index] = { ...beat, startMs: Math.max(0, Math.min(total, startMs)), endMs: Math.max(0, Math.min(total, endMs)) };
    });
  });
  if (beats.length) beats[beats.length - 1] = { ...beats.at(-1), endMs: total };
  return { ...props, beats, estimatedDurationMs: total, timingSource: "speech", knowledge: { ...props.knowledge, chapters: (props.knowledge?.chapters || []).map((chapter, index) => ({ ...chapter, ...chapters[index], durationMs: chapters[index] ? chapters[index].endMs - chapters[index].startMs : chapter.durationMs })) } };
};
