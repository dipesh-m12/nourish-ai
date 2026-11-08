import { z } from 'zod';

// The app resizes photos first (~768px JPEG, ~100–200 KB). 1.4M base64 chars ≈ 1 MB, a generous ceiling.
const MAX_BASE64_LENGTH = 1_400_000;

/** A photo sent as base64 (no data: prefix). Shared by avatars, challenge proof and meals. */
export const imageInputSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  base64: z
    .string()
    .min(100, 'Photo is missing or empty')
    .max(MAX_BASE64_LENGTH, 'Photo is too large'),
});

/**
 * Checks the file really is the image type it claims (magic bytes), so a renamed
 * non-image can never be stored.
 */
export function looksLikeImage(bytes: Buffer, mimeType: string): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  switch (mimeType) {
    case 'image/jpeg':
      return starts(0xff, 0xd8, 0xff);
    case 'image/png':
      return starts(0x89, 0x50, 0x4e, 0x47);
    case 'image/webp':
      return starts(0x52, 0x49, 0x46, 0x46) && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
    default:
      return false;
  }
}

export type ImageUpload = z.infer<typeof imageInputSchema>;
