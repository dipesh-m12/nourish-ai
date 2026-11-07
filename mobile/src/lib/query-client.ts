import { QueryClient } from '@tanstack/react-query';

// Shared instance so signing out can wipe cached data from the previous profile.
export const queryClient = new QueryClient({
  defaultOptions: {
    // Reads pause while offline and refetch automatically when the connection returns.
    queries: { retry: 1, staleTime: 30_000 },
    // Writes run immediately so an offline tap shows a clear error with "Try again",
    // instead of a button spinning silently until the connection comes back.
    mutations: { networkMode: 'always' },
  },
});
