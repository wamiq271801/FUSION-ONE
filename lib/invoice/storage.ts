/**
 * Invoice PDF storage utilities — server-only.
 *
 * Single source of truth for where invoice PDFs live on disk.
 * Uses the canonical FusionOne app data root:
 *   %LOCALAPPDATA%\FusionOne\Invoices\{Sales,Purchases,Proformas}\
 *
 * Paths stored in the database are RELATIVE to the FusionOne root
 * (e.g. "Invoices/Sales/SAL-2025-26-0001.pdf") so they survive
 * profile/machine changes.
 */
import path from 'path';
import fs from 'fs/promises';
import type { InvoiceType } from './types';

// ── Root resolution ─────────────────────────────────────────────────────────

const FUSION_ONE_DIR = 'FusionOne';
const INVOICES_DIR = 'Invoices';

/** Map invoice types to their storage subdirectory names. */
const TYPE_DIRS: Record<InvoiceType, string> = {
  sale: 'Sales',
  purchase: 'Purchases',
  proforma: 'Proformas',
};

/**
 * Absolute path to the FusionOne app data root.
 * On Windows: %LOCALAPPDATA%\FusionOne
 * Fallback for dev/non-Windows: <cwd>/.fusionone-data
 */
export function getFusionOneRoot(): string {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    return path.join(localAppData, FUSION_ONE_DIR);
  }
  // Dev fallback (Linux/Mac or missing env var)
  return path.join(process.cwd(), '.fusionone-data');
}

// ── Path builders ───────────────────────────────────────────────────────────

/**
 * Absolute path to the invoice PDF directory for a given type.
 * e.g. `C:\Users\X\AppData\Local\FusionOne\Invoices\Sales`
 */
export function getInvoicePdfDir(type: InvoiceType): string {
  return path.join(getFusionOneRoot(), INVOICES_DIR, TYPE_DIRS[type]);
}

/**
 * Absolute path for a specific invoice PDF file.
 * e.g. `C:\Users\X\AppData\Local\FusionOne\Invoices\Sales\SAL-2025-26-0001.pdf`
 */
export function getInvoicePdfAbsolutePath(type: InvoiceType, billNumber: string): string {
  const sanitized = billNumber.replace(/[<>:"/\\|?*]/g, '_');
  return path.join(getInvoicePdfDir(type), `${sanitized}.pdf`);
}

/**
 * Relative path for DB storage (relative to FusionOne root).
 * e.g. `Invoices/Sales/SAL-2025-26-0001.pdf`
 */
export function getInvoicePdfRelativePath(type: InvoiceType, billNumber: string): string {
  const sanitized = billNumber.replace(/[<>:"/\\|?*]/g, '_');
  return `${INVOICES_DIR}/${TYPE_DIRS[type]}/${sanitized}.pdf`;
}

/**
 * Resolve a relative PDF path (from DB) to an absolute path.
 */
export function resolveRelativePdfPath(relativePath: string): string {
  return path.join(getFusionOneRoot(), relativePath.replace(/\//g, path.sep));
}

// ── File operations ─────────────────────────────────────────────────────────

/** Ensure the invoice directory for the given type exists. */
export async function ensureInvoiceDir(type: InvoiceType): Promise<void> {
  await fs.mkdir(getInvoicePdfDir(type), { recursive: true });
}

/** Check whether a stored PDF file exists on disk. */
export async function pdfFileExists(absoluteOrRelativePath: string): Promise<boolean> {
  try {
    const abs = path.isAbsolute(absoluteOrRelativePath)
      ? absoluteOrRelativePath
      : resolveRelativePdfPath(absoluteOrRelativePath);
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

/** Delete a stored PDF file (for regeneration). No-op if missing. */
export async function deleteStoredPdf(absoluteOrRelativePath: string): Promise<void> {
  try {
    const abs = path.isAbsolute(absoluteOrRelativePath)
      ? absoluteOrRelativePath
      : resolveRelativePdfPath(absoluteOrRelativePath);
    await fs.unlink(abs);
  } catch {
    // File already gone — that's fine.
  }
}

/** Write PDF bytes to disk at the canonical path. Returns the relative path. */
export async function writePdfToDisk(
  type: InvoiceType,
  billNumber: string,
  pdfBuffer: Buffer,
): Promise<{ relativePath: string; absolutePath: string }> {
  await ensureInvoiceDir(type);
  const absolutePath = getInvoicePdfAbsolutePath(type, billNumber);
  const relativePath = getInvoicePdfRelativePath(type, billNumber);

  // Write to temp file first, then rename for atomicity.
  const tempPath = `${absolutePath}.tmp`;
  await fs.writeFile(tempPath, pdfBuffer);
  await fs.rename(tempPath, absolutePath);

  return { relativePath, absolutePath };
}

/**
 * Read a stored PDF file from disk. Returns the buffer or null if missing.
 */
export async function readStoredPdf(relativePath: string): Promise<Buffer | null> {
  try {
    const abs = resolveRelativePdfPath(relativePath);
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

// ── Path validation (security) ──────────────────────────────────────────────

/**
 * Validate that a requested path is within the Invoices directory.
 * Prevents path traversal attacks on the file serving endpoint.
 */
export function isValidInvoicePath(relativePath: string): boolean {
  if (!relativePath) return false;
  // Must start with Invoices/
  if (!relativePath.startsWith(`${INVOICES_DIR}/`)) return false;
  // Must not contain traversal sequences
  const normalized = path.normalize(relativePath);
  if (normalized.includes('..')) return false;
  // Must end with .pdf
  if (!normalized.endsWith('.pdf')) return false;
  return true;
}
