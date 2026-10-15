import sdk from "microsoft-cognitiveservices-speech-sdk";
import { writeFile } from "node:fs/promises";
import {
  buildTimedSubtitleCues,
  narrationForSpeech,
} from "./subtitle-lines.mjs";
import { DEFAULT_AZURE_VOICE } from "./azure-voices.mjs";

const ticksToMs = (ticks) => Math.round(ticks / 10000);

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

  const onWordBoundary = (_sender, event) => {
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
    const result = await new Promise((resolve, reject) => {
      synthesizer.speakTextAsync(
        speakText,
        (speechResult) => {
          if (
            speechResult.reason === sdk.ResultReason.SynthesizingAudioCompleted
          ) {
            resolve(speechResult);
            return;
          }
          const details = sdk.SpeechSynthesisCancellationDetails.fromResult(
            speechResult,
          );
          reject(
            new Error(
              details.errorDetails ||
                `Azure TTS failed: ${speechResult.reason}`,
            ),
          );
        },
        (error) => reject(error),
      );
    });

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
    synthesizer.close();
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

  const onWordBoundary = (_sender, event) => {
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
    bookmarks.push({
      name: String(event.text || "").trim(),
      audioOffsetMs: ticksToMs(event.audioOffset),
    });
  };

  try {
    const result = await new Promise((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        markup,
        (speechResult) => {
          if (
            speechResult.reason === sdk.ResultReason.SynthesizingAudioCompleted
          ) {
            resolve(speechResult);
            return;
          }
          const details = sdk.SpeechSynthesisCancellationDetails.fromResult(
            speechResult,
          );
          reject(
            new Error(
              details.errorDetails ||
                `Azure TTS failed: ${speechResult.reason}`,
            ),
          );
        },
        (error) => reject(error),
      );
    });

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
    synthesizer.close();
  }
};
