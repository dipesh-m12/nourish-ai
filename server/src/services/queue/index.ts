import { queueConfig } from '../../config/queue';
import { createBullmqQueue } from './bullmq.adapter';
import type { QueuePort } from './queue.port';

/** The one queue instance. The driver is picked by config; nothing else knows which it is. */
function create(): QueuePort {
  switch (queueConfig.driver) {
    case 'bullmq':
      return createBullmqQueue();
  }
}

let instance: QueuePort | null = null;

/** Lazy: the API process only connects if it actually enqueues something. */
export function queue(): QueuePort {
  instance ??= create();
  return instance;
}

export type { Job, JobHandler, QueuePort } from './queue.port';
