import { NextRequest, NextResponse } from 'next/server';
import { deliveryService } from '@/domains/delivery';

export const runtime = 'nodejs';

const allowed = (request: NextRequest) =>
    !process.env.WHATSAPP_INTERNAL_API_KEY ||
    request.headers.get('x-whatsapp-api-key') === process.env.WHATSAPP_INTERNAL_API_KEY;

/**
 * GET /api/whatsapp/diagnostics — health snapshot derived from engine state.
 * The engine's snapshot already contains health info — this route just
 * extracts the diagnostic fields.
 */
export async function GET(request: NextRequest) {
    if (!allowed(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snap = deliveryService.getSnapshot();
    return NextResponse.json({
        uptimeSeconds: 0,
        sessionAgeSeconds: 0,
        reconnectAttempts: 0,
        socketHealthy: snap.engine === 'READY' && snap.browser === 'running',
        authenticationHealthy: snap.auth === 'authenticated',
        lastError: snap.lastError,
        status: snap.engine,
        lastSyncedAt: null,
        health: snap.health,
        queue: snap.queue,
    });
}
