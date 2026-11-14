/** Web has no Health Connect: steps and sleep are logged by hand there. */
export type HealthStatus = 'unavailable' | 'needs_permission' | 'granted';

export const healthStatus = async (): Promise<HealthStatus> => 'unavailable';
export const askHealth = async (): Promise<HealthStatus> => 'unavailable';
export const stepsToday = async () => 0;
export const stepsBetween = async (_from: Date, _to: Date): Promise<number | null> => null;
export const sleepLastNight = async () => 0;
