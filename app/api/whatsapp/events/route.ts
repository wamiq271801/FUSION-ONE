import { deliveryService } from '@/domains/delivery';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/whatsapp/events — SSE stream of engine snapshots.
 *
 * Forwards the wa-engine's EngineSnapshot directly to the browser.
 * No mapping, no translation — the engine IS the source of truth.
 * The frontend consumes EngineSnapshot fields directly.
 */
export async function GET(request: NextRequest) {
    // Auth: same gate as all other WhatsApp routes.
    const secret = process.env.WHATSAPP_INTERNAL_API_KEY;
    if (secret && request.headers.get('x-whatsapp-api-key') !== secret) {
        return new Response('Unauthorized', { status: 401 });
    }

    const encoder = new TextEncoder();
    let cleanup: (() => void) | null = null;
    let closed = false;

    const stream = new ReadableStream({
        start(controller) {
            const publish = () => {
                if (closed) return;
                try {
                    const snapshot = deliveryService.getSnapshot();
                    const data = JSON.stringify(snapshot);
                    controller.enqueue(encoder.encode(`event: state\ndata: ${data}\n\n`));
                } catch {
                    // Controller may be closed — clean up.
                    cleanup?.();
                }
            };

            // Send initial snapshot immediately.
            publish();

            // Subscribe to engine state changes.
            const unsubscribe = deliveryService.subscribe(() => publish());

            // Heartbeat to keep the connection alive through proxies.
            const heartbeat = setInterval(() => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(': keepalive\n\n'));
                } catch {
                    cleanup?.();
                }
            }, 25_000);

            cleanup = () => {
                if (closed) return;
                closed = true;
                clearInterval(heartbeat);
                unsubscribe();
                try { controller.close(); } catch { /* already closed */ }
            };
        },
        cancel() {
            cleanup?.();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
