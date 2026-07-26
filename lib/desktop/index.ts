/**
 * Desktop Integration Layer
 *
 * The ONLY place in the Next.js codebase that knows about the WebView2 bridge
 * (`window.desktop`) and the desktop runtime info (`window.__FUSION_DESKTOP__`)
 * injected by the WinUI host.
 *
 * Two responsibilities:
 *   1. Native actions  — savePdf / printPdf / shareFile / openExternal.
 *   2. Realtime status — a WebSocket client that consumes the desktop
 *      supervisor's snapshot-on-connect + incremental lifecycle events.
 *
 * Outside the desktop app (plain browser), everything degrades gracefully:
 * `isDesktop()` is false and the status client stays inert.
 */

// ── Bridge + runtime type declarations ──────────────────────────────────────

interface DesktopBridge {
  available?: boolean;
  runtime?: DesktopRuntimeInfo;
  statusUrl?: string | null;
  version?: string | null;
  buildMode?: string | null;
  invoke?: (action: string, payload?: Record<string, unknown>) => Promise<unknown>;
  on?: (name: string, cb: (payload: unknown) => void) => () => void;
  ping?: () => Promise<unknown>;
  savePdf: (base64: string, filename: string) => unknown;
  printPdf: (base64: string, filename: string) => unknown;
  shareFile: (base64: string, filename: string, title: string) => unknown;
}

interface DesktopRuntimeInfo {
  statusUrl?: string;
  webUrl?: string;
  version?: string;
  buildMode?: string;
  environment?: string;
  appDataRoot?: string;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
    __FUSION_DESKTOP__?: DesktopRuntimeInfo;
  }
}

// ── Environment detection ───────────────────────────────────────────────────

/** True when running inside the FusionOne desktop app (WebView2). SSR-safe. */
export const isDesktop = (): boolean =>
  typeof window !== 'undefined' && 'desktop' in window && window.desktop != null;

/** Desktop runtime info injected by the host (status URL, build metadata). */
export function getDesktopRuntime(): DesktopRuntimeInfo | null {
  if (typeof window === 'undefined') return null;
  return window.__FUSION_DESKTOP__ ?? null;
}

// ── Native bridge calls (guard with isDesktop()) ────────────────────────────

export function savePdf(base64: string, filename: string): void {
  if (!isDesktop()) throw new Error('[desktop] savePdf called outside desktop context');
  window.desktop!.savePdf(base64, filename);
}

export function printPdf(base64: string, filename: string): void {
  if (!isDesktop()) throw new Error('[desktop] printPdf called outside desktop context');
  window.desktop!.printPdf(base64, filename);
}

export function shareFile(base64: string, filename: string, title: string): void {
  if (!isDesktop()) throw new Error('[desktop] shareFile called outside desktop context');
  window.desktop!.shareFile(base64, filename, title);
}

/** Open a URL in the OS default browser (no-op outside desktop). */
export function openExternal(url: string): void {
  window.desktop?.invoke?.('openExternal', { url });
}

// ── Path-based actions (stored PDF workflow) ────────────────────────────────

/**
 * Print a PDF from a file path on disk (no base64 conversion needed).
 * Opens the file in the OS default PDF viewer.
 */
export function printFromPath(filePath: string): void {
  if (!isDesktop()) throw new Error('[desktop] printFromPath called outside desktop context');
  window.desktop!.invoke?.('printFromPath', { filePath })?.catch?.((e: any) =>
    console.error('[desktop] printFromPath failed:', e)
  );
}

/**
 * Share a file from a path on disk via the OS share dialog.
 */
export function shareFromPath(filePath: string, title: string): void {
  if (!isDesktop()) throw new Error('[desktop] shareFromPath called outside desktop context');
  window.desktop!.invoke?.('shareFromPath', { filePath, title })?.catch?.((e: any) =>
    console.error('[desktop] shareFromPath failed:', e)
  );
}

/**
 * Copy a file to a user-chosen location (Save As dialog).
 */
export function copyFile(filePath: string, suggestedFileName: string): void {
  if (!isDesktop()) throw new Error('[desktop] copyFile called outside desktop context');
  window.desktop!.invoke?.('copyFile', { filePath, suggestedFileName })?.catch?.((e: any) =>
    console.error('[desktop] copyFile failed:', e)
  );
}

/**
 * Open the file's containing folder in Explorer with the file selected.
 */
export function openFileLocation(filePath: string): void {
  if (!isDesktop()) throw new Error('[desktop] openFileLocation called outside desktop context');
  window.desktop!.invoke?.('openFileLocation', { filePath })?.catch?.((e: any) =>
    console.error('[desktop] openFileLocation failed:', e)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Realtime desktop status client (snapshot + events)
// ─────────────────────────────────────────────────────────────────────────────

export type DesktopServiceState =
  | 'STOPPED' | 'STARTING' | 'READY' | 'DEGRADED' | 'CRASHED' | 'RESTARTING' | 'UNKNOWN';

export type WaSessionState =
  | 'BOOTING' | 'STARTING' | 'QR_READY' | 'AUTHENTICATED' | 'READY'
  | 'DISCONNECTED' | 'LOGGING_OUT' | 'RESTARTING' | 'ERROR';

export interface WaSession {
  state:          WaSessionState;
  qrAvailable:    boolean;
  connectedSince: string | null;
  qrExpiresAt:    number | null;
  qrVersion:      number | null;
}

export interface DesktopServiceStatus {
  id:        string;
  state:     DesktopServiceState;
  port:      number;
  url:       string;
  restarts:  number;
  lastError: string | null;
  gatesUi:   boolean;
  session:   WaSession | null;
}

export interface DesktopBuildInfo { version: string; mode: string; environment: string; }

export interface DesktopStatusSnapshot {
  schemaVersion: number;
  build:         DesktopBuildInfo;
  desktop:       { available: boolean };
  services:      Record<string, DesktopServiceStatus>;
}

/** Connection state of the status client itself (distinct from service states). */
export type DesktopLinkState = 'idle' | 'connecting' | 'connected' | 'disconnected';

export interface DesktopStatusState {
  link:     DesktopLinkState;
  snapshot: DesktopStatusSnapshot | null;
}

type Listener = (state: DesktopStatusState) => void;

/**
 * Persistent WebSocket client for the desktop supervisor status pipeline.
 *
 * On connect the server pushes a full snapshot, then streams incremental
 * events. This client applies both and notifies subscribers. Reconnection is
 * purely client-side and NEVER triggers any service start/restart.
 */
class DesktopStatusClient {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = 1000;
  private stopped = false;

  private state: DesktopStatusState = { link: 'idle', snapshot: null };

  /** Idempotent: starts the connection loop if running in the desktop app. */
  start(): void {
    if (typeof window === 'undefined') return;
    if (this.ws) return;
    const rt = getDesktopRuntime();
    this.url = rt?.statusUrl ?? null;
    if (!this.url) return; // not desktop / no status server
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.ws) {
      this.ws.onclose = null;
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.setState({ ...this.state, link: 'idle' });
  }

  getState(): DesktopStatusState { return this.state; }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    cb(this.state);          // emit current immediately
    this.start();            // lazy-connect on first subscriber
    return () => { this.listeners.delete(cb); };
  }

  private connect(): void {
    if (!this.url || this.stopped) return;
    this.setState({ ...this.state, link: 'connecting' });

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this.setState({ ...this.state, link: 'connected' });
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'snapshot' && msg.snapshot) {
          this.setState({ link: 'connected', snapshot: msg.snapshot as DesktopStatusSnapshot });
        } else if (msg.type === 'event') {
          this.applyEvent(msg.event as string, msg.data);
        }
      } catch { /* ignore malformed frames */ }
    };

    ws.onclose = () => {
      this.ws = null;
      this.setState({ ...this.state, link: 'disconnected' });
      this.scheduleReconnect();
    };

    ws.onerror = () => { /* onclose will follow and drive reconnect */ };
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, 10000);
  }

  /** Apply an incremental lifecycle event onto the current snapshot. */
  private applyEvent(event: string, data: any): void {
    const snap = this.state.snapshot;
    if (!snap) return; // events before snapshot are ignored; snapshot is authoritative

    const next: DesktopStatusSnapshot = {
      ...snap,
      services: { ...snap.services },
    };

    switch (event) {
      case 'service.state': {
        const svc = next.services[data.service];
        if (svc) next.services[data.service] = { ...svc, state: data.state, restarts: data.restarts ?? svc.restarts, lastError: data.lastError ?? svc.lastError };
        break;
      }
      case 'service.crashed': {
        const svc = next.services[data.service];
        if (svc) next.services[data.service] = { ...svc, state: 'CRASHED', restarts: data.restarts ?? svc.restarts };
        break;
      }
      case 'service.restarting': {
        const svc = next.services[data.service];
        if (svc) next.services[data.service] = { ...svc, state: 'RESTARTING' };
        break;
      }
      case 'wa.session': {
        const wa = next.services['wa'];
        if (wa) next.services['wa'] = { ...wa, session: data as WaSession };
        break;
      }
      case 'wa.qr': {
        const wa = next.services['wa'];
        if (wa && wa.session) {
          next.services['wa'] = { ...wa, session: { ...wa.session, qrAvailable: !!data.available, qrVersion: data.version ?? wa.session.qrVersion, qrExpiresAt: data.expiresAt ?? wa.session.qrExpiresAt } };
        }
        break;
      }
      case 'desktop.shutdown': {
        next.desktop = { available: false };
        break;
      }
      default:
        return; // unknown event — no state change
    }

    this.setState({ ...this.state, snapshot: next });
  }

  private setState(state: DesktopStatusState): void {
    this.state = state;
    for (const cb of this.listeners) {
      try { cb(state); } catch { /* listener error isolated */ }
    }
  }
}

let _client: DesktopStatusClient | null = null;

/** Shared desktop status client singleton (inert outside the desktop app). */
export function getDesktopStatusClient(): DesktopStatusClient {
  if (!_client) _client = new DesktopStatusClient();
  return _client;
}
