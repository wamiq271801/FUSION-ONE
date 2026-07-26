/**
 * Invoice client actions — works in both browser and DesktopHost (WebView2).
 *
 * When running inside the Windows desktop app, window.desktop is injected
 * by WebView2 (DesktopBridge.cs). All print/download/share calls are routed
 * through that bridge to native Windows APIs via @/lib/desktop.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 * The primary path is stored-PDF: PDFs are generated on save and stored on disk.
 * Actions (print, share, export) operate on the stored file path.
 *
 * The blob-based generate-on-demand functions (fetchPdfBytes, downloadInvoicePdf,
 * printInvoicePdf, shareInvoicePdf) are retained for the sales list page (app/sales/page.tsx)
 * which still uses them for quick list-level actions. They are NOT used by the
 * invoice detail/view pages.
 */
import type { InvoiceData } from '../types';
import {
  isDesktop,
  getDesktopRuntime,
  savePdf as desktopSavePdf,
  printPdf as desktopPrintPdf,
  shareFile as desktopShareFile,
  printFromPath as desktopPrintFromPath,
  shareFromPath as desktopShareFromPath,
  copyFile as desktopCopyFile,
  openFileLocation as desktopOpenFileLocation,
} from '@/lib/desktop';

// ── Image preprocessing (used by fetchPdfBytes for logo embedding) ─────────

async function convertLogoToJpeg(logoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const maxDim = 1000;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        let targetWidth = width;
        let targetHeight = height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            targetHeight = Math.round((height * maxDim) / width);
            targetWidth = maxDim;
          } else {
            targetWidth = Math.round((width * maxDim) / height);
            targetHeight = maxDim;
          }
        }
        let canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        let ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not get 2D context')); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        while (width * 0.5 > targetWidth) {
          width = Math.round(width * 0.5); height = Math.round(height * 0.5);
          const t = document.createElement('canvas');
          t.width = width; t.height = height;
          const tc = t.getContext('2d');
          if (tc) { tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high'; tc.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height); canvas = t; ctx = tc; }
        }
        const fc = document.createElement('canvas');
        fc.width = targetWidth; fc.height = targetHeight;
        const fctx = fc.getContext('2d');
        if (!fctx) { reject(new Error('Could not get final 2D context')); return; }
        fctx.imageSmoothingEnabled = true; fctx.imageSmoothingQuality = 'high';
        fctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, targetWidth, targetHeight);
        resolve(fc.toDataURL('image/jpeg', 1.0));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Failed to load image resource'));
    img.src = logoUrl;
  });
}

async function getCleanLogoUrl(logoUrl: string): Promise<string> {
  if (!logoUrl) return '';
  if (logoUrl.startsWith('data:')) return logoUrl;
  try { return await convertLogoToJpeg(logoUrl); }
  catch { return logoUrl; }
}

// ── Blob-based on-demand generation (used by sales list page) ──────────────
// These generate a PDF on-the-fly from InvoiceData. Used by the sales list
// ⋮ context menu. Not used by invoice detail/view pages.

async function fetchPdfBytes(data: InvoiceData): Promise<{ blob: Blob; filename: string }> {
  let processedData = data;
  if (data.store) {
    const cleanLogo = data.store.logo_url ? await getCleanLogoUrl(data.store.logo_url) : data.store.logo_url;
    const cleanSig  = data.store.signature_url ? await getCleanLogoUrl(data.store.signature_url) : data.store.signature_url;
    processedData = { ...data, store: { ...data.store, logo_url: cleanLogo, signature_url: cleanSig } };
  }
  const res = await fetch('/api/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(processedData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'PDF generation failed');
  }
  return { blob: await res.blob(), filename: `${data.bill_number}.pdf` };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function downloadInvoicePdf(data: InvoiceData): Promise<void> {
  const { blob, filename } = await fetchPdfBytes(data);
  if (isDesktop()) { desktopSavePdf(await blobToBase64(blob), filename); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function printInvoicePdf(data: InvoiceData): Promise<void> {
  const { blob, filename } = await fetchPdfBytes(data);
  if (isDesktop()) { desktopPrintPdf(await blobToBase64(blob), filename); return; }
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 1000);
  };
}

export async function shareInvoicePdf(data: InvoiceData): Promise<void> {
  const { blob, filename } = await fetchPdfBytes(data);
  if (isDesktop()) { desktopShareFile(await blobToBase64(blob), filename, filename); return; }
  if (typeof navigator.share === 'function' && typeof File !== 'undefined') {
    try { await navigator.share({ files: [new File([blob], filename, { type: 'application/pdf' })], title: filename }); return; }
    catch { /* fall through */ }
  }
  await downloadInvoicePdf(data);
}

// ── Stored PDF actions (path-based) ────────────────────────────────────────
//
// These operate on the persisted PDF file path from the database.
// Used by invoice detail/view pages (sales/[id], purchases/[id], proformas/[id]).

/** Resolve relative pdf_path from DB to a URL for the embedded viewer or download. */
export function getPdfViewerUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  return `/api/invoice/file?path=${encodeURIComponent(relativePath)}`;
}

/** Construct the absolute path from a relative DB path. Desktop-only. */
function resolveAbsolutePathClient(relativePath: string): string {
  // Use the appDataRoot injected by the desktop host via the runtime bootstrap.
  // Falls back to process.env.LOCALAPPDATA for server-side rendering context.
  const rt = getDesktopRuntime();
  const appDataRoot = rt?.appDataRoot
    || (typeof process !== 'undefined' ? process.env?.LOCALAPPDATA : null);
  if (appDataRoot) {
    const root = rt?.appDataRoot || `${appDataRoot}\\FusionOne`;
    return `${root}\\${relativePath.replace(/\//g, '\\')}`;
  }
  return relativePath;
}

/** Print from stored PDF file. */
export async function printStoredPdf(relativePath: string | null | undefined): Promise<void> {
  if (relativePath && isDesktop()) {
    desktopPrintFromPath(resolveAbsolutePathClient(relativePath));
    return;
  }
  if (relativePath) {
    const url = getPdfViewerUrl(relativePath)!;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { document.body.removeChild(iframe); }, 2000);
    };
  }
}

/** Share stored PDF via desktop share dialog. */
export async function shareStoredPdf(
  relativePath: string | null | undefined,
  title: string,
): Promise<void> {
  if (relativePath && isDesktop()) {
    desktopShareFromPath(resolveAbsolutePathClient(relativePath), title);
  }
}

/** Export/download stored PDF (Save As). */
export async function exportStoredPdf(
  relativePath: string | null | undefined,
  suggestedFilename: string,
): Promise<void> {
  if (relativePath && isDesktop()) {
    desktopCopyFile(resolveAbsolutePathClient(relativePath), suggestedFilename);
    return;
  }
  if (relativePath) {
    const url = getPdfViewerUrl(relativePath)!;
    const a = document.createElement('a');
    a.href = url; a.download = suggestedFilename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
}

/** Open the stored PDF's containing folder in Explorer. Desktop-only. */
export function openStoredPdfLocation(relativePath: string): void {
  if (!isDesktop()) return;
  desktopOpenFileLocation(resolveAbsolutePathClient(relativePath));
}

// ── PDF generation trigger (for save flows) ─────────────────────────────────

/**
 * Trigger server-side PDF generation and storage for a saved invoice.
 * Always generates a fresh PDF and overwrites the previously stored one.
 * Fire-and-forget: does not throw on failure (invoice is already saved).
 */
export async function triggerPdfGeneration(
  id: string,
  type: 'sale' | 'purchase' | 'proforma',
): Promise<{ pdfPath?: string; error?: string }> {
  try {
    const res = await fetch('/api/invoice/generate-and-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[triggerPdfGeneration] Failed:', err.error);
      return { error: err.error };
    }
    const data = await res.json();
    return { pdfPath: data.pdfPath };
  } catch (e: any) {
    console.error('[triggerPdfGeneration] Error:', e.message);
    return { error: e.message };
  }
}
