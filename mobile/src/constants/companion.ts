import type { CompanionMood } from '@/types/companion';

/**
 * Mochi's faces. Transparent 512px WebP made from the source PNGs in assets/images/cat
 * (the fake checkerboard the image model drew was flood-filled away; ~35 KB each).
 * "left" reuses the sad face, faded, until assets/images/cat/left.webp exists.
 */
export const CAT_FACES: Record<CompanionMood, number> = {
  happy: require('@/assets/images/cat/happy.webp'),
  normal: require('@/assets/images/cat/normal.webp'),
  sad: require('@/assets/images/cat/sad.webp'),
  left: require('@/assets/images/cat/sad.webp'),
};
