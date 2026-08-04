import { NextRequest, NextResponse } from 'next/server';
import { deliveryService } from '@/domains/delivery';

export const runtime = 'nodejs';

/**
 * GET /api/whatsapp/qr — ensure engine started + return snapshot.
 * The QR is part of the snapshot (snapshot.qr). No separate pairing field.
 */
export async function GET(request: NextRequest) {
    const secret = process.env.WHATSAPP_INTERNAL_API_KEY;
    if (secret && request.headers.get('x-whatsapp-api-key') !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await deliveryService.start();
    return NextResponse.json(deliveryService.getSnapshot());
}
