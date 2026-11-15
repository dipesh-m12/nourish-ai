import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { sessionsApi, type SessionData } from '@/api/sessions';
import { ApiError } from '@/lib/api-client';

/**
 * Walks finished with no connection. The route and numbers stay on the phone and are sent when
 * the app is next online (any screen), so a walk in a park with no signal still counts.
 */
export interface PendingWalk {
  /** null = the walk started offline too: a session is created first. */
  sessionId: string | null;
  challengeId: string | null;
  date: string;
  amount?: number;
  data: SessionData;
}

const KEY = 'walk:outbox';

async function read(): Promise<PendingWalk[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingWalk[]) : [];
  } catch {
    return [];
  }
}
const write = (items: PendingWalk[]) =>
  AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => undefined);

/** No answer from the server (offline, timeout): worth trying again later. */
export const isNetworkError = (err: unknown) => err instanceof ApiError && err.status === 0;

/** Starts the server session if it never got one, then finishes it (logs + trophy). */
export async function sendWalk(walk: PendingWalk) {
  let id = walk.sessionId;
  if (!id) {
    const session = await sessionsApi.start({
      kind: 'walk',
      challengeId: walk.challengeId ?? undefined,
      date: walk.date,
      data: { title: walk.data.title },
    });
    id = session.id;
    walk.sessionId = id; // a retry finishes this one instead of starting another
  }
  return sessionsApi.finish(id, { date: walk.date, amount: walk.amount, data: walk.data });
}

export async function queueWalk(walk: PendingWalk) {
  await write([...(await read()), walk]);
}

let flushing = false;

/** Sends every waiting walk. A server "no" (ended, challenge gone) drops it; no signal keeps it. */
export async function flushWalks() {
  if (flushing || !onlineManager.isOnline()) return;
  flushing = true;
  try {
    const items = await read();
    if (!items.length) return;
    const left: PendingWalk[] = [];
    for (const walk of items) {
      try {
        await sendWalk(walk);
      } catch (err) {
        if (isNetworkError(err)) left.push(walk);
      }
    }
    await write(left);
  } finally {
    flushing = false;
  }
}

/** App-wide: sends waiting walks once signed in, and again each time the connection returns. */
export function useWalkOutbox(token: string | null) {
  useEffect(() => {
    if (!token) return;
    void flushWalks();
    return onlineManager.subscribe((online) => {
      if (online) void flushWalks();
    });
  }, [token]);
}
