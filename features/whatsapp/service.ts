/**
 * WhatsApp Gateway Client — server-only.
 *
 * HTTP client targeting /wa-backend (REST API v1).
 * This module knows nothing about Baileys, Puppeteer, or WhatsApp internals.
 */

import type { WaBackendState, WaStatusResponse, WaQrResult } from './types';

const BACKEND_URL = process.env.WA_BACKEND_URL || 'http://localhost:42069';
const API_KEY     = process.env.WA_BACKEND_API_KEY || process.env.WA_API_KEY || '';

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function backendFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${BACKEND_URL}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'x-api-key': API_KEY, ...options.headers },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok || body.success === false) {
    const msg = body.error?.message || body.error || `Backend error: ${res.status}`;
    const err = new Error(msg);
    (err as any).status = res.status;
    (err as any).code = body.error?.code;
    throw err;
  }

  return body.data ?? body;
}

// ── State mapping ─────────────────────────────────────────────────────────────

function mapState(backendState: WaBackendState | string): WaStatusResponse['status'] {
  switch (backendState) {
    case 'READY':         return 'connected';
    case 'QR_READY':      return 'qr_ready';
    case 'STARTING':
    case 'BOOTING':
    case 'AUTHENTICATED':
    case 'RESTARTING':
    case 'LOGGING_OUT':   return 'connecting';
    default:              return 'disconnected';
  }
}

// ── Public API: Status ────────────────────────────────────────────────────────

export async function getStatusFromBackend(): Promise<WaStatusResponse> {
  try {
    const data = await backendFetch('/session');
    return {
      status:         mapState(data.state),
      state:          data.state,
      qr:             null,
      connectedSince: data.connectedSince || null,
      backendOnline:  true,
    };
  } catch {
    return {
      status: 'disconnected',
      state: 'DISCONNECTED',
      qr: null,
      connectedSince: null,
      backendOnline: false,
    };
  }
}

// ── Public API: QR snapshot ───────────────────────────────────────────────────

export async function getQrSnapshot(): Promise<WaQrResult> {
  try {
    const url = `${BACKEND_URL}/api/v1/session/qr`;
    const res = await fetch(url, {
      headers: { 'x-api-key': API_KEY },
    });

    const body = await res.json().catch(() => ({}));

    if (res.status === 200 && body.success) {
      return {
        ok: true,
        qr:        body.data.qr,
        issuedAt:  body.data.issuedAt,
        expiresAt: body.data.expiresAt,
        version:   body.data.version,
      };
    }

    // 202 = refresh in progress, 409 = already authenticated, 503 = not available
    return {
      ok:      false,
      code:    body.error?.code || `HTTP_${res.status}`,
      message: body.error?.message || `QR not available (${res.status})`,
    };
  } catch (err: any) {
    return { ok: false, code: 'NETWORK_ERROR', message: err.message || 'Backend unreachable' };
  }
}

// ── Public API: Connection lifecycle ──────────────────────────────────────────

export async function restartSession(): Promise<void> {
  await backendFetch('/session/restart', { method: 'POST' });
}

export async function logoutSession(): Promise<void> {
  await backendFetch('/session/logout', { method: 'POST' });
}

// Aliases for backward compat with route handlers
export const connect    = restartSession;
export const disconnect = logoutSession;

// ── Public API: Send text ─────────────────────────────────────────────────────

export async function sendText(phone: string, message: string): Promise<void> {
  await backendFetch('/messages/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: phone, text: message }),
  });
}

// ── Public API: Send media ────────────────────────────────────────────────────

export async function sendImage(
  phone: string,
  imageBuffer: Buffer,
  caption?: string,
  mimeType: string = 'image/png',
): Promise<void> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'bin';
  const formData = new FormData();
  formData.append('to', phone);
  if (caption) formData.append('caption', caption);

  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  formData.append('file', blob, `invoice.${ext}`);

  const url = `${BACKEND_URL}/api/v1/messages/media`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY },
    body: formData,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const msg = body.error?.message || body.error || `Send failed: ${res.status}`;
    const err = new Error(msg);
    (err as any).status = res.status;
    (err as any).code = body.error?.code;
    throw err;
  }
}

/**
 * Send image with smart retry — only retries network/timeout errors.
 */
export async function sendImageWithRetry(
  phone: string,
  imageBuffer: Buffer,
  caption?: string,
  mimeType: string = 'image/png',
): Promise<void> {
  try {
    await sendImage(phone, imageBuffer, caption, mimeType);
  } catch (err: any) {
    const code = err.code as string | undefined;
    // Do not retry auth/validation errors
    if (code === 'LOGIN_REQUIRED' || code === 'INVALID_RECIPIENT' || code === 'UNAUTHORIZED') {
      throw err;
    }
    if (code === 'WA_NOT_READY' || code === 'MEDIA_MISSING' || code === 'MEDIA_UNSUPPORTED_TYPE') {
      throw err;
    }
    // Retry once after 2s for transient failures
    console.warn('[WA] Send failed, retrying in 2s…');
    await new Promise((r) => setTimeout(r, 2000));
    await sendImage(phone, imageBuffer, caption, mimeType);
  }
}
