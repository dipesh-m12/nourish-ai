import type { ChallengeCategory } from '@/types/plan';

/**
 * Each challenge category gets a soft card tint and one mark colour, so cards are told apart
 * by colour instead of icons. Text always stays in ink (dataviz skill: text never wears data colour);
 * the colour lives only in the marks (rings, bars, blocks).
 */
export const CATEGORY_THEME: Record<
  ChallengeCategory,
  { tint: string; mark: string; track: string }
> = {
  movement: { tint: '#E6F2EB', mark: '#1F7A55', track: '#CFE4D7' },
  nutrition: { tint: '#FBEDE8', mark: '#D9644A', track: '#F3D5CC' },
  hydration: { tint: '#E5EEF9', mark: '#3D7DD8', track: '#CCDCF2' },
  sleep: { tint: '#EEEAF6', mark: '#6E5CB0', track: '#DAD3EE' },
  mindset: { tint: '#F7EEDC', mark: '#B7801F', track: '#EBDCBC' },
};
