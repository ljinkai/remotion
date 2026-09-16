import sdk from "microsoft-cognitiveservices-speech-sdk";
import { writeFile } from "node:fs/promises";

const DEFAULT_VOICE = "zh-CN-YunxiNeural";
const SENTENCE_BOUNDARY = sdk.SpeechSynthesisBoundaryType?.Sentence ?? 1;

const ticksToMs = (ticks) => Math.round(ticks / 10000);

export const getAzureSpeechConfig = () => {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key) {
    throw new Error("缺少环境变量 AZURE_SPEECH_KEY");
  }
  if (!region) {
    throw new Error("缺少环境变量 AZURE_SPEECH_REGION");
  }
  const voice = process.env.AZURE_SPEECH_VOICE?.trim() || DEFAULT_VOICE;
  return { key, region, voice };
};

const aggregateWordBoundariesToCues = (boundaries, fullText, durationMs) => {
  if (!fullText.trim()) {
    return [];
  }
  if (boundaries.length === 0) {
    return [{ text: fullText.trim(), startMs: 0, endMs: durationMs }];
  }

  const cues = [];
  let buffer = "";
  let bufferStartMs = boundaries[0]?.audioOffsetMs ?? 0;

  const flush = (endMs) => {
    const text = buffer.trim();
    if (!text) {
      return;
    }
    cues.push({
      text,
      startMs: bufferStartMs,
      endMs: Math.max(endMs, bufferStartMs + 1),
    });
    buffer = "";
  };

  for (const boundary of boundaries) {
    if (boundary.boundaryType === SENTENCE_BOUNDARY && boundary.text.trim()) {
      flush(boundary.audioOffsetMs + boundary.durationMs);
      bufferStartMs = boundary.audioOffsetMs + boundary.durationMs;
      continue;
    }

    buffer += boundary.text;
    if (/[。！？!?]$/.test(boundary.text.trim())) {
      flush(boundary.audioOffsetMs + boundary.durationMs);
      bufferStartMs = boundary.audioOffsetMs + boundary.durationMs;
    }
  }

  if (buffer.trim()) {
    flush(durationMs);
  }

  if (cues.length === 0) {
    return [{ text: fullText.trim(), startMs: 0, endMs: durationMs }];
  }

  cues[cues.length - 1].endMs = durationMs;
  return cues;
};

export const synthesizeScene = async (text, outputPath) => {
  const narration = text.trim();
  if (!narration) {
    return {
      durationMs: 2000,
      cues: [],
      audioPath: null,
    };
  }

  const { key, region, voice } = getAzureSpeechConfig();
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

  synthesizer.synthesisWordBoundary = (_sender, event) => {
    boundaries.push({
      text: event.text,
      audioOffsetMs: ticksToMs(event.audioOffset),
      durationMs: ticksToMs(event.duration),
      textOffset: event.textOffset,
      wordLength: event.wordLength,
      boundaryType: event.boundaryType,
    });
  };

  try {
    const result = await new Promise((resolve, reject) => {
      synthesizer.speakTextAsync(
        narration,
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

    const cues = aggregateWordBoundariesToCues(
      boundaries,
      narration,
      durationMs,
    );

    return {
      durationMs,
      cues,
      audioPath: outputPath,
    };
  } finally {
    synthesizer.close();
  }
};
