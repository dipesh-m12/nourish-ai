import { queueConfig } from '../config/queue';
import { sentLog } from '../services/notifications/sent-log.buffer';
import { queue } from '../services/queue';
import { NUDGE_JOBS, nudgeHandlers } from './nudges.consumer';

/**
 * The worker process (`npm run worker`), separate from the API so push work never slows
 * requests down. Registers the schedules (idempotent) and the consumers, and shuts down cleanly:
 * running jobs finish and the buffered send log is flushed.
 */

async function main() {
  const q = queue();
  await q.every('nudges', NUDGE_JOBS.scan, queueConfig.schedules.nudgeScanEveryMs);
  q.consume('nudges', nudgeHandlers);
  sentLog.start();
  console.log('[worker] consuming: nudges');

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[worker] ${signal}: finishing running jobs…`);
    await q.close();
    await sentLog.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] failed to start:', err);
  process.exit(1);
});
