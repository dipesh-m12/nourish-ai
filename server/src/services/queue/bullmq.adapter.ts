import { Queue, Worker, type JobsOptions } from 'bullmq';
import { queueConfig, type QueueName } from '../../config/queue';
import type { JobHandler, JobOptions, QueuePort } from './queue.port';

/**
 * QueuePort on BullMQ (Redis). BullMQ opens its own connections (blocking commands need
 * `maxRetriesPerRequest: null`), separate from the app's fail-fast Redis client.
 */
export function createBullmqQueue(): QueuePort {
  const { connection, prefix } = queueConfig;
  const queues = new Map<QueueName, Queue>();
  const workers: Worker[] = [];

  const queueFor = (name: QueueName) => {
    let q = queues.get(name);
    if (!q) {
      q = new Queue(queueConfig.queues[name].name, { connection, prefix });
      queues.set(name, q);
    }
    return q;
  };

  const jobOpts = (name: QueueName, opts?: JobOptions): JobsOptions => {
    const c = queueConfig.queues[name];
    return {
      jobId: opts?.jobId,
      delay: opts?.delayMs,
      attempts: c.attempts,
      backoff: { type: 'exponential', delay: c.backoffMs },
      removeOnComplete: { count: c.keepCompleted },
      removeOnFail: { count: c.keepFailed },
    };
  };

  return {
    async enqueue(queue, name, data, opts) {
      await queueFor(queue).add(name, data, jobOpts(queue, opts));
    },

    async enqueueMany(queue, jobs) {
      if (!jobs.length) return;
      await queueFor(queue).addBulk(
        jobs.map((j) => ({ name: j.name, data: j.data, opts: jobOpts(queue, j.opts) })),
      );
    },

    async every(queue, name, everyMs) {
      await queueFor(queue).upsertJobScheduler(name, { every: everyMs }, { name, data: {} });
    },

    consume(queue, handlers) {
      const c = queueConfig.queues[queue];
      const worker = new Worker(
        c.name,
        async (job) => {
          const handler = handlers[job.name] as JobHandler | undefined;
          if (!handler) throw new Error(`No handler for job "${job.name}" on "${c.name}"`);
          await handler({
            id: job.id ?? '',
            name: job.name,
            data: job.data,
            attempt: job.attemptsMade + 1,
          });
        },
        { connection, prefix, concurrency: c.concurrency },
      );
      worker.on('failed', (job, err) =>
        console.warn(`[queue:${c.name}] ${job?.name} ${job?.id} failed: ${err.message}`),
      );
      workers.push(worker);
    },

    async close() {
      await Promise.all(workers.map((w) => w.close()));
      await Promise.all([...queues.values()].map((q) => q.close()));
    },
  };
}
