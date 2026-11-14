import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { todayKey } from '@/api/today';
import { request } from '@/lib/api-client';
import { askHealth, healthStatus, sleepLastNight, stepsToday } from '@/lib/health';
import type { TodayChallenge } from '@/types/today';
import { autoSource } from '@/utils/challenge-format';

/** Foreground syncs closer together than this are skipped (Health Connect reads aren't free). */
const MIN_GAP_MS = 2 * 60 * 1000;

/**
 * Fills step and sleep challenges from Health Connect on open and on every return to the app.
 * The server SETS the day's synced amount (PUT …/sync), so repeated syncs never double-count.
 * Only changed values are sent.
 */
export function useHealthSync(date: string, challenges: TodayChallenge[]) {
  const queryClient = useQueryClient();
  const auto = challenges.filter((c) => autoSource(c));
  const status = useQuery({
    queryKey: ['health-status'],
    queryFn: healthStatus,
    enabled: auto.length > 0,
    staleTime: Infinity,
  });
  const sent = useRef(new Map<string, number>()); // `${id}:${date}` → amount last synced
  const lastRun = useRef(0);
  const ids = auto.map((c) => c.id).join();

  useEffect(() => {
    if (status.data !== 'granted' || !ids) return;
    const run = async () => {
      if (Date.now() - lastRun.current < MIN_GAP_MS) return;
      lastRun.current = Date.now();
      let changed = false;
      for (const c of auto) {
        try {
          const amount = autoSource(c) === 'steps' ? await stepsToday() : await sleepLastNight();
          const key = `${c.id}:${date}`;
          if (sent.current.get(key) === amount) continue;
          await request(`/me/challenges/${c.id}/sync`, { method: 'PUT', body: { date, amount } });
          sent.current.set(key, amount);
          changed = true;
        } catch {
          lastRun.current = 0; // retry on the next foreground
        }
      }
      if (changed) void queryClient.invalidateQueries({ queryKey: todayKey(date) });
    };
    void run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void run());
    return () => sub.remove();
    // `auto` is derived from `ids`; listing ids keeps the effect from re-running every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data, ids, date, queryClient]);

  const ask = async () => {
    const next = await askHealth();
    queryClient.setQueryData(['health-status'], next);
  };

  return { status: status.data, hasAuto: auto.length > 0, ask };
}
