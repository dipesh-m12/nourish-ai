import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

/**
 * The phone's position for the camera and the line's live end: the last known fix straight
 * away (so the map opens on the right street), then a fresh one every couple of seconds.
 */
export function useLivePosition(enabled: boolean) {
  const [position, setPosition] = useState<Location.LocationObject | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let sub: Location.LocationSubscription | undefined;
    void Location.getLastKnownPositionAsync()
      .then((p) => {
        if (live && p) setPosition((cur) => cur ?? p);
      })
      .catch(() => undefined);
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 },
      (p) => {
        if (live) setPosition(p);
      },
    )
      .then((s) => (live ? (sub = s) : s.remove()))
      .catch(() => undefined);
    return () => {
      live = false;
      sub?.remove();
    };
  }, [enabled]);
  return position;
}
