/**
 * POST /api/invoice/generate-and-store
 *
 * Generates a fresh PDF for an existing invoice, overwrites the stored file,
 * and updates the DB record.
 *
 * Body:    { id: string, type: 'sale' | 'purchase' | 'proforma' }
 * Response: { pdfPath, generatedAt, templateVersion }
 *
 * Every call always regenerates — there is no conditional reuse.
 */
import { NextRequest, NextResponse } from 'next/server';
import { generateAndStorePdf } from '@/lib/invoice/generate-and-store';
import type { InvoiceType } from '@/lib/invoice/types';

const VALID_TYPES: InvoiceType[] = ['sale', 'purchase', 'proforma'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, type } = body as { id: string; type: InvoiceType };

    if (!id || !type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid request. Required: { id: string, type: "sale" | "purchase" | "proforma" }' },
        { status: 400 },
      );
    }

    const result = await generateAndStorePdf(id, type);

    return NextResponse.json({
      pdfPath:         result.pdfPath,
      generatedAt:     result.generatedAt,
      templateVersion: result.templateVersion,
    });
  } catch (error: any) {
    console.error('[generate-and-store] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error.message },
      { status: 500 },
    );
  }
}
