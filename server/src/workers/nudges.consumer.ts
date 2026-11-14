import { queueConfig } from '../config/queue';
import { nudgeService } from '../services/notifications/nudge.service';
import { queue, type JobHandler } from '../services/queue';

/**
 * Consumers for the `nudges` queue. Thin on purpose: they turn jobs into service calls.
 *
 *   nudge.scan      (repeating) → one nudge.evaluate job per user who can get pushes
 *   nudge.evaluate  { profileId } → nudgeService.evaluate
 */

export const NUDGE_JOBS = { scan: 'nudge.scan', evaluate: 'nudge.evaluate' } as const;

/** One evaluate per user per scan slot: a slow or repeated scan can't double-queue a user. */
const slot = () => Math.floor(Date.now() / queueConfig.schedules.nudgeScanEveryMs);

const scan: JobHandler = async () => {
  const s = slot();
  let users = 0;
  for await (const ids of nudgeService.targets()) {
    users += ids.length;
    await queue().enqueueMany(
      'nudges',
      ids.map((profileId) => ({
        name: NUDGE_JOBS.evaluate,
        data: { profileId },
        opts: { jobId: `eval-${profileId}-${s}` },
      })),
    );
  }
  console.log(`[nudges] scan ${s}: queued ${users} users`);
};

const evaluate: JobHandler<{ profileId: string }> = async (job) => {
  // Reminders due before the next scan get their own job at their exact minute.
  await nudgeService.scheduleExact(job.data.profileId).catch(() => undefined);
  const result = await nudgeService.evaluate(job.data.profileId);
  if (result === 'sent') console.log(`[nudges] sent to ${job.data.profileId}`);
};

export const nudgeHandlers = {
  [NUDGE_JOBS.scan]: scan,
  [NUDGE_JOBS.evaluate]: evaluate,
};
