import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useEffect, useRef } from 'react';

/** A finished voice note, ready to upload. */
export interface VoiceNote {
  mimeType: 'audio/m4a';
  base64: string;
  durationMs: number;
}

export class MicPermissionError extends Error {
  constructor() {
    super('Microphone access is off. Allow it in Settings to say what you ate.');
  }
}

// Mono AAC in an .m4a container on both platforms: Whisper reads it, and 30 s is ~120 KB.
// (Android's low-quality preset is .3gp/AMR, which Whisper can't read.)
const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
};

export const MAX_VOICE_MS = 30_000;
/** Shorter than this is a tap, not a sentence. */
export const MIN_VOICE_MS = 700;

/** dB (−160…0) → 0…1, with everything below −50 dB treated as silence. */
const levelOf = (db?: number) => (db === undefined ? 0 : Math.min(1, Math.max(0, (db + 50) / 50)));

/**
 * Hold-to-talk recording. `start()` on press, `stop()` on release; `stop()` resolves to the
 * note, or null for a too-short press. Handles a release that lands before recording began.
 */
export function useVoiceNote() {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 80);
  const starting = useRef<Promise<void> | null>(null);
  const startedAt = useRef(0);

  const start = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new MicPermissionError();
    starting.current = (async () => {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_VOICE_MS / 1000 });
      startedAt.current = Date.now();
    })();
    await starting.current;
  };

  const stop = async (): Promise<VoiceNote | null> => {
    await starting.current; // released mid-start: finish starting, then stop cleanly
    starting.current = null;
    if (!startedAt.current) return null;
    const durationMs = Date.now() - startedAt.current;
    startedAt.current = 0;
    await recorder.stop();
    // Back to playback mode, or iOS keeps routing sound to the earpiece.
    await setAudioModeAsync({ allowsRecording: false });
    if (durationMs < MIN_VOICE_MS || !recorder.uri) return null;
    const base64 = await new File(recorder.uri).base64();
    return { mimeType: 'audio/m4a', base64, durationMs };
  };

  // Leaving mid-recording (sheet closed, app backgrounded) must not leave the mic on.
  useEffect(
    () => () => {
      if (startedAt.current) void recorder.stop().catch(() => {});
    },
    [recorder],
  );

  return {
    start,
    stop,
    recording: state.isRecording,
    durationMs: state.durationMillis ?? 0,
    level: levelOf(state.metering),
  };
}
