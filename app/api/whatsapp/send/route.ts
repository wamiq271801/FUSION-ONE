import { NextRequest, NextResponse }            from 'next/server';
import { sendInvoice, type SendInvoiceParams } from '@/features/whatsapp/send-invoice';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: SendInvoiceParams;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Invalid JSON body', code: 'INVALID_JSON' } },
      { status: 400 },
    );
  }

  const { invoiceData, phone, messageTemplate } = body;
  if (!invoiceData || !phone || !messageTemplate) {
    return NextResponse.json(
      { success: false, error: { message: 'Missing required fields: invoiceData, phone, messageTemplate', code: 'MISSING_FIELDS' } },
      { status: 400 },
    );
  }

  try {
    await sendInvoice({ invoiceData, phone, messageTemplate });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/whatsapp/send] sendInvoice failed:', {
      message: err.message,
      code: err.code,
      status: err.status,
      stack: err.stack,
    });
    return NextResponse.json(
      { success: false, error: { message: err.message || 'Failed to send invoice', code: err.code || 'SEND_FAILED' } },
      { status: err.status ?? 500 },
    );
  }
}
