import { z } from 'zod';
import { env } from '../../config/env';
import type { AudioInput } from '../../validators/audio.validator';
import { generateStructured } from './ai.service';
import { fetchWithTimeout } from './llm-provider';

/**
 * Speech to text for meal logging. Groq's Whisper first (about a second, free tier); if it
 * fails, Gemini listens to the audio directly. Throws only if both fail.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3-turbo';
const TIMEOUT_MS = 15_000;
/** Biases Whisper toward the words people actually say about Indian meals. */
const VOCAB_PROMPT =
  'Meal log: roti, chapati, paratha, dal, sabzi, paneer, rajma, chole, idli, dosa, sambar, poha, upma, khichdi, curd, raita, chai, katori, bowl, plate.';

const EXT: Record<string, string> = {
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

async function viaGroq(audio: AudioInput): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error('groq: no key');
  const form = new FormData();
  const bytes = Buffer.from(audio.base64, 'base64');
  form.append(
    'file',
    new Blob([bytes], { type: audio.mimeType }),
    `meal.${EXT[audio.mimeType] ?? 'm4a'}`,
  );
  form.append('model', MODEL);
  form.append('prompt', VOCAB_PROMPT);
  form.append('response_format', 'json');
  form.append('temperature', '0');

  const res = await fetchWithTimeout(
    GROQ_URL,
    { method: 'POST', headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` }, body: form },
    TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`groq whisper: HTTP ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}

const transcriptSchema = z.strictObject({ transcript: z.string().max(1000) });

async function viaGemini(audio: AudioInput): Promise<string> {
  const { data } = await generateStructured(transcriptSchema, {
    system:
      'Transcribe the attached voice note exactly as spoken (English, Hindi or Hinglish, in Latin letters). Empty string if nothing is said.',
    user: 'Transcribe this.',
    // The providers' media input is generic inline data; Gemini accepts audio this way.
    images: [audio],
  });
  return data.transcript.trim();
}

/**
 * Whisper "hears" stock phrases in silence or noise ("you", "thank you", "thanks for watching").
 * Those, and anything with almost no letters, count as nothing said.
 */
const WHISPER_SILENCE =
  /^(you|thank you|thanks|thanks for watching|bye|okay|ok|hmm+|uh+|um+)[.!?\s]*$/i;

export function isSilence(transcript: string) {
  const t = transcript.trim();
  return t.replace(/[^\p{L}]/gu, '').length < 4 || WHISPER_SILENCE.test(t);
}

/** Speech to text. Returns '' when nothing meaningful was said. */
export async function transcribe(audio: AudioInput): Promise<string> {
  const text = await transcribeRaw(audio);
  return isSilence(text) ? '' : text.replace(/[.\s]+$/, '');
}

async function transcribeRaw(audio: AudioInput): Promise<string> {
  try {
    return await viaGroq(audio);
  } catch (err) {
    console.warn(
      '[voice] whisper failed, trying gemini:',
      err instanceof Error ? err.message : err,
    );
    return viaGemini(audio);
  }
}
