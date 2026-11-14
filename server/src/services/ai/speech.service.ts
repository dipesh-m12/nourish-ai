import { createHash } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { fetchWithTimeout } from './llm-provider';

/**
 * Spoken replies for voice mode: Gemini TTS (natural voices, same key as the rest of the AI)
 * returns raw 24 kHz 16-bit mono PCM; we wrap it in a WAV header so phones can play it.
 * Recent replies are cached in memory (the same nudge line is often spoken again).
 * Failure is a 503: the app falls back to the phone's own voice (expo-speech).
 */

const SAMPLE_RATE = 24_000;
const CACHE_MAX = 100;
const cache = new Map<string, string>(); // text hash → wav base64 (insertion order = LRU-ish)

function wav(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate (16-bit mono)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

interface TtsResponse {
  candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
  error?: { message?: string };
}

export async function speak(text: string): Promise<{ mimeType: 'audio/wav'; base64: string }> {
  if (!env.GEMINI_API_KEY) throw new AppError(503, 'Voice is not set up');
  const key = createHash('sha1').update(`${env.GEMINI_TTS_VOICE}|${text}`).digest('hex');
  const hit = cache.get(key);
  if (hit) return { mimeType: 'audio/wav', base64: hit };

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_TTS_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        // A short style cue keeps the voice warm and unhurried, like a friend, not a robot.
        contents: [{ parts: [{ text: `Say warmly and calmly: ${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: env.GEMINI_TTS_VOICE } },
          },
        },
      }),
    },
    20_000,
  ).catch(() => null);

  const body = res ? ((await res.json().catch(() => null)) as TtsResponse | null) : null;
  const pcm = body?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData
    ?.data;
  if (!res?.ok || !pcm) {
    console.warn('[tts] failed:', body?.error?.message ?? res?.status ?? 'timeout');
    throw new AppError(503, 'Voice is unavailable right now');
  }

  const base64 = wav(Buffer.from(pcm, 'base64')).toString('base64');
  cache.set(key, base64);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return { mimeType: 'audio/wav', base64 };
}
