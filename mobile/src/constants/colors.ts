// JS copies of the Tailwind palette, for props that can't take a className
// (icon colors, SVG strokes). Keep in sync with tailwind.config.js.
export const colors = {
  bg: '#F7F6F2',
  card: '#FFFFFF',
  ink: '#1C2321',
  muted: '#5B6660',
  line: '#E7E4DC',
  primary: '#1F7A55',
  primarySoft: '#E6F2EB',
  accent: '#E07A5F',
  accentSoft: '#FBEDE8',
  /** Coral dark enough for text on accentSoft (4.9:1). */
  accentText: '#B04532',
  danger: '#B42318',
  mustard: '#D99A2B',
  sleep: '#6A8D73',
} as const;

/**
 * One colour per macro, used the same everywhere. Checked with the dataviz validator
 * (--pairs all, on white): every pair clears colour-blind and normal-vision separation.
 * Mustard is light on white (2.4:1), so it is never used alone: the label always sits beside
 * it. Tracks are a lighter step of each fill's own hue.
 */
export const macroColors = {
  // `text` = the same hue, dark enough for numbers on white (all >= 4.5:1).
  proteinG: { fill: '#C2503C', track: '#F5E0DB', text: '#C2503C' },
  carbsG: { fill: '#D99A2B', track: '#F7EBD3', text: '#9A6608' },
  fatG: { fill: '#5B6FD0', track: '#E2E6F8', text: '#4A5DC2' },
} as const;

/** Big numbers (Barlow Condensed): set by style, never by arbitrary size classes. */
export const NUM_FONT = 'BarlowCondensed_600SemiBold';
