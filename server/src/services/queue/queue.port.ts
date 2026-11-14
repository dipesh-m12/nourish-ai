import type { QueueName } from '../../config/queue';

/**
 * What the app needs from a job queue, and nothing more. Adapters (bullmq.adapter.ts) implement
 * it; producers and consumers depend only on this.
 */

export interface JobOptions {
  /** Same id while a job is waiting or running = enqueued once (idempotent producers). */
  jobId?: string;
  delayMs?: number;
}

export interface Job<T> {
  id: string;
  name: string;
  data: T;
  attempt: number;
}

export type JobHandler<T = unknown> = (job: Job<T>) => Promise<void>;

export interface QueuePort {
  enqueue<T>(queue: QueueName, name: string, data: T, opts?: JobOptions): Promise<void>;
  enqueueMany<T>(
    queue: QueueName,
    jobs: { name: string; data: T; opts?: JobOptions }[],
  ): Promise<void>;
  /** A repeating job (cron-like). Calling it again with the same name updates, never duplicates. */
  every(queue: QueueName, name: string, everyMs: number): Promise<void>;
  /** Starts processing a queue. Handlers are routed by job name. */
  consume(queue: QueueName, handlers: Record<string, JobHandler<never>>): void;
  /** Stops taking new jobs and lets running ones finish. */
  close(): Promise<void>;
}
