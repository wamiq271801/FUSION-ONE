/**
 * Job Manager — creates, updates, and tracks send jobs.
 *
 * Every send request becomes a Job. The JobManager owns the job lifecycle
 * (pending → processing → completed/failed/cancelled) and persists job
 * state in the StateStore.
 */
import type { Job, JobState, SendImageInput } from './types';
import { stateStore } from './state-store';
import { eventBus } from './event-bus';
import { normalizeIndianChatId } from './phone';

let jobCounter = 0;

function generateJobId(): string {
    jobCounter++;
    return `job_${Date.now()}_${jobCounter.toString(36).padStart(4, '0')}`;
}

export function createJob(
    input: SendImageInput,
    maxAttempts: number,
): Job {
    // Validate + normalize the phone number eagerly so invalid numbers
    // surface a clear error before the job even enters the queue.
    const chatId = normalizeIndianChatId(input.phone);
    const file = Buffer.isBuffer(input.file)
        ? input.file
        : Buffer.from(input.file);

    const job: Job = {
        id: generateJobId(),
        phone: input.phone,
        chatId,
        file,
        filename: input.filename || 'image',
        mimetype: input.mimetype || 'image/jpeg',
        caption: input.caption,
        state: 'pending',
        createdAt: Date.now(),
        queuedAt: Date.now(),
        startedAt: null,
        completedAt: null,
        attempts: 0,
        maxAttempts,
        error: null,
        messageId: null,
        ack: null,
    };

    stateStore.setJob(job);
    eventBus.emit({ type: 'JobCreated', at: Date.now(), job });
    eventBus.emit({ type: 'JobQueued', at: Date.now(), jobId: job.id });
    return job;
}

export function transitionJob(
    jobId: string,
    newState: JobState,
    patch: Partial<Job> = {},
): Job | null {
    const existing = stateStore.jobs.get(jobId);
    if (!existing) return null;
    const updated: Job = { ...existing, ...patch, state: newState };
    stateStore.setJob(updated);
    return updated;
}

export function markJobStarted(jobId: string): void {
    transitionJob(jobId, 'processing', { startedAt: Date.now() });
    eventBus.emit({ type: 'JobStarted', at: Date.now(), jobId });
}

export function markJobCompleted(
    jobId: string,
    messageId: string,
    ack: number,
): void {
    transitionJob(jobId, 'completed', {
        completedAt: Date.now(),
        messageId,
        ack,
        error: null,
    });
    eventBus.emit({ type: 'JobCompleted', at: Date.now(), jobId, messageId, ack });
}

export function markJobFailed(
    jobId: string,
    error: string,
    willRetry: boolean,
): void {
    transitionJob(jobId, willRetry ? 'pending' : 'failed', {
        completedAt: willRetry ? null : Date.now(),
        error,
    });
    eventBus.emit({ type: 'JobFailed', at: Date.now(), jobId, error, willRetry });
}

export function markJobRetrying(jobId: string, attempt: number): void {
    eventBus.emit({ type: 'JobRetrying', at: Date.now(), jobId, attempt });
}

export function cancelJob(jobId: string): boolean {
    const job = stateStore.jobs.get(jobId);
    if (!job) return false;
    if (job.state === 'processing') return false; // can't cancel in-flight
    if (job.state === 'completed' || job.state === 'cancelled') return false;
    transitionJob(jobId, 'cancelled', { completedAt: Date.now() });
    eventBus.emit({ type: 'JobCancelled', at: Date.now(), jobId });
    return true;
}

export function retryJob(jobId: string): boolean {
    const job = stateStore.jobs.get(jobId);
    if (!job) return false;
    if (job.state !== 'failed') return false;
    const updated: Job = {
        ...job,
        state: 'pending',
        queuedAt: Date.now(),
        startedAt: null,
        completedAt: null,
        error: null,
    };
    stateStore.setJob(updated);
    eventBus.emit({ type: 'JobQueued', at: Date.now(), jobId });
    return true;
}

export function incrementAttempt(jobId: string): number {
    const job = stateStore.jobs.get(jobId);
    if (!job) return 0;
    const attempts = job.attempts + 1;
    stateStore.setJob({ ...job, attempts });
    return attempts;
}

export function getPendingJobs(): Job[] {
    const pending: Job[] = [];
    for (const job of stateStore.jobs.values()) {
        if (job.state === 'pending') pending.push(job);
    }
    // Sort by queuedAt so oldest jobs run first.
    pending.sort((a, b) => a.queuedAt - b.queuedAt);
    return pending;
}

export function clearCompletedJobs(): number {
    let count = 0;
    for (const [id, job] of stateStore.jobs) {
        if (job.state === 'completed') {
            stateStore.jobs.delete(id);
            count++;
        }
    }
    stateStore['scheduleSnapshot']();
    return count;
}

export function clearFailedJobs(): number {
    let count = 0;
    for (const [id, job] of stateStore.jobs) {
        if (job.state === 'failed') {
            stateStore.jobs.delete(id);
            count++;
        }
    }
    stateStore['scheduleSnapshot']();
    return count;
}

/** Evict jobs that have been terminal for longer than ttlMs.
 *  Also evicts pending jobs that are older than 2×ttlMs (stuck pending
 *  jobs hold large PNG Buffers and must be cleaned up to bound memory). */
export function evictOldJobs(ttlMs: number): void {
    const now = Date.now();
    for (const [id, job] of stateStore.jobs) {
        if (
            (job.state === 'completed' || job.state === 'failed' || job.state === 'cancelled') &&
            job.completedAt &&
            now - job.completedAt > ttlMs
        ) {
            stateStore.jobs.delete(id);
        }
        // Evict stale pending jobs (engine was stopped, scheduler never picked them up)
        if (
            job.state === 'pending' &&
            now - job.queuedAt > ttlMs * 2
        ) {
            stateStore.jobs.delete(id);
        }
    }
}
