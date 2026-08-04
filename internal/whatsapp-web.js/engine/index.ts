/**
 * wa-engine — the public facade.
 *
 * This is the single entry point for the Next.js adapter. It owns:
 *   - configuration
 *   - lifecycle (initialize / shutdown / restart / logout)
 *   - the scheduler (delegates to job-manager + queue)
 *   - the snapshot API
 *   - the subscription API
 *
 * wa-engine is a singleton — one process, one Engine, one WhatsApp account.
 */

import type {
    EngineConfig,
    EngineSnapshot,
    EngineEvent,
    EventListener,
    SendImageInput,
    SendImageResult,
    Job,
} from './types';
import { stateStore } from './state-store';
import { eventBus } from './event-bus';
import { scheduler } from './scheduler';
import { createJob, cancelJob, retryJob, clearCompletedJobs, clearFailedJobs, evictOldJobs } from './job-manager';
import { queue } from './queue';
import * as whatsappClient from './whatsapp-client';
import os from 'node:os';
import path from 'node:path';

/**
 * Resolve the platform-appropriate application data directory.
 *
 * - Windows: %APPDATA%            (e.g. C:\Users\<user>\AppData\Roaming)
 * - macOS:   ~/Library/Application Support
 * - Linux:   $XDG_CONFIG_HOME or ~/.config
 *
 * Used as the base for the permanent WhatsApp session directory so the
 * session survives restarts and is never stored inside the project
 * (working) directory.
 */
function resolveAppDataDir(): string {
    switch (process.platform) {
        case 'win32':
            return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        case 'darwin':
            return path.join(os.homedir(), 'Library', 'Application Support');
        default: {
            // Linux / other POSIX
            const xdg = process.env.XDG_CONFIG_HOME;
            return xdg || path.join(os.homedir(), '.config');
        }
    }
}

/**
 * Resolve the permanent WhatsApp session data directory.
 *
 * `LocalAuth` appends a `session` sub-directory to `dataDir` and uses it as
 * the Chromium `userDataDir`, so the on-disk Chromium profile ends up at
 * `<appDataDir>/FUSION ONE/whatsapp/session` — a single permanent profile
 * reused on every launch.
 *
 * On Windows this is `%APPDATA%/FUSION ONE/whatsapp/session`.
 *
 * The browser works directly from this directory: nothing is copied,
 * synchronized, imported, exported, or backed up.
 */
function resolveSessionDataDir(): string {
    return path.join(resolveAppDataDir(), 'FUSION ONE', 'whatsapp');
}

const DEFAULT_CONFIG: EngineConfig = {
    dataDir: resolveSessionDataDir(),
    concurrency: 1,
    maxAttempts: 2,
    retryDelayMs: 5000,
    puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
    jobTtlMs: 5 * 60 * 1000, // 5 minutes
};

class WhatsAppEngine {
    private initialized = false;
    private config: EngineConfig = DEFAULT_CONFIG;
    private evictionTimer: ReturnType<typeof setInterval> | null = null;
    private restartPromise: Promise<void> | null = null;
    private initializePromise: Promise<void> | null = null;

    /**
     * Initialize the Engine. Safe to call multiple times — subsequent calls
     * are no-ops. Starts the browser, restores the session, and kicks off
     * the scheduler.
     */
    async initialize(config?: Partial<EngineConfig>): Promise<void> {
        if (this.initialized) return;
        if (this.initializePromise) return this.initializePromise;

        this.initializePromise = (async () => {
            this.config = { ...DEFAULT_CONFIG, ...config };
            whatsappClient.configure(this.config);
            scheduler.configure(this.config, whatsappClient.sendFn);
            scheduler.start();

            // Periodically evict old terminal jobs to bound memory.
            this.evictionTimer = setInterval(() => {
                evictOldJobs(this.config.jobTtlMs);
            }, 60_000);

            try {
                // Do not report the engine as initialized until Chromium has
                // either acquired the one permanent profile or failed clearly.
                await whatsappClient.launch();
                this.initialized = true;
            } catch (error) {
                scheduler.stop();
                if (this.evictionTimer) {
                    clearInterval(this.evictionTimer);
                    this.evictionTimer = null;
                }
                throw error;
            }
        })().finally(() => {
            this.initializePromise = null;
        });

        return this.initializePromise;
    }

    /**
     * Shut down the Engine and close the browser.
     */
    async shutdown(): Promise<void> {
        // A Client is not safely destroyable until its initialize() call has
        // settled. Waiting here prevents a shutdown/restart from racing a
        // concurrent Chromium launch against the same profile directory.
        if (this.initializePromise) await this.initializePromise.catch(() => undefined);
        if (this.evictionTimer) {
            clearInterval(this.evictionTimer);
            this.evictionTimer = null;
        }
        scheduler.stop();
        await whatsappClient.shutdown();
        this.initialized = false;
    }

    /**
     * Restart the Engine — shutdown then re-initialize.
     * Concurrent calls return the same promise.
     */
    async restart(): Promise<void> {
        if (this.restartPromise) return this.restartPromise;
        this.restartPromise = (async () => {
            try {
                await this.shutdown();
                await this.initialize();
            } finally {
                this.restartPromise = null;
            }
        })();
        return this.restartPromise;
    }

    /**
     * Log out the current WhatsApp account and clear the session.
     */
    async logout(): Promise<void> {
        await whatsappClient.logout();
    }

    /**
     * Queue an image to be sent. Returns the job ID immediately — the actual
     * send happens asynchronously via the scheduler.
     */
    sendImage(input: SendImageInput): SendImageResult {
        try {
            const job = createJob(input, this.config.maxAttempts);
            queue.notifyChanged();
            scheduler.notifyNewJob();
            return { ok: true, jobId: job.id };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { ok: false, jobId: '', error: 'invalid-chat-id', detail: msg };
        }
    }

    /**
     * Cancel a pending job. Returns false if the job doesn't exist or is
     * already processing/terminal.
     */
    cancelJob(jobId: string): boolean {
        return cancelJob(jobId);
    }

    /**
     * Retry a failed job. Returns false if the job doesn't exist or isn't
     * in the 'failed' state.
     */
    retryJob(jobId: string): boolean {
        const ok = retryJob(jobId);
        if (ok) {
            scheduler.notifyNewJob();
        }
        return ok;
    }

    /**
     * Remove all completed jobs from the store.
     */
    clearCompletedJobs(): number {
        return clearCompletedJobs();
    }

    /**
     * Remove all failed jobs from the store.
     */
    clearFailedJobs(): number {
        return clearFailedJobs();
    }

    /**
     * Get the complete current state of the Engine.
     */
    getSnapshot(): EngineSnapshot {
        return stateStore.getSnapshot();
    }

    /**
     * Subscribe to Engine events. Returns an unsubscribe function.
     * The listener receives every state change — no polling needed.
     */
    subscribe(listener: EventListener): () => void {
        return eventBus.subscribe(listener);
    }

    /**
     * Get a specific job by ID (for the adapter to return job status).
     */
    getJob(jobId: string): Job | null {
        return stateStore.jobs.get(jobId) ?? null;
    }
}

// Singleton — one wa-engine per process.
// Use globalThis to survive Next.js HMR in dev mode.
const g = globalThis as unknown as {
    __waEngine?: WhatsAppEngine;
    __waEngineCleanupInstalled?: boolean;
};
export const engine = g.__waEngine ?? (g.__waEngine = new WhatsAppEngine());

// Ensure clean shutdown on process exit.
if (!g.__waEngineCleanupInstalled) {
    g.__waEngineCleanupInstalled = true;
    let cleanupDone = false;
    const cleanup = (): Promise<void> => {
        if (cleanupDone) return Promise.resolve();
        cleanupDone = true;
        return engine.shutdown();
    };
    process.on('beforeExit', () => { void cleanup(); });
    process.on('SIGINT', () => { void cleanup().finally(() => process.exit(0)); });
    process.on('SIGTERM', () => { void cleanup().finally(() => process.exit(0)); });
}

// Re-export types for the adapter.
export type {
    EngineConfig,
    EngineSnapshot,
    EngineEvent,
    EventListener,
    SendImageInput,
    SendImageResult,
    Job,
    EngineState,
    BrowserState,
    AuthState,
    JobState,
    QueueStats,
    AccountInfo,
} from './types';
