/**
 * WhatsApp feature — shared types.
 * Safe to import from both server and client modules.
 */

// ── Backend session states (mirrors wa-backend/sessionStates.js) ──────────────

export type WaBackendState =
  | 'BOOTING'
  | 'STARTING'
  | 'QR_READY'
  | 'AUTHENTICATED'
  | 'READY'
  | 'DISCONNECTED'
  | 'LOGGING_OUT'
  | 'RESTARTING'
  | 'ERROR';

// ── Simplified UI connection states ───────────────────────────────────────────

export type WaStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr_ready'
  | 'connected'
  | 'reconnecting';

// ── Settings (persisted in Supabase whatsapp_settings table) ──────────────────

export interface WaSettings {
  auto_send_sale:            boolean;
  auto_send_proforma:        boolean;
  sale_message_template:     string;
  proforma_message_template: string;
}

// ── API response shape for the status endpoint ────────────────────────────────

export interface WaStatusResponse {
  status:         WaStatus;
  state:          WaBackendState;
  qr:             string | null;
  connectedSince: string | null;
  backendOnline:  boolean;
}

// ── QR snapshot from REST endpoint ────────────────────────────────────────────

export interface WaQrResult {
  ok:        boolean;
  code?:     string;
  message?:  string;
  qr?:       string;
  issuedAt?: number;
  expiresAt?: number;
  version?:  number;
}
