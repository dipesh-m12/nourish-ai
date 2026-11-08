import { z } from 'zod';
import { imageInputSchema } from './image.validator';

export const avatarUploadSchema = z.object({ image: imageInputSchema });

export type AvatarUploadInput = z.infer<typeof avatarUploadSchema>;

export { looksLikeImage } from './image.validator';
