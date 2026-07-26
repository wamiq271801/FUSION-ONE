/**
 * GET /api/invoice/file?path=<relative-path>
 *
 * Serves a stored invoice PDF from disk.
 * The `path` query param is the RELATIVE path stored in the DB
 * (e.g. "Invoices/Sales/SAL-2025-26-0001.pdf").
 *
 * Security: validates the path is within the Invoices directory
 * and ends with .pdf to prevent path traversal.
 */
import { NextRequest } from 'next/server';
import { isValidInvoicePath, resolveRelativePdfPath, pdfFileExists } from '@/lib/invoice/storage';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
  const relativePath = request.nextUrl.searchParams.get('path');

  if (!relativePath) {
    return new Response(JSON.stringify({ error: 'Missing "path" query parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Security: validate the path
  if (!isValidInvoicePath(relativePath)) {
    return new Response(JSON.stringify({ error: 'Invalid path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const absolutePath = resolveRelativePdfPath(relativePath);

  // Check file exists
  const exists = await pdfFileExists(relativePath);
  if (!exists) {
    return new Response(JSON.stringify({ error: 'PDF file not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const buffer = await fs.readFile(absolutePath);
    const filename = relativePath.split('/').pop() || 'invoice.pdf';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[invoice/file] Read error:', error.message);
    return new Response(JSON.stringify({ error: 'Failed to read PDF file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
