import { NextRequest, NextResponse } from 'next/server';
import { renderInvoicePng } from '@/domains/invoice/renderers/png/export';
import { deliveryService } from '@/domains/delivery';
import type { InvoiceData } from '@/domains/invoice/types';

export const runtime = 'nodejs';

/**
 * POST /api/invoice/delivery
 *
 * Delivers an invoice as a WhatsApp image with an optional caption.
 *
 * Validates the request, renders the PNG (application domain), builds a
 * DeliveryRequest, and delegates to the DeliveryService. The underlying
 * transport is entirely hidden behind the service boundary.
 */
export async function POST(request: NextRequest) {
    try {
        const { invoice, to, caption } = await request.json() as {
            invoice: InvoiceData;
            to: string;
            caption: string;
        };

        if (!invoice?.bill_number || !to || !caption) {
            throw new Error('Invoice, recipient, and message are required');
        }

        // ── Application domain: generate the attachment ──────────────
        const png = await renderInvoicePng(invoice);

        // ── Delivery domain: send it ──────────────────────────────────
        // The delivery service handles all transport concerns (media
        // preparation, sending, progress reporting via SSE, error handling).
        const result = await deliveryService.deliver({
            invoiceId: invoice.bill_number,
            invoiceType: invoice.type,
            recipient: to,
            attachment: png,
            mimeType: 'image/png',
            filename: `${invoice.bill_number}.png`,
            caption,
        });

        if (result.ok) {
            return NextResponse.json({ id: result.messageId });
        } else {
            return NextResponse.json(
                { error: result.detail ?? result.error ?? 'Delivery failed' },
                { status: 400 },
            );
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Invoice delivery failed';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
