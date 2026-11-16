import { useDeviceRegistration } from '@/hooks/use-device-registration';
import { useEffect } from 'react';
import { ensureChannel, useNotificationRouting } from '@/lib/push';
import { useWalkOutbox } from '@/lib/walk-outbox';
import { useSession } from '@/store/session';

/**
 * App-wide, renders nothing: keeps the server's view of this device current (timezone, push
 * token, last active), sends walks saved offline, and opens the screen a tapped nudge points to.
 */
export function DeviceSync({ ready }: { ready: boolean }) {
  const token = useSession((s) => s.token);
  // The chime channel, at every app start (signed in or not): pushes and local alerts that
  // arrive before push registration would otherwise use the default sound.
  useEffect(() => {
    void ensureChannel();
  }, []);
  useDeviceRegistration(token);
  // Walks finished with no signal are sent once the connection is back.
  useWalkOutbox(token);
  // Wait for the splash and a session: the route needs a signed-in, mounted navigator.
  useNotificationRouting(ready && !!token);
  return null;
}
