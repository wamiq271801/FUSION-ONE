/**
 * Queue — manages pending jobs and feeds them to the scheduler.
 *
 * The queue is intentionally simple: it's just a sorted view of pending
 * jobs in the StateStore. The scheduler polls the queue and processes
 * jobs one at a time (or up to the concurrency limit).
 */

import type { Job } from './types';
import { getPendingJobs } from './job-manager';
import { stateStore } from './state-store';
import { eventBus } from './event-bus';

class Queue {
    /** Returns the next pending job, or null if the queue is empty. */
    dequeue(): Job | null {
        const pending = getPendingJobs();
        if (pending.length === 0) return null;
        return pending[0];
    }

    /** Returns the number of pending jobs. */
    size(): number {
        return getPendingJobs().length;
    }

    /** Emits a QueueChanged event with current stats. */
    notifyChanged(): void {
        eventBus.emit({
            type: 'QueueChanged',
            at: Date.now(),
            stats: stateStore.getQueueStats(),
        });
    }
}

export const queue = new Queue();
