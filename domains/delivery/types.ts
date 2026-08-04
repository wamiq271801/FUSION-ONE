/**
 * Delivery domain types — the permanent contract between the billing
 * application and the delivery engine.
 *
 * Phase 3: The delivery service no longer maintains a separate
 * DeliveryEngineState. The wa-engine's EngineSnapshot IS the snapshot.
 * The application consumes it directly — no mapping, no shim, no duplicate.
 */

// Re-export the engine's own types — they ARE the public contract.
export type {
    EngineSnapshot,
    EngineEvent,
    EngineState,
    BrowserState,
    AuthState,
    Job,
    JobState,
    QueueStats,
    AccountInfo,
    EngineConfig,
    EventListener,
    SendImageInput,
    SendImageResult,
} from '@internal/whatsapp-engine';

import type { EngineSnapshot } from '@internal/whatsapp-engine';

// ─── Delivery Request ────────────────────────────────────────────────────────

/**
 * An immutable request to deliver an invoice attachment to a recipient.
 * The application builds this after generating the attachment (PNG buffer).
 */
export interface DeliveryRequest {
    readonly invoiceId: string;
    readonly invoiceType: 'sale' | 'purchase' | 'proforma';
    readonly recipient: string;
    readonly attachment: Buffer;
    readonly mimeType: string;
    readonly filename: string;
    readonly caption?: string;
    readonly metadata?: Record<string, string | number | boolean>;
}

// ─── Delivery Result ─────────────────────────────────────────────────────────

export type DeliveryStage =
    | 'preparing'
    | 'generating'
    | 'uploading'
    | 'sending'
    | 'delivered'
    | 'failed';

export interface DeliveryProgress {
    readonly stage: DeliveryStage;
    readonly message: string;
    readonly at: number;
}

export interface DeliveryResult {
    readonly ok: boolean;
    readonly messageId?: string;
    readonly error?: string;
    readonly detail?: string;
}

// ─── Delivery Service Contract ──────────────────────────────────────────────

/**
 * The delivery service interface.
 *
 * The application calls `deliver()` to enqueue a delivery. It calls
 * `getSnapshot()` and `subscribe()` to observe engine state.
 *
 * There is NO separate state type — the engine's EngineSnapshot is
 * the single source of truth. No mapping, no compatibility shim.
 */
export interface DeliveryService {
    deliver(
        request: DeliveryRequest,
        onProgress?: (progress: DeliveryProgress) => void,
    ): Promise<DeliveryResult>;

    /** Subscribe to engine state changes. Returns unsubscribe function. */
    subscribe(listener: (snapshot: EngineSnapshot) => void): () => void;

    /** Get the current engine snapshot. */
    getSnapshot(): EngineSnapshot;

    /** Start the engine. Safe to call multiple times. */
    start(): Promise<void>;

    /** Shut down the engine gracefully. */
    shutdown(): Promise<void>;

    /** Log out and clear the engine's persisted session. */
    logout(): Promise<void>;

    /** Restart the engine. */
    restart(): Promise<void>;
}
