/**
 * Scheduler — dequeues jobs and processes them at the configured concurrency.
 *
 * The scheduler is the ONLY component that calls the sender. It owns:
 *   - dequeue order (FIFO by queuedAt)
 *   - concurrency limit
 *   - retry logic (with delay)
 *   - pause / resume
 *
 * The actual send function is injected by the Engine facade to avoid a
 * circular dependency on the WhatsApp client.
 */

import type { EngineConfig, Job } from './types';
import { queue } from './queue';
import { eventBus } from './event-bus';
import {
    markJobStarted,
    markJobCompleted,
    markJobFailed,
    markJobRetrying,
    incrementAttempt,
} from './job-manager';
import { stateStore } from './state-store';

export type SendFn = (job: Job) => Promise<{ messageId: string; ack: number }>;

class Scheduler {
    private running = false;
    private paused = false;
    private activeCount = 0;
    private config: EngineConfig | null = null;
    private sendFn: SendFn | null = null;
    private tickTimer: ReturnType<typeof setTimeout> | null = null;
    private retryTimers = new Set<ReturnType<typeof setTimeout>>();

    configure(config: EngineConfig, sendFn: SendFn): void {
        this.config = config;
        this.sendFn = sendFn;
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.paused = false;
        this.scheduleTick(0);
    }

    stop(): void {
        this.running = false;
        if (this.tickTimer) {
            clearTimeout(this.tickTimer);
            this.tickTimer = null;
        }
        // Clear all pending retry timers to prevent post-shutdown fires.
        for (const t of this.retryTimers) {
            clearTimeout(t);
        }
        this.retryTimers.clear();
    }

    pause(): void {
        this.paused = true;
    }

    resume(): void {
        this.paused = false;
        this.scheduleTick(0);
    }

    /** Called whenever a new job is queued — wakes the scheduler immediately. */
    notifyNewJob(): void {
        if (this.running && !this.paused) {
            this.scheduleTick(0);
        }
    }

    private scheduleTick(delayMs: number): void {
        if (!this.running) return;
        if (this.tickTimer) return; // already scheduled
        this.tickTimer = setTimeout(() => {
            this.tickTimer = null;
            this.tick();
        }, delayMs);
    }

    private tick(): void {
        if (!this.running || this.paused || !this.config || !this.sendFn) return;

        // Fill available concurrency slots.
        while (
            this.activeCount < this.config.concurrency &&
            !this.paused
        ) {
            const job = queue.dequeue();
            if (!job) break;
            this.executeJob(job);
        }

        // Schedule next tick if there are still pending jobs.
        if (queue.size() > 0 && !this.paused) {
            this.scheduleTick(100);
        }
    }

    private executeJob(job: Job): void {
        this.activeCount++;
        let attempt = 0;

        try {
            markJobStarted(job.id);
            attempt = incrementAttempt(job.id);
        } catch (err) {
            // If marking the job fails, decrement the slot and bail.
            this.activeCount--;
            console.error('[scheduler] failed to mark job started:', err);
            return;
        }

        this.sendFn!(job)
            .then((result) => {
                markJobCompleted(job.id, result.messageId, result.ack);
            })
            .catch((err: unknown) => {
                const errorMsg = err instanceof Error ? err.message : String(err);
                const willRetry = attempt < (job.maxAttempts);
                markJobFailed(job.id, errorMsg, willRetry);
                if (willRetry) {
                    markJobRetrying(job.id, attempt + 1);
                    // Re-queue after delay — the job is back in 'pending' state.
                    const timer = setTimeout(() => {
                        this.retryTimers.delete(timer);
                        this.notifyNewJob();
                    }, this.config!.retryDelayMs);
                    this.retryTimers.add(timer);
                }
            })
            .finally(() => {
                this.activeCount--;
                queue.notifyChanged();
                // Check if there's more work.
                this.scheduleTick(0);
            });
    }
}

export const scheduler = new Scheduler();
