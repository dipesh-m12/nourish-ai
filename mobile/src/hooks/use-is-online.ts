import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** True when the device has internet. Reads the same source the API client uses. */
export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}
