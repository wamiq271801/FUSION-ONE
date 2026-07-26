'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  MessageCircle, Wifi, Loader2, X, RefreshCw,
  Zap, FileText, Info, Check, LogOut,
} from 'lucide-react';
import { Button }   from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { useAuth }  from '@/components/auth/AuthProvider';
import { WA_TEMPLATE_VARS, WA_DEFAULT_SALE_TEMPLATE, WA_DEFAULT_PROFORMA_TEMPLATE } from '@/features/whatsapp/constants';
import { resolveWaError } from '@/features/whatsapp/errors';

// ── Config ────────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.NEXT_PUBLIC_WA_BACKEND_URL || 'http://localhost:42069';
const API_KEY     = process.env.NEXT_PUBLIC_WA_API_KEY     || '';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConnectionState = 'checking' | 'offline' | 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

interface WaSettings {
  auto_send_sale: boolean;
  auto_send_proforma: boolean;
  sale_message_template: string;
  proforma_message_template: string;
}

// ── State mapping ─────────────────────────────────────────────────────────────

function mapState(backend: string): ConnectionState {
  switch (backend) {
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

// ── Small components ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${checked ? 'bg-emerald-500' : 'bg-slate-200'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function TemplateEditor({ label, value, onChange, onSave, isSaving }: {
  label: string; value: string; onChange: (v: string) => void; onSave: () => void; isSaving: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function insert(v: string) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    onChange(value.slice(0, s) + v + value.slice(e));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + v.length; });
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
        <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
        <span className="text-xs font-semibold text-slate-900">{label}</span>
      </div>
      <div className="p-5 space-y-4">
        <textarea ref={ref} rows={9} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full border border-slate-200 rounded-lg bg-white px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono leading-relaxed"
          placeholder="Type your message…" />
        <div className="flex flex-wrap gap-1.5">
          {WA_TEMPLATE_VARS.map((v) => (
            <button key={v} onClick={() => insert(v)} className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">{v}</button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={onSave} isLoading={isSaving} className="h-8 text-xs gap-1.5">
            <Check className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── QR Image Hook ─────────────────────────────────────────────────────────────

function useQrDataUrl(qrString: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!qrString) { setDataUrl(null); return; }
    let cancelled = false;
    QRCode.toDataURL(qrString, { width: 300, margin: 2 })
      .then((url: string) => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [qrString]);

  return dataUrl;
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function WhatsAppPanel() {
  const { success, error: showError } = useToast();
  const { user } = useAuth();

  // ── Connection state (driven by native WebSocket) ───────────────────────────
  const [state, setState]   = useState<ConnectionState>('checking');
  const [qrStr, setQrStr]   = useState<string | null>(null);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [lastError, setLastError]       = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the user explicitly initiated a connect flow.
  // Only open QR dialog automatically when this is true.
  const userInitiatedConnect = useRef(false);

  const qrDataUrl = useQrDataUrl(qrStr);

  useEffect(() => {
    function connectWs() {
      if (wsRef.current && wsRef.current.readyState <= 1) return;

      const wsUrl = BACKEND_URL.replace(/^http/, 'ws') + `/ws?api_key=${encodeURIComponent(API_KEY)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => prev === 'checking' ? prev : prev); // will get snapshot immediately
      };

      ws.onmessage = (evt) => {
        try {
          const { event, payload } = JSON.parse(evt.data);

          switch (event) {
            case 'session.snapshot': {
              const mapped = mapState(payload.state || 'DISCONNECTED');
              setState(mapped);
              setQrStr(payload.qr?.value || null);
              setLastError(null);
              // Auto-show QR dialog only if user explicitly initiated connect
              if (mapped === 'qr_ready' && payload.qr?.value && userInitiatedConnect.current) {
                setShowQrDialog(true);
              }
              // If snapshot says disconnected/connected, clear the connect intent
              if (mapped === 'disconnected' || mapped === 'connected') {
                userInitiatedConnect.current = false;
              }
              break;
            }
            case 'session.qr': {
              setState('qr_ready');
              setQrStr(payload.qr || null);
              // Only auto-show QR dialog if user initiated a connect flow
              if (userInitiatedConnect.current) {
                setShowQrDialog(true);
              }
              break;
            }
            case 'session.authenticated': {
              setState('connecting');
              setQrStr(null);
              break;
            }
            case 'session.ready': {
              setState('connected');
              setQrStr(null);
              setShowQrDialog(false);
              setLastError(null);
              userInitiatedConnect.current = false;
              success('WhatsApp Connected', 'Linked successfully');
              break;
            }
            case 'session.disconnected': {
              setState('disconnected');
              setQrStr(null);
              setShowQrDialog(false);
              setLastError(null);
              userInitiatedConnect.current = false;
              break;
            }
            case 'session.error': {
              setLastError(payload.message || 'Unknown error');
              break;
            }
            // message.* and metrics.* — ignore in this panel
          }
        } catch { /* ignore malformed messages */ }
      };

      ws.onclose = () => {
        setState('offline');
        setQrStr(null);
        reconnectTimer.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    }

    connectWs();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [success]);

  // ── Settings (Supabase) ─────────────────────────────────────────────────────
  const [settings, setSettings] = useState<WaSettings | null>(null);
  const [saleText, setSaleText] = useState('');
  const [proformaText, setProformaText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('whatsapp_settings').select('*').eq('owner_user_id', user.id).maybeSingle()
      .then(({ data }) => {
        const s: WaSettings = {
          auto_send_sale:            data?.auto_send_sale            ?? false,
          auto_send_proforma:        data?.auto_send_proforma        ?? false,
          sale_message_template:     data?.sale_message_template     ?? WA_DEFAULT_SALE_TEMPLATE,
          proforma_message_template: data?.proforma_message_template ?? WA_DEFAULT_PROFORMA_TEMPLATE,
        };
        setSettings(s);
        setSaleText(s.sale_message_template);
        setProformaText(s.proforma_message_template);
      });
  }, [user?.id]);

  const saveField = useCallback(async (patch: Partial<WaSettings>) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await supabase.from('whatsapp_settings')
        .upsert({ owner_user_id: user.id, ...patch }, { onConflict: 'owner_user_id' });
      setSettings((prev) => prev ? { ...prev, ...patch } : prev);
    } catch (e: any) { showError('Save failed', e.message); }
    finally { setSaving(false); }
  }, [user?.id, showError]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(false);

  async function handleConnect() {
    userInitiatedConnect.current = true;

    // If the backend already has a QR ready (e.g. after a logout auto-reinit),
    // do NOT trigger another restart — that would force an invalid lifecycle
    // transition on the backend. Just reveal the QR that's already available.
    if (state === 'qr_ready' && qrStr) {
      setShowQrDialog(true);
      return;
    }

    setActionLoading(true);
    setShowQrDialog(true);
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const { title, message } = resolveWaError(body);
        showError(title, message);
        setShowQrDialog(false);
        userInitiatedConnect.current = false;
      }
    } catch (e: any) {
      const { title, message } = resolveWaError(e);
      showError(title, message);
      setShowQrDialog(false);
      userInitiatedConnect.current = false;
    } finally { setActionLoading(false); }
  }

  async function handleDisconnect() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const { title, message } = resolveWaError(body);
        showError(title, message);
      } else {
        // Immediately reflect disconnected state — don't wait for WS event
        setState('disconnected');
        setQrStr(null);
        setShowQrDialog(false);
        setLastError(null);
        userInitiatedConnect.current = false;
        success('Disconnected', 'WhatsApp unlinked.');
      }
    } catch (e: any) {
      const { title, message } = resolveWaError(e);
      showError(title, message);
    } finally { setActionLoading(false); }
  }

  async function handleRefreshQr() {
    setActionLoading(true);
    userInitiatedConnect.current = true;
    try {
      const res = await fetch('/api/whatsapp/qr');
      const body = await res.json().catch(() => ({}));
      if (body.ok && body.qr) {
        setQrStr(body.qr);
        setShowQrDialog(true);
      } else {
        const { title, message } = resolveWaError(body);
        showError(title, message);
      }
    } catch (e: any) {
      const { title, message } = resolveWaError(e);
      showError(title, message);
    } finally { setActionLoading(false); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Transaction Messages</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">Send invoice images directly to customers via WhatsApp.</p>
      </div>

      {/* Connection card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
          <MessageCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold text-slate-900">WhatsApp</span>
        </div>
        <div className="p-5">
          {state === 'checking' && (
            <div className="flex items-center gap-2.5">
              <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
              <span className="text-xs text-slate-400">Checking server…</span>
            </div>
          )}

          {state === 'offline' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                <span className="text-xs font-medium text-rose-600">Server offline</span>
              </div>
              <p className="text-[11px] text-slate-400">Start the WhatsApp backend to enable messaging.</p>
            </div>
          )}

          {(state === 'disconnected' || state === 'connecting' || state === 'qr_ready') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full shrink-0 ${state === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-xs text-slate-500">
                  {state === 'connecting' ? 'Starting…' : state === 'qr_ready' ? 'Scan QR to connect' : 'Not connected'}
                </span>
              </div>
              {lastError && (
                <p className="text-[11px] text-rose-500">{lastError}</p>
              )}
              <div className="flex gap-2">
                {state !== 'connecting' && (
                  <Button size="sm" onClick={handleConnect} isLoading={actionLoading}
                    className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700">
                    <Wifi className="h-3.5 w-3.5" /> Connect WhatsApp
                  </Button>
                )}
              </div>
            </div>
          )}

          {state === 'connected' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <p className="text-xs font-semibold text-emerald-700">Connected</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleDisconnect} isLoading={actionLoading}
                className="gap-1.5 text-xs h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200">
                <LogOut className="h-3 w-3" /> Disconnect
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* QR Dialog */}
      {showQrDialog && state !== 'connected' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowQrDialog(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Scan QR Code</h3>
              <button onClick={() => setShowQrDialog(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            {qrDataUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR" className="w-full aspect-square rounded-lg border border-slate-200" />
                <p className="text-[11px] text-slate-500 text-center">WhatsApp → Linked Devices → Scan</p>
                <Button size="sm" variant="outline" onClick={handleRefreshQr} isLoading={actionLoading}
                  className="w-full gap-1.5 text-xs h-8">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh QR
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 gap-3">
                <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />
                <p className="text-xs text-slate-500">Waiting for QR…</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings — only when connected */}
      {state === 'connected' && settings && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-900">Auto-Send on Save</span>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Sale Invoice</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Sends invoice when a new sale is saved.</p>
                </div>
                <Toggle checked={settings.auto_send_sale} onChange={(v) => saveField({ auto_send_sale: v })} disabled={saving} />
              </div>
              <div className="border-t border-slate-100" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Proforma / Quotation</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Sends quotation when a new proforma is saved.</p>
                </div>
                <Toggle checked={settings.auto_send_proforma} onChange={(v) => saveField({ auto_send_proforma: v })} disabled={saving} />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2.5">
                <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <p className="text-[10px] text-slate-500">If the customer has no phone number, auto-send is skipped.</p>
              </div>
            </div>
          </div>

          <TemplateEditor label="Sale Invoice Template" value={saleText} onChange={setSaleText}
            onSave={() => { saveField({ sale_message_template: saleText }); success('Saved', 'Sale template updated.'); }}
            isSaving={saving} />

          <TemplateEditor label="Proforma / Quotation Template" value={proformaText} onChange={setProformaText}
            onSave={() => { saveField({ proforma_message_template: proformaText }); success('Saved', 'Proforma template updated.'); }}
            isSaving={saving} />
        </>
      )}
    </div>
  );
}
