import { env } from './env';

/**
 * Background jobs, configured in one place. Business code talks to `QueuePort`
 * (services/queue/queue.port.ts), never to BullMQ: moving to another queue (SQS, Cloud Tasks,
 * pg-boss…) means a new adapter + a new `driver` value here, nothing else.
 */
export const queueConfig = {
  driver: 'bullmq' as const,
  /** Key prefix in Redis, so queue keys never mix with checkout locks or caches. */
  prefix: 'nourish:q',
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  },
  queues: {
    /** Push nudges: a scan fans out one evaluate job per user. */
    nudges: {
      name: 'nudges',
      concurrency: 10,
      attempts: 3,
      backoffMs: 5_000,
      /** Finished jobs kept briefly for debugging, then dropped (Redis is small). */
      keepCompleted: 200,
      keepFailed: 500,
    },
  },
  schedules: {
    /** How often every user's day is checked for a nudge. Users' windows are local-time. */
    nudgeScanEveryMs: 10 * 60 * 1000,
  },
} as const;

export type QueueName = keyof typeof queueConfig.queues;
