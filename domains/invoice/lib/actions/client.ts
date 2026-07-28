'use client';

/**
 * Invoice client actions — browser-only.
 *
 * All exports operate on InvoiceData.
 * No files are ever stored; everything is generated on-demand.
 *
 * PNG pipeline: InvoiceData → POST /api/invoice/png → base64 pages[]
 *               → one PNG download per page.
 */
import type { InvoiceData } from '../types';

// ── Image preprocessing ────────────────────────────────────────────────────
// Converts remote logo/signature URLs to embedded JPEG data-URIs so that
// @react-pdf/renderer (server-side) can render them from the serialised JSON.

async function convertImageToDataUri(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const MAX = 1000;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        let tw = w, th = h;
        if (w > MAX || h > MAX) {
          if (w > h) { tw = MAX; th = Math.round((h * MAX) / w); }
          else        { th = MAX; tw = Math.round((w * MAX) / h); }
        }
        let canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        let ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        while (w * 0.5 > tw) {
          const t = document.createElement('canvas');
          w = Math.round(w * 0.5); h = Math.round(h * 0.5);
          t.width = w; t.height = h;
          const tc = t.getContext('2d')!;
          tc.imageSmoothingEnabled = true;
          tc.imageSmoothingQuality = 'high';
          tc.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, w, h);
          canvas = t; ctx = tc;
        }
        const fc = document.createElement('canvas');
        fc.width = tw; fc.height = th;
        const fctx = fc.getContext('2d')!;
        fctx.imageSmoothingEnabled = true;
        fctx.imageSmoothingQuality = 'high';
        fctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, tw, th);
        resolve(fc.toDataURL('image/jpeg', 1.0));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function embedImages(data: InvoiceData): Promise<InvoiceData> {
  if (!data.store) return data;
  const [logo, sig] = await Promise.all([
    data.store.logo_url && !data.store.logo_url.startsWith('data:')
      ? convertImageToDataUri(data.store.logo_url).catch(() => data.store!.logo_url!)
      : Promise.resolve(data.store.logo_url ?? ''),
    data.store.signature_url && !data.store.signature_url.startsWith('data:')
      ? convertImageToDataUri(data.store.signature_url).catch(() => data.store!.signature_url!)
      : Promise.resolve(data.store.signature_url ?? ''),
  ]);
  return { ...data, store: { ...data.store, logo_url: logo, signature_url: sig } };
}

// ── Core: PDF ──────────────────────────────────────────────────────────────

async function fetchPdfBlob(data: InvoiceData): Promise<{ blob: Blob; filename: string }> {
  const prepared = await embedImages(data);
  const res = await fetch('/api/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prepared),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'PDF generation failed');
  }
  return { blob: await res.blob(), filename: `${data.bill_number}.pdf` };
}

// ── Core: PNG ──────────────────────────────────────────────────────────────
// Pipeline: InvoiceData → POST /api/invoice/png → direct PNG response
// → client downloads the generated image.

async function fetchPng(data: InvoiceData): Promise<Blob> {
  const prepared = await embedImages(data);
  const res = await fetch('/api/invoice/png', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prepared),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'PNG generation failed');
  }
  return res.blob();
}

// ── Public: PDF ────────────────────────────────────────────────────────────

export async function downloadInvoicePdf(data: InvoiceData): Promise<void> {
  const { blob, filename } = await fetchPdfBlob(data);
  triggerDownload(blob, filename);
}

// ── Public: PNG ────────────────────────────────────────────────────────────
// Downloads the built-in invoice sharing layout as one PNG.

export async function downloadInvoicePng(data: InvoiceData): Promise<void> {
  triggerDownload(await fetchPng(data), `${data.bill_number}.png`);
}

// ── Internal helpers ───────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
