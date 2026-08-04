/**
 * wa-engine types — the public contract of the WhatsApp Engine library.
 *
 * These types are shared between:
 *   - wa-engine (internal/whatsapp-web.js/engine/)
 *   - the Next.js adapter (src/lib/whatsapp/)
 *   - the frontend (via the snapshot API + SSE events)
 */

// ─── Engine State ───────────────────────────────────────────────────────────

export type EngineState =
    | 'STOPPED'
    | 'INITIALIZING'
    | 'AUTHENTICATING'
    | 'READY'
    | 'DISCONNECTED'
    | 'ERROR';

export type BrowserState = 'stopped' | 'launching' | 'running' | 'crashed';

export type AuthState =
    | 'logged_out'
    | 'pending_qr'
    | 'authenticated'
    | 'failed';

// ─── Job ────────────────────────────────────────────────────────────────────

export type JobState =
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface Job {
    id: string;
    phone: string;
    /** Normalized chat ID (91XXXXXXXXXX@c.us). */
    chatId: string;
    /** Image bytes (kept in memory while job is pending/processing). */
    file: Buffer;
    filename: string;
    mimetype: string;
    caption?: string;
    state: JobState;
    createdAt: number;
    queuedAt: number;
    startedAt: number | null;
    completedAt: number | null;
    attempts: number;
    maxAttempts: number;
    error: string | null;
    /** WhatsApp message ID on success. */
    messageId: string | null;
    /** WhatsApp ack value on success. */
    ack: number | null;
}

// ─── Snapshot ───────────────────────────────────────────────────────────────

export interface AccountInfo {
    wid: string | null;
    pushname: string | null;
    platform: string | null;
}

export interface QueueStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
}

export interface EngineSnapshot {
    engine: EngineState;
    browser: BrowserState;
    auth: AuthState;
    qr: string | null;
    ready: boolean;
    wwebVersion: string | null;
    account: AccountInfo | null;
    lastError: string | null;
    queue: QueueStats;
    jobs: Job[];
    health: 'healthy' | 'degraded' | 'unhealthy';
}

// ─── Public API types ───────────────────────────────────────────────────────

export interface SendImageInput {
    phone: string;
    file: Buffer | Uint8Array;
    filename?: string;
    mimetype?: string;
    caption?: string;
}

export interface SendImageResult {
    ok: boolean;
    jobId: string;
    error?: string;
    detail?: string;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export type EngineEvent =
    | { type: 'EngineStarted'; at: number }
    | { type: 'EngineReady'; at: number }
    | { type: 'EngineStopped'; at: number }
    | { type: 'EngineError'; at: number; error: string }
    | { type: 'BrowserLaunched'; at: number }
    | { type: 'BrowserClosed'; at: number }
    | { type: 'BrowserCrashed'; at: number; error: string }
    | { type: 'QrUpdated'; at: number; qr: string | null }
    | { type: 'Authenticated'; at: number }
    | { type: 'AuthFailed'; at: number; error: string }
    | { type: 'Disconnected'; at: number; reason: string }
    | { type: 'Reconnecting'; at: number }
    | { type: 'JobCreated'; at: number; job: Job }
    | { type: 'JobQueued'; at: number; jobId: string }
    | { type: 'JobStarted'; at: number; jobId: string }
    | { type: 'JobCompleted'; at: number; jobId: string; messageId: string; ack: number }
    | { type: 'JobFailed'; at: number; jobId: string; error: string; willRetry: boolean }
    | { type: 'JobCancelled'; at: number; jobId: string }
    | { type: 'JobRetrying'; at: number; jobId: string; attempt: number }
    | { type: 'QueueChanged'; at: number; stats: QueueStats }
    | { type: 'Snapshot'; at: number; snapshot: EngineSnapshot };

export type EventListener = (event: EngineEvent) => void;

// ─── Engine Configuration ───────────────────────────────────────────────────

export interface EngineConfig {
    /**
     * Permanent directory for the WhatsApp / Chromium session profile.
     *
     * `LocalAuth` appends a `session` sub-directory and uses it as the
     * Chromium `userDataDir`. Defaults to the OS application-data
     * directory (Windows: `%APPDATA%/FUSION ONE/whatsapp`, so the Chromium
     * profile lives at `%APPDATA%/FUSION ONE/whatsapp/session`). The browser
     * works directly from this directory — nothing is copied, synced,
     * imported, exported, or backed up.
     */
    dataDir: string;
    /** Max concurrent send jobs (default 1 — WhatsApp Web isn't concurrency-safe). */
    concurrency: number;
    /** Max retry attempts per job (default 2). */
    maxAttempts: number;
    /** Delay between retries in ms (default 5000). */
    retryDelayMs: number;
    /** Puppeteer launch args. */
    puppeteerArgs: string[];
    /** Keep completed/failed jobs for this many ms before auto-eviction (default 5min). */
    jobTtlMs: number;
    /** Auth timeout in ms (default 120000 — WhatsApp Web can be slow in headless). */
    authTimeoutMs?: number;
}
