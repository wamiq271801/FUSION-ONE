import { NextRequest, NextResponse } from 'next/server';
import { renderInvoicePng } from '@/domains/invoice/renderers/png/export';
import type { InvoiceData } from '@/domains/invoice/types';

export async function POST(request: NextRequest) {
  try {
    const data: InvoiceData = await request.json();
    if (!data.bill_number || !data.type || !data.items) {
      return NextResponse.json({ error: 'Invalid invoice data' }, { status: 400 });
    }
    const png = await renderInvoicePng(data);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${data.bill_number}.png"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/invoice/png] error:', error);
    return NextResponse.json({ error: 'Failed to generate PNG', details: message }, { status: 500 });
  }
}
