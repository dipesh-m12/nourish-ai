import { db } from '../../db';
import { notificationsSent } from '../../db/schema';

/**
 * The record of sent nudges, written in batches: one INSERT every 2 s (or at 500 rows) instead
 * of one per push. Safe because the log isn't what prevents duplicates: Redis claims each
 * (user, nudge, day) before sending (nudge.service.ts). The DB keeps history; the unique index +
 * ON CONFLICT DO NOTHING makes a replayed batch harmless.
 *
 * A crash can lose up to 2 s of log rows, never send a duplicate. Flushed on shutdown.
 */

type Row = typeof notificationsSent.$inferInsert;

const FLUSH_EVERY_MS = 2000;
const MAX_ROWS = 500;

let rows: Row[] = [];
let timer: NodeJS.Timeout | null = null;
let flushing: Promise<void> = Promise.resolve();

async function write(batch: Row[]) {
  try {
    await db.insert(notificationsSent).values(batch).onConflictDoNothing();
  } catch (err) {
    // Put them back for the next tick; a DB blip shouldn't lose the history.
    console.warn('[sent-log] insert failed, retrying:', err instanceof Error ? err.message : err);
    rows = batch.concat(rows).slice(0, MAX_ROWS * 10);
  }
}

export const sentLog = {
  add(row: Row) {
    rows.push(row);
    if (rows.length >= MAX_ROWS) void this.flush();
  },

  /** Writes whatever is buffered. Calls are serialised so batches never race. */
  flush(): Promise<void> {
    flushing = flushing.then(async () => {
      if (!rows.length) return;
      const batch = rows;
      rows = [];
      await write(batch);
    });
    return flushing;
  },

  start() {
    timer ??= setInterval(() => void this.flush(), FLUSH_EVERY_MS);
  },

  async stop() {
    if (timer) clearInterval(timer);
    timer = null;
    await this.flush();
  },
};
