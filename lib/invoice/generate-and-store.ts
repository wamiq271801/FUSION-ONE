/**
 * Generate-and-store orchestrator — server-only.
 *
 * End-to-end flow:
 *   1. Fetch invoice data from DB (data-assembler)
 *   2. Render PDF buffer (existing renderer)
 *   3. Write to disk, overwriting any previous file (storage utilities)
 *   4. Update invoice record with pdf_path + pdf_generated_at + pdf_template_version
 *
 * Every call always regenerates a fresh PDF and overwrites the stored artifact.
 * No staleness checks. No conditional reuse.
 */
import { createClient } from '@supabase/supabase-js';
import { getInvoiceDataFromDb } from './data-assembler';
import { renderPdf } from './renderers/pdf';
import { writePdfToDisk } from './storage';
import type { InvoiceType } from './types';

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

/** Maps InvoiceType to its Supabase table name. */
const TYPE_TABLES: Record<InvoiceType, string> = {
  sale: 'sales',
  purchase: 'purchases',
  proforma: 'proforma_invoices',
};

export interface GenerateAndStoreResult {
  pdfPath: string;         // relative path stored in DB
  absolutePath: string;    // absolute path on disk
  generatedAt: string;     // ISO timestamp
  templateVersion: string; // template variant used
}

/**
 * Generate a fresh PDF for the given invoice and persist it to disk + DB.
 *
 * Always overwrites any previously stored PDF for that invoice.
 * The atomic write in writePdfToDisk (.tmp → rename) ensures no corrupt state
 * even if the process is interrupted mid-write.
 */
export async function generateAndStorePdf(
  id: string,
  type: InvoiceType,
): Promise<GenerateAndStoreResult> {
  // 1. Assemble data from DB
  const invoiceData = await getInvoiceDataFromDb(id, type);

  // 2. Render fresh PDF
  const pdfBuffer = await renderPdf(invoiceData);

  // 3. Write to disk — overwrites previous file atomically
  const { relativePath, absolutePath } = await writePdfToDisk(
    type,
    invoiceData.bill_number,
    pdfBuffer,
  );

  // 4. Update DB record
  const generatedAt = new Date().toISOString();
  const templateVersion = invoiceData.template || 'prestige';
  const supabase = getServerSupabase();

  const { error } = await supabase
    .from(TYPE_TABLES[type])
    .update({
      pdf_path: relativePath,
      pdf_generated_at: generatedAt,
      pdf_template_version: templateVersion,
    })
    .eq('id', id);

  if (error) {
    // PDF is already written to disk — log but don't fail. The file is usable.
    console.error(`[generate-and-store] DB update failed for ${type}/${id}:`, error.message);
  }

  return {
    pdfPath: relativePath,
    absolutePath,
    generatedAt,
    templateVersion,
  };
}
