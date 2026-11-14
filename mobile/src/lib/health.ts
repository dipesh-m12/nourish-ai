import {
  SdkAvailabilityStatus,
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

/**
 * Health Connect (Android): steps and last night's sleep, read so the user never has to log them.
 * Read-only. The web build gets health.web.ts (no-ops).
 */

export type HealthStatus = 'unavailable' | 'needs_permission' | 'granted';

const PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
] as const;

let ready: Promise<boolean> | null = null;
/** initialize() once per app run; false if Health Connect isn't installed or usable. */
function init() {
  ready ??= (async () => {
    try {
      if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
      return await initialize();
    } catch {
      return false;
    }
  })();
  return ready;
}

function hasAll(granted: { recordType: string; accessType: string }[]) {
  return PERMISSIONS.every((p) =>
    granted.some((g) => g.recordType === p.recordType && g.accessType === p.accessType),
  );
}

export async function healthStatus(): Promise<HealthStatus> {
  if (!(await init())) return 'unavailable';
  try {
    return hasAll(await getGrantedPermissions()) ? 'granted' : 'needs_permission';
  } catch {
    return 'needs_permission';
  }
}

/** Shows the system sheet. Android stops showing it after two refusals, so then open settings. */
export async function askHealth(): Promise<HealthStatus> {
  if (!(await init())) return 'unavailable';
  try {
    const granted = await requestPermission([...PERMISSIONS]);
    if (hasAll(granted)) return 'granted';
  } catch {
    // fall through to settings
  }
  openHealthConnectSettings();
  return 'needs_permission';
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Steps between two moments, or null when Health Connect can't say (not installed, no
 * permission). Used to fill in a walk while the app was closed.
 */
export async function stepsBetween(from: Date, to: Date): Promise<number | null> {
  try {
    if ((await healthStatus()) !== 'granted') return null;
    const result = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: from.toISOString(),
        endTime: to.toISOString(),
      },
    });
    return Math.round(result.COUNT_TOTAL ?? 0);
  } catch {
    return null;
  }
}

/** Steps since local midnight (all sources Health Connect merges: phone, watch…). */
export async function stepsToday(): Promise<number> {
  const result = await aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: startOfToday().toISOString(),
      endTime: new Date().toISOString(),
    },
  });
  return Math.round(result.COUNT_TOTAL ?? 0);
}

/** Hours of sleep in sessions that ended today (i.e. last night), to the nearest ¼ h. */
export async function sleepLastNight(): Promise<number> {
  const since = new Date(startOfToday().getTime() - 12 * 3_600_000); // from 12:00 yesterday
  const { records } = await readRecords('SleepSession', {
    timeRangeFilter: { operator: 'after', startTime: since.toISOString() },
  });
  const today = startOfToday().getTime();
  const ms = records
    .filter((r) => new Date(r.endTime).getTime() >= today)
    .reduce((sum, r) => sum + (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()), 0);
  return Math.round((ms / 3_600_000) * 4) / 4;
}
