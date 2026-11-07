export interface WelcomeSlide {
  key: string;
  title: string;
  body: string;
  /** Background behind the illustration. Soft tints from the palette. */
  tint: string;
  /** Final artwork, e.g. require('@/assets/images/welcome-1-snap.webp'). Until set, `imageSpec` is shown. */
  image?: number;
  imageSpec: string;
}

/**
 * Three ideas, one per slide: effortless logging, a goal with a reason, an assistant that cares.
 * Artwork briefs: AGENTS.md §8. Each is 5:4 WebP on a flat fill of `tint`, with the top 15% kept empty (status bar).
 * Slide 1 shows only hands; slides 2–3 are object scenes (cards, checklists), so anyone can relate.
 */
export const WELCOME_SLIDES: WelcomeSlide[] = [
  {
    key: 'snap',
    title: 'Eat well, feel better.',
    body: 'Snap or say what you ate. Your assistant handles the counting.',
    tint: '#E1F1E6', // sampled from the artwork so the band and image blend seamlessly
    image: require('@/assets/images/welcome-1-snap.webp'),
    imageSpec:
      'welcome-1-snap.webp · hands holding a phone over an Indian thali, coral sparkle rising',
  },
  {
    key: 'why',
    title: 'A plan built on your why.',
    body: 'Not just a number. A goal that means something to you.',
    tint: '#FAEBD8', // sampled from the artwork
    image: require('@/assets/images/welcome-2-why.webp'),
    imageSpec: 'welcome-2-why.webp · tilted checklist card, coral heart badge, 3 of 4 rows ticked',
  },
  {
    key: 'care',
    title: 'Nudges, not nagging.',
    body: 'Small, timely tips that keep you on track, every day.',
    tint: '#F9EAD3', // sampled from the artwork
    image: require('@/assets/images/welcome-3-care.webp'),
    imageSpec:
      'welcome-3-care.webp · morning table, water + fruit, phone with a meal nudge card + streak dots',
  },
];
