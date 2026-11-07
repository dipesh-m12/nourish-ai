import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * Feeds the device's connectivity into TanStack Query's onlineManager, so:
 * - queries pause while offline and refetch automatically when the connection returns,
 * - request() can fail fast with an "offline" error,
 * - the OfflineBanner can read one shared source of truth.
 * `isInternetReachable` is null while unknown; only treat an explicit `false` as offline.
 */
export function startNetworkMonitoring() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    }),
  );
}
