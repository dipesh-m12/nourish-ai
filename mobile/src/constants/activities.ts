import type { ActivityKind } from '@/types/burn';

/**
 * What the user can log, with MET values mirroring server/src/services/burn/burn.math.ts.
 * Used only to preview kcal while choosing; the server's number is the one saved.
 */
export const ACTIVITIES: { kind: Exclude<ActivityKind, 'sleep'>; label: string; met: number }[] = [
  { kind: 'walk', label: 'Walk', met: 3.5 },
  { kind: 'brisk_walk', label: 'Brisk walk', met: 4.3 },
  { kind: 'run', label: 'Run', met: 9.8 },
  { kind: 'cycle', label: 'Cycling', met: 7.5 },
  { kind: 'yoga', label: 'Yoga', met: 2.5 },
  { kind: 'stretch', label: 'Stretching', met: 2.3 },
  { kind: 'strength', label: 'Strength', met: 5.0 },
  { kind: 'dance', label: 'Dance', met: 5.5 },
  { kind: 'sport', label: 'Sport', met: 5.5 },
  { kind: 'swim', label: 'Swim', met: 6.0 },
  { kind: 'chores', label: 'Chores', met: 3.3 },
];

/** Active kcal above resting: (MET − 1) × kg × hours. */
export function previewKcal(met: number, minutes: number, kg: number) {
  return Math.round((met - 1) * kg * (minutes / 60));
}
