import { useMutation } from '@tanstack/react-query';
import type { VoiceNote } from '@/hooks/use-voice-note';
import { request } from '@/lib/api-client';
import { AI_TIMEOUT_MS } from '@/lib/api-config';

/** A voice note → text (on our server, so it works in Expo Go). '' means nothing was heard. */
export function useTranscribe() {
  return useMutation({
    mutationFn: (note: VoiceNote) =>
      request<{ text: string }>('/me/transcribe', {
        method: 'POST',
        body: { audio: { mimeType: note.mimeType, base64: note.base64 } },
        timeoutMs: AI_TIMEOUT_MS,
      }),
  });
}
