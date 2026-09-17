import sdk from "microsoft-cognitiveservices-speech-sdk";
import { writeFile } from "node:fs/promises";
import {
  buildTimedSubtitleCues,
  narrationForSpeech,
} from "./subtitle-lines.mjs";

const DEFAULT_VOICE = "zh-CN-YunxiNeural";

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

export const synthesizeScene = async (text, outputPath) => {
  const narration = text.trim();
  if (!narration) {
    return {
      durationMs: 2000,
      cues: [],
      audioPath: null,
    };
  }

  const speakText = narrationForSpeech(narration) || narration;

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
    };
  } finally {
    synthesizer.close();
  }
};
