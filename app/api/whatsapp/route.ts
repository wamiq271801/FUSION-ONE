import { NextRequest, NextResponse } from 'next/server';
import { deliveryService } from '@/domains/delivery';

export const runtime = 'nodejs';

function authorized(request: NextRequest) {
    const secret = process.env.WHATSAPP_INTERNAL_API_KEY;
    return !secret || request.headers.get('x-whatsapp-api-key') === secret;
}

/**
 * GET /api/whatsapp — return the complete engine snapshot.
 * POST /api/whatsapp — start or restart the engine.
 * DELETE /api/whatsapp — logout and clear session.
 *
 * The snapshot is the wa-engine's EngineSnapshot — the single source of truth.
 * No mapping, no translation, no duplicate state.
 */
export async function GET(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(deliveryService.getSnapshot());
}

export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (body.action === 'restart') {
        await deliveryService.restart();
    } else {
        await deliveryService.start();
    }
    return NextResponse.json(deliveryService.getSnapshot());
}

export async function DELETE(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await deliveryService.logout();
    return NextResponse.json(deliveryService.getSnapshot());
}
