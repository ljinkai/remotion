import sdk from "microsoft-cognitiveservices-speech-sdk";
import { writeFile } from "node:fs/promises";
import {
  buildTimedSubtitleCues,
  narrationForSpeech,
} from "./subtitle-lines.mjs";
import { DEFAULT_AZURE_VOICE } from "./azure-voices.mjs";

const ticksToMs = (ticks) => Math.round(ticks / 10000);

/** Fail if Azure stops sending audio, and cap the whole request. */
const SYNTH_IDLE_MS = 120_000;
const SYNTH_MAX_MS = 12 * 60 * 1000;

const closeSynthesizer = (synthesizer) => {
  try {
    synthesizer.close();
  } catch {
    // already closed after a timeout
  }
};

const speakAndWait = (synthesizer, start, onActivity) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let idleTimer;
    let maxTimer;
    const finish = (fn, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(idleTimer);
      clearTimeout(maxTimer);
      fn(value);
    };
    const fail = (error) => {
      closeSynthesizer(synthesizer);
      finish(
        reject,
        error instanceof Error ? error : new Error(String(error || "Azure TTS failed")),
      );
    };
    const bump = () => {
      if (settled) {
        return;
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        fail(new Error("Azure 语音合成中断，超过 120 秒没有新的音频数据"));
      }, SYNTH_IDLE_MS);
    };
    maxTimer = setTimeout(() => {
      fail(new Error("Azure 语音合成超过 12 分钟，已停止等待"));
    }, SYNTH_MAX_MS);
    bump();
    onActivity.current = bump;
    try {
      start(
        (speechResult) => {
          if (
            speechResult.reason === sdk.ResultReason.SynthesizingAudioCompleted
          ) {
            finish(resolve, speechResult);
            return;
          }
          const details = sdk.SpeechSynthesisCancellationDetails.fromResult(
            speechResult,
          );
          fail(
            new Error(
              details.errorDetails ||
                `Azure TTS failed: ${speechResult.reason}`,
            ),
          );
        },
        (error) => fail(error),
      );
    } catch (error) {
      fail(error);
    }
  });

export const getAzureSpeechConfig = (overrides = {}) => {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key) {
    throw new Error("缺少环境变量 AZURE_SPEECH_KEY");
  }
  if (!region) {
    throw new Error("缺少环境变量 AZURE_SPEECH_REGION");
  }
  const voice =
    String(overrides.voice || "").trim() ||
    process.env.AZURE_SPEECH_VOICE?.trim() ||
    DEFAULT_AZURE_VOICE;
  return { key, region, voice };
};

export const synthesizeScene = async (text, outputPath, options = {}) => {
  const narration = text.trim();
  if (!narration) {
    return {
      durationMs: 2000,
      cues: [],
      audioPath: null,
    };
  }

  const speakText = narrationForSpeech(narration) || narration;

  const { key, region, voice } = getAzureSpeechConfig(options);
  const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
  speechConfig.speechSynthesisVoiceName = voice;
  speechConfig.speechSynthesisOutputFormat =
    sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
  speechConfig.setProperty(
    sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary,
    "true",
  );

  const boundaries = [];
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
  const activity = { current: () => {} };

  const onWordBoundary = (_sender, event) => {
    activity.current();
    boundaries.push({
      text: event.text,
      audioOffsetMs: ticksToMs(event.audioOffset),
      durationMs: ticksToMs(event.duration),
      textOffset: Number(event.textOffset),
      wordLength: Number(event.wordLength),
      boundaryType: event.boundaryType,
    });
  };
  synthesizer.wordBoundary = onWordBoundary;
  synthesizer.synthesisWordBoundary = onWordBoundary;

  try {
    const result = await speakAndWait(
      synthesizer,
      (ok, err) => synthesizer.speakTextAsync(speakText, ok, err),
      activity,
    );

    const audioBuffer = Buffer.from(result.audioData);
    await writeFile(outputPath, audioBuffer);

    const durationMs = Math.max(
      ticksToMs(result.audioDuration),
      boundaries.at(-1)
        ? boundaries.at(-1).audioOffsetMs + boundaries.at(-1).durationMs
        : 0,
      500,
    );

    const cues = buildTimedSubtitleCues(narration, durationMs, boundaries);

    return {
      durationMs,
      cues,
      audioPath: outputPath,
      voice,
    };
  } finally {
    closeSynthesizer(synthesizer);
  }
};

export const synthesizeNarrationTrack = async (ssml, outputPath, options = {}) => {
  const markup = String(ssml || "").trim();
  if (!markup) {
    throw new Error("整轨 SSML 为空");
  }

  const { key, region, voice } = getAzureSpeechConfig(options);
  const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
  speechConfig.speechSynthesisVoiceName = voice;
  speechConfig.speechSynthesisOutputFormat =
    sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
  speechConfig.setProperty(
    sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary,
    "true",
  );

  const boundaries = [];
  const bookmarks = [];
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
  const activity = { current: () => {} };

  const onWordBoundary = (_sender, event) => {
    activity.current();
    boundaries.push({
      text: event.text,
      audioOffsetMs: ticksToMs(event.audioOffset),
      durationMs: ticksToMs(event.duration),
      textOffset: Number(event.textOffset),
      wordLength: Number(event.wordLength),
      boundaryType: event.boundaryType,
    });
  };
  synthesizer.wordBoundary = onWordBoundary;
  synthesizer.synthesisWordBoundary = onWordBoundary;
  synthesizer.bookmarkReached = (_sender, event) => {
    activity.current();
    bookmarks.push({
      name: String(event.text || "").trim(),
      audioOffsetMs: ticksToMs(event.audioOffset),
    });
  };

  try {
    const result = await speakAndWait(
      synthesizer,
      (ok, err) => synthesizer.speakSsmlAsync(markup, ok, err),
      activity,
    );

    const audioBuffer = Buffer.from(result.audioData);
    await writeFile(outputPath, audioBuffer);

    const durationMs = Math.max(
      ticksToMs(result.audioDuration),
      boundaries.at(-1)
        ? boundaries.at(-1).audioOffsetMs + boundaries.at(-1).durationMs
        : 0,
      bookmarks.at(-1)?.audioOffsetMs || 0,
      500,
    );

    return {
      durationMs,
      audioPath: outputPath,
      bookmarks,
      boundaries,
      voice,
    };
  } finally {
    closeSynthesizer(synthesizer);
  }
};
