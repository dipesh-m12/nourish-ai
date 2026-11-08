import { z } from 'zod';

// 30 s of mono AAC at 32 kbps is ~120 KB (~160K base64 chars). The cap leaves room for
// higher-bitrate devices while staying under the 2 MB JSON body limit.
const MAX_BASE64_LENGTH = 1_800_000;

/** Formats Whisper accepts (and Gemini as the fallback). */
export const AUDIO_MIME_TYPES = [
  'audio/m4a',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
] as const;

export const audioInputSchema = z.object({
  mimeType: z.enum(AUDIO_MIME_TYPES),
  base64: z.string().min(200, 'Recording is empty').max(MAX_BASE64_LENGTH, 'Recording is too long'),
});

export type AudioInput = z.infer<typeof audioInputSchema>;

/** POST /me/transcribe: one short voice note. */
export const transcribeSchema = z.object({ audio: audioInputSchema });

/** Checks the bytes really are audio of that family (container magic numbers). */
export function looksLikeAudio(bytes: Buffer, mimeType: string): boolean {
  const ascii = (from: number, to: number) => bytes.subarray(from, to).toString('ascii');
  switch (mimeType) {
    case 'audio/m4a':
    case 'audio/mp4':
    case 'audio/x-m4a':
      return ascii(4, 8) === 'ftyp'; // MPEG-4 container
    case 'audio/aac':
      return bytes[0] === 0xff && (bytes[1]! & 0xf0) === 0xf0; // ADTS
    case 'audio/mpeg':
      return ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0);
    case 'audio/wav':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE';
    case 'audio/webm':
      return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    default:
      return false;
  }
}
