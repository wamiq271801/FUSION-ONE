/**
 * POST /api/invoice
 *
 * Server-side PDF generation. Accepts InvoiceData as JSON body,
 * renders via the centralized invoice module, returns binary PDF.
 */
import { NextRequest, NextResponse } from 'next/server';
import { renderPdf } from '@/domains/invoice/renderers/pdf';
import type { InvoiceData } from '@/domains/invoice/types';

export async function POST(request: NextRequest) {
  try {
    const body: InvoiceData = await request.json();

    if (!body.bill_number || !body.type || !body.items) {
      return NextResponse.json({ error: 'Invalid invoice data' }, { status: 400 });
    }

    const pdfBuffer = await renderPdf(body);

    const filename = body.type === 'sale'
      ? `Sale_Invoice_${body.bill_number}.pdf`
      : `Purchase_Bill_${body.bill_number}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error.message },
      { status: 500 },
    );
  }
}
