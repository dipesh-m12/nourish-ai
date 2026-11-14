/** The web build has no push nudges (Android only for now): same API, does nothing. */

export async function pushToken(_ask = false): Promise<string | null> {
  return null;
}

export function useNotificationRouting(_enabled: boolean) {}
