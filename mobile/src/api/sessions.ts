import { useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';

/** Mirrors server/src/db/schema.ts → SessionData. */
export interface SessionData {
  minutes?: number;
  movingMs?: number;
  metres?: number;
  steps?: number | null;
  pauses?: number;
  path?: [number, number][];
  awayMs?: number;
  calories?: number | null;
  title?: string;
  /** A Move workout (walk, run, yoga...): logged as this activity on finish. */
  activity?: string;
  /** A timed library exercise: logged with its own kind, name and MET. */
  exerciseId?: string;
}

export interface Session {
  id: string;
  kind: 'walk' | 'timer';
  status: 'active' | 'finished' | 'cancelled';
  challengeId: string | null;
  date: string;
  startedAt: string;
  endedAt: string | null;
  data: SessionData;
}

/**
 * Plain functions, not hooks: walks and timers call these from intervals and AppState handlers,
 * outside render. The start time lives on the server, so closing the app loses nothing.
 */
export const sessionsApi = {
  start: (body: {
    kind: Session['kind'];
    challengeId?: string;
    date: string;
    data?: SessionData;
  }) => request<Session>('/me/sessions', { method: 'POST', body }),
  checkpoint: (id: string, data: SessionData) =>
    request<Session>(`/me/sessions/${id}`, { method: 'PATCH', body: { data } }),
  get: (id: string) => request<Session>(`/me/sessions/${id}`),
  async finish(id: string, body: { date: string; amount?: number; data?: SessionData }) {
    const result = await request<{ session: Session; amount: number; calories: number | null }>(
      `/me/sessions/${id}/finish`,
      { method: 'POST', body },
    );
    // The challenge, burn and briefing all moved.
    void queryClient.invalidateQueries({ queryKey: ['today'] });
    void queryClient.invalidateQueries({ queryKey: ['briefing'] });
    return result;
  },
  async cancel(id: string) {
    await request(`/me/sessions/${id}/cancel`, { method: 'POST' });
    void queryClient.invalidateQueries({ queryKey: ['today'] });
  },
};

/** A finished walk, for its trophy card. */
export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => sessionsApi.get(id!),
    enabled: Boolean(id),
    staleTime: Infinity,
  });
}
