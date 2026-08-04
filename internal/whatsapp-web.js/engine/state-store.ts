/**
 * Centralized state store — single source of truth for the entire Engine.
 *
 * All Engine subsystems read from and write to this store. The store is
 * intentionally simple (plain object + setter) because the Engine is a
 * singleton and there's no need for redux-style immutability.
 *
 * The store emits a Snapshot event on the event bus whenever its state
 * changes, so subscribers stay in sync.
 */
import type {
    EngineState,
    BrowserState,
    AuthState,
    AccountInfo,
    EngineSnapshot,
    QueueStats,
    Job,
} from './types';
import { eventBus } from './event-bus';

class StateStore {
    engine: EngineState = 'STOPPED';
    browser: BrowserState = 'stopped';
    auth: AuthState = 'logged_out';
    qr: string | null = null;
    wwebVersion: string | null = null;
    account: AccountInfo | null = null;
    lastError: string | null = null;

    // Jobs are stored here so the snapshot includes them.
    jobs: Map<string, Job> = new Map();

    private snapshotScheduled = false;

    setEngine(state: EngineState): void {
        if (this.engine === state) return;
        this.engine = state;
        this.scheduleSnapshot();
    }

    setBrowser(state: BrowserState): void {
        if (this.browser === state) return;
        this.browser = state;
        this.scheduleSnapshot();
    }

    setAuth(state: AuthState): void {
        if (this.auth === state) return;
        this.auth = state;
        this.scheduleSnapshot();
    }

    setQr(qr: string | null): void {
        this.qr = qr;
        this.scheduleSnapshot();
    }

    setWwebVersion(v: string | null): void {
        this.wwebVersion = v;
        this.scheduleSnapshot();
    }

    setAccount(info: AccountInfo | null): void {
        this.account = info;
        this.scheduleSnapshot();
    }

    setError(err: string | null): void {
        this.lastError = err;
        this.scheduleSnapshot();
    }

    setJob(job: Job): void {
        this.jobs.set(job.id, job);
        this.scheduleSnapshot();
    }

    deleteJob(jobId: string): void {
        this.jobs.delete(jobId);
        this.scheduleSnapshot();
    }

    clearJobs(states: Job['state'][]): void {
        for (const [id, job] of this.jobs) {
            if (states.includes(job.state)) {
                this.jobs.delete(id);
            }
        }
        this.scheduleSnapshot();
    }

    getQueueStats(): QueueStats {
        let pending = 0, processing = 0, completed = 0, failed = 0, cancelled = 0;
        for (const job of this.jobs.values()) {
            switch (job.state) {
                case 'pending': pending++; break;
                case 'processing': processing++; break;
                case 'completed': completed++; break;
                case 'failed': failed++; break;
                case 'cancelled': cancelled++; break;
            }
        }
        return {
            pending,
            processing,
            completed,
            failed,
            cancelled,
            total: this.jobs.size,
        };
    }

    getSnapshot(): EngineSnapshot {
        const stats = this.getQueueStats();
        const health = this.computeHealth();
        return {
            engine: this.engine,
            browser: this.browser,
            auth: this.auth,
            qr: this.qr,
            ready: this.engine === 'READY',
            wwebVersion: this.wwebVersion,
            account: this.account,
            lastError: this.lastError,
            queue: stats,
            jobs: Array.from(this.jobs.values()),
            health,
        };
    }

    private computeHealth(): 'healthy' | 'degraded' | 'unhealthy' {
        if (this.engine === 'ERROR') return 'unhealthy';
        if (this.engine === 'READY' && this.browser === 'running') return 'healthy';
        if (this.engine === 'INITIALIZING' || this.engine === 'AUTHENTICATING') return 'degraded';
        return 'degraded';
    }

    /**
     * Batch snapshot emissions — if multiple state changes happen in the same
     * tick, only one Snapshot event is emitted. This prevents event storms
     * during rapid state transitions (e.g. job completion bursts).
     */
    private scheduleSnapshot(): void {
        if (this.snapshotScheduled) return;
        this.snapshotScheduled = true;
        // Use process.nextTick to batch all synchronous changes in one snapshot.
        process.nextTick(() => {
            this.snapshotScheduled = false;
            eventBus.emit({
                type: 'Snapshot',
                at: Date.now(),
                snapshot: this.getSnapshot(),
            });
        });
    }
}

export const stateStore = new StateStore();
