/** Web has no native date dialog here: custom dates are Android-only (presets still work). */
export function pickDate(_min: string, _initial: string): Promise<string | null> {
  return Promise.resolve(null);
}

export const PICK_DATE_SUPPORTED = false;

export function pickTime(_h: number, _m: number): Promise<{ hour: number; minute: number } | null> {
  return Promise.resolve(null);
}
