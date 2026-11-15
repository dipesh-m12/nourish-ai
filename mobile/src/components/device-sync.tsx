import { useDeviceRegistration } from '@/hooks/use-device-registration';
import { useNotificationRouting } from '@/lib/push';
import { useWalkOutbox } from '@/lib/walk-outbox';
import { useSession } from '@/store/session';

/**
 * App-wide, renders nothing: keeps the server's view of this device current (timezone, push
 * token, last active), sends walks saved offline, and opens the screen a tapped nudge points to.
 */
export function DeviceSync({ ready }: { ready: boolean }) {
  const token = useSession((s) => s.token);
  useDeviceRegistration(token);
  // Walks finished with no signal are sent once the connection is back.
  useWalkOutbox(token);
  // Wait for the splash and a session: the route needs a signed-in, mounted navigator.
  useNotificationRouting(ready && !!token);
  return null;
}
