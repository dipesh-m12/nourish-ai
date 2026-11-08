/** Strict "1.2.3" (1–3 numeric parts). Anything else is not a version we compare. */
export const VERSION_PATTERN = /^\d+(\.\d+){0,2}$/;

/** Numeric, part by part: 1.10.0 > 1.9.9, and 1.2 == 1.2.0. Negative, zero or positive. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** A build is blocked when its version is at or below the rule's `blockedThrough`. */
export function isBlocked(version: string, blockedThrough: string | null): boolean {
  if (!blockedThrough || !VERSION_PATTERN.test(version)) return false;
  return compareVersions(version, blockedThrough) <= 0;
}
