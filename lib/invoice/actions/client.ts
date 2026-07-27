'use client';

/**
 * Invoice client actions — browser-only.
 *
 * On-demand PDF generation: fetch from /api/invoice, present to user.
 */
import type { InvoiceData } from '../types';

// ── Image preprocessing ────────────────────────────────────────────────────

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

// ── On-demand PDF generation ───────────────────────────────────────────────

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

export async function downloadInvoicePdf(data: InvoiceData): Promise<void> {
  const { blob, filename } = await fetchPdfBytes(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function printInvoicePdf(data: InvoiceData): Promise<void> {
  const { blob } = await fetchPdfBytes(data);
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
  if (typeof navigator.share === 'function' && typeof File !== 'undefined') {
    try { await navigator.share({ files: [new File([blob], filename, { type: 'application/pdf' })], title: filename }); return; }
    catch { /* fall through */ }
  }
  await downloadInvoicePdf(data);
}
