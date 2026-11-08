import type { Request, Response } from 'express';
import { transcribe } from '../services/ai/transcription.service';
import { AppError } from '../utils/app-error';
import { looksLikeAudio, type AudioInput } from '../validators/audio.validator';

export const voiceController = {
  /** One voice note → text. `text` is '' when nothing meaningful was said. */
  async transcribe(req: Request, res: Response) {
    const { audio } = req.body as { audio: AudioInput };
    // Reject non-audio before spending a transcription call.
    if (!looksLikeAudio(Buffer.from(audio.base64, 'base64'), audio.mimeType)) {
      throw new AppError(400, 'That recording isn’t a supported audio file');
    }
    let text: string;
    try {
      text = await transcribe(audio);
    } catch {
      throw new AppError(502, 'We couldn’t hear that right now. Please try again, or type it.');
    }
    res.json({ text });
  },
};
