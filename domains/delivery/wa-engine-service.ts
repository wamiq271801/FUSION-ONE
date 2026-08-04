/**
 * wa-engine Delivery Service — the ONLY implementation of the DeliveryService
 * contract.
 *
 * Phase 3: This service no longer maps or translates engine state.
 * The wa-engine's EngineSnapshot IS the snapshot. The application
 * consumes it directly.
 *
 * The service is a thin pass-through: it delegates `deliver()` to
 * `engine.sendImage()`, and `subscribe()`/`getSnapshot()` to
 * `engine.subscribe()`/`engine.getSnapshot()`. No state is duplicated.
 */

import { engine } from '@internal/whatsapp-engine';
import type { EngineSnapshot, EngineEvent } from '@internal/whatsapp-engine';
import type {
    DeliveryRequest,
    DeliveryResult,
    DeliveryProgress,
    DeliveryService,
} from './types';

class WaEngineDeliveryService implements DeliveryService {

    async deliver(
        request: DeliveryRequest,
        onProgress?: (progress: DeliveryProgress) => void,
    ): Promise<DeliveryResult> {
        const report = (stage: DeliveryProgress['stage'], message: string) => {
            onProgress?.({ stage, message, at: Date.now() });
        };

        try {
            report('preparing', 'Preparing invoice');

            // Enqueue through the wa-engine. The engine owns the queue,
            // scheduler, retry, browser, and session — the application
            // does not touch any of these.
            const result = engine.sendImage({
                phone: request.recipient,
                file: request.attachment,
                filename: request.filename,
                mimetype: request.mimeType,
                caption: request.caption,
            });

            if (!result.ok) {
                report('failed', result.detail ?? result.error ?? 'Delivery failed');
                return { ok: false, error: result.error, detail: result.detail };
            }

            report('generating', 'Queued for delivery');
            report('uploading', 'Preparing media');
            report('sending', 'Sending WhatsApp message');

            // Wait for the job to complete. The engine processes it
            // asynchronously via the scheduler.
            const jobId = result.jobId;
            const maxWaitMs = 60_000;
            const start = Date.now();

            while (Date.now() - start < maxWaitMs) {
                const job = engine.getJob(jobId);
                if (!job) break;

                if (job.state === 'completed') {
                    report('delivered', 'Invoice sent');
                    return { ok: true, messageId: job.messageId ?? undefined };
                }

                if (job.state === 'failed') {
                    report('failed', job.error ?? 'Delivery failed');
                    return { ok: false, error: 'delivery-failed', detail: job.error ?? undefined };
                }

                await new Promise(resolve => setTimeout(resolve, 200));
            }

            report('failed', 'Delivery timed out');
            return { ok: false, error: 'delivery-timeout', detail: 'Job did not complete within 60s' };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Invoice delivery failed';
            report('failed', message);
            return { ok: false, error: 'delivery-failed', detail: message };
        }
    }

    subscribe(listener: (snapshot: EngineSnapshot) => void): () => void {
        // Forward Snapshot events directly — no mapping, no translation.
        // The engine IS the source of truth.
        return engine.subscribe((event: EngineEvent) => {
            if (event.type === 'Snapshot') {
                listener(event.snapshot);
            }
        });
    }

    getSnapshot(): EngineSnapshot {
        return engine.getSnapshot();
    }

    async start(): Promise<void> {
        // Do NOT override dataDir here. The engine's DEFAULT_CONFIG resolves
        // the permanent Chromium profile to the OS application-data directory
        // (Windows: %APPDATA%/FUSION ONE/whatsapp → userDataDir
        // %APPDATA%/FUSION ONE/whatsapp/session). The browser reads and writes
        // that one directory directly — no copying, backup, or sync. The same
        // directory is reused on every launch so existing sessions restore.
        await engine.initialize({
            authTimeoutMs: 120000,
        });
    }

    async shutdown(): Promise<void> {
        await engine.shutdown();
    }

    async logout(): Promise<void> {
        await engine.logout();
    }

    async restart(): Promise<void> {
        await engine.restart();
    }
}

export const deliveryService: DeliveryService = new WaEngineDeliveryService();
