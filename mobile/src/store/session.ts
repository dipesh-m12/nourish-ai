import { create } from 'zustand';
import { posthog } from '@/lib/posthog';
import { queryClient } from '@/lib/query-client';
import { tokenStorage } from '@/lib/token-storage';

interface SessionState {
  /** JWT for the active profile. null = signed out. */
  token: string | null;
  /** False until the stored token has been read on app start. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Drops every cached query except the public profile list, so one profile's data
 * (me, plan, meals…) can never leak into the next session on this device.
 */
function clearPrivateCache() {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'profiles' });
}

/**
 * The token is mirrored here (in memory) for synchronous access by the API client;
 * the source of truth on disk is SecureStore. Whether it's still valid is checked
 * by the server: GET /me on app open, plus any 401 response triggers signOut.
 */
export const useSession = create<SessionState>()((set) => ({
  token: null,
  hydrated: false,

  hydrate: async () => {
    const token = await tokenStorage.get().catch(() => null);
    set({ token, hydrated: true });
  },

  signIn: async (token) => {
    clearPrivateCache(); // never show the previous profile's data
    await tokenStorage.set(token);
    set({ token });
  },

  signOut: async () => {
    posthog?.reset();
    await tokenStorage.clear();
    set({ token: null });
    clearPrivateCache();
  },
}));
