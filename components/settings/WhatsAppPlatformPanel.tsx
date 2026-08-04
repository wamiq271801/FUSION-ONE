'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, LogOut, MessageCircle, RefreshCw, Smartphone, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useWhatsAppPlatform } from '@/hooks/useWhatsAppPlatform';
import QRCode from 'qrcode';

/**
 * WhatsApp Platform Panel — purely event-driven.
 *
 * All state comes from the engine via SSE (useWhatsAppPlatform hook).
 * The panel NEVER polls, NEVER sets intervals, NEVER manually refreshes,
 * and NEVER touches the WhatsApp transport (no _getClient, no Puppeteer).
 *
 * When NOT authenticated: shows Status + QR (pushed by the engine).
 * When authenticated: shows Connected, Device information, Engine state,
 * Queue information, and Logout.
 * When error/disconnected: shows the error and a Restart button.
 */
export function WhatsAppPlatformPanel() {
    const { success, error } = useToast();
    const snap = useWhatsAppPlatform();
    const [busy, setBusy] = useState(false);

    // The only lifecycle controls: restart (on error/disconnect) and logout (when connected).
    // These call engine lifecycle methods — they are NOT manual refresh/connect.
    const restart = async () => {
        setBusy(true);
        try {
            await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restart' }),
            });
            // The engine will push the new state via SSE — no manual refresh needed.
        } catch (cause) {
            error('Restart failed', cause instanceof Error ? cause.message : undefined);
        } finally {
            setBusy(false);
        }
    };

    const logout = async () => {
        setBusy(true);
        try {
            await fetch('/api/whatsapp', { method: 'DELETE' });
            success('Logged out', 'The saved WhatsApp session was removed.');
            // The engine will push the new state via SSE.
        } catch {
            error('Logout failed');
        } finally {
            setBusy(false);
        }
    };

    const connected = snap?.engine === 'READY';
    const showQr = snap?.qr != null && (snap!.engine === 'AUTHENTICATING' || snap!.engine === 'INITIALIZING');
    const hasError = snap?.engine === 'ERROR' || snap?.engine === 'DISCONNECTED';

    // The engine pushes the raw WhatsApp pairing string as snap.qr.
    // Encode it to a scannable QR image using the qrcode library.
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!snap?.qr) { setQrDataUrl(null); return; }
        let cancelled = false;
        QRCode.toDataURL(snap.qr, { width: 512, margin: 2, errorCorrectionLevel: 'M' })
            .then((url: string) => { if (!cancelled) setQrDataUrl(url); })
            .catch(() => { if (!cancelled) setQrDataUrl(null); });
        return () => { cancelled = true; };
    }, [snap?.qr]);

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-sm font-semibold text-slate-900">WhatsApp Account</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Engine state is pushed live — no manual refresh needed.</p>
            </div>

            {/* Connection status — entirely driven by engine SSE */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-3.5 w-3.5 text-indigo-600" />
                        <span className="text-xs font-semibold text-slate-900">Connection</span>
                    </div>
                    <span className={connected
                        ? 'rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700'
                        : 'rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700'
                    }>
                        {snap?.engine ?? '—'}
                    </span>
                </div>

                <div className="p-5">
                    {/* QR code — shown when engine pushes it */}
                    {showQr ? (
                        <div className="flex flex-col items-center gap-3">
                            <img src={qrDataUrl ?? undefined} alt="WhatsApp pairing QR" className="h-56 w-56 rounded-lg border border-slate-200 p-2" />
                            <p className="text-[11px] text-slate-500">Scan this code in WhatsApp → Settings → Linked Devices.</p>
                        </div>
                    ) : connected ? (
                        /* Connected — show device info from engine snapshot */
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100 flex items-center justify-center">
                                <Smartphone className="h-5 w-5 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-900">{snap?.account?.pushname || 'WhatsApp account'}</p>
                                <p className="text-[11px] text-slate-500">{snap?.account?.wid ?? ''}</p>
                            </div>
                            <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-500" />
                        </div>
                    ) : (
                        /* Disconnected / initializing / error */
                        <div className="text-center py-4">
                            <Smartphone className="mx-auto h-7 w-7 text-slate-300" />
                            <p className="mt-2 text-xs text-slate-500">
                                {snap?.engine === 'INITIALIZING' ? 'Starting WhatsApp engine…' :
                                 snap?.engine === 'DISCONNECTED' ? 'WhatsApp disconnected. Click restart to reconnect.' :
                                 snap?.engine === 'ERROR' ? 'Engine error. Click restart to retry.' :
                                 'Engine stopped. Click restart to start.'}
                            </p>
                        </div>
                    )}
                    {snap?.lastError && (
                        <p className="mt-3 flex items-center gap-1 text-[11px] text-rose-600">
                            <TriangleAlert className="h-3 w-3" />{snap.lastError}
                        </p>
                    )}
                </div>

                {/* Only show restart (on error/disconnect) or logout (when connected) */}
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                    {hasError || !connected ? (
                        <Button size="sm" onClick={restart} disabled={busy} className="gap-1.5 text-xs">
                            <RefreshCw className={busy ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />Restart Engine
                        </Button>
                    ) : null}
                    {connected ? (
                        <Button size="sm" variant="outline" onClick={logout} disabled={busy} className="gap-1.5 text-xs text-rose-600">
                            <LogOut className="h-3.5 w-3.5" />Logout
                        </Button>
                    ) : null}
                </div>
            </div>

            {/* Engine state — all from snapshot, no polling */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    ['Engine', snap?.engine ?? '—'],
                    ['Browser', snap?.browser ?? '—'],
                    ['Auth', snap?.auth ?? '—'],
                    ['Health', snap?.health ?? '—'],
                ].map(([title, value]) => (
                    <div key={title} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-700">{value}</p>
                    </div>
                ))}
            </div>

            {/* Queue stats — from snapshot */}
            {connected && snap?.queue && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {[
                        ['Pending', snap.queue.pending],
                        ['Processing', snap.queue.processing],
                        ['Completed', snap.queue.completed],
                        ['Failed', snap.queue.failed],
                        ['Total', snap.queue.total],
                    ].map(([title, value]) => (
                        <div key={title} className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-700">{value}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
