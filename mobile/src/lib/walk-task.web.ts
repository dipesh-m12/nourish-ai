/** Web: no background tracking; the walk screen tracks while it's open. */
export interface RawFix {
  lng: number;
  lat: number;
  acc: number | null;
  t: number;
}
export const drainFixes = async (): Promise<RawFix[]> => [];
export const startBackgroundWalk = async () => false;
export const stopBackgroundWalk = async () => undefined;
