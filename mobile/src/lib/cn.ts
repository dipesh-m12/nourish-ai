import { extendTailwindMerge } from 'tailwind-merge';

/**
 * NativeWind doesn't resolve conflicting classes, so a component's default `text-base`
 * could beat a caller's `text-4xl`. cn() merges them so the caller always wins.
 * Our custom font families are registered so `font-serif-bold` replaces `font-sans`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-family': [{ font: ['sans', 'sans-medium', 'sans-semibold', 'serif', 'serif-bold'] }],
    },
  },
});

export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(' '));
}
