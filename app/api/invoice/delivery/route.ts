import { NextRequest, NextResponse } from 'next/server';
import { renderInvoicePng } from '@/lib/invoice/renderers/png/export';
import { whatsappManager } from '@/lib/whatsapp/manager';
import type { InvoiceData } from '@/lib/invoice/types';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const { invoice, to, caption } = await request.json() as { invoice: InvoiceData; to: string; caption: string };
    if (!invoice?.bill_number || !to || !caption) throw new Error('Invoice, recipient, and message are required');
    whatsappManager.reportDelivery('preparing', 'Preparing invoice');
    whatsappManager.reportDelivery('generating', 'Generating invoice image');
    const png = await renderInvoicePng(invoice);
    whatsappManager.reportDelivery('uploading', 'Preparing media');
    const dataUri = `data:image/png;base64,${png.toString('base64')}`;
    whatsappManager.reportDelivery('sending', 'Sending WhatsApp message');
    const id = await whatsappManager.sendMedia({ to, dataUri, mimeType: 'image/png', fileName: `${invoice.bill_number}.png`, caption, kind: 'image' });
    whatsappManager.reportDelivery('delivered', 'Invoice sent');
    return NextResponse.json({ id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invoice delivery failed'; whatsappManager.reportDelivery('failed', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
