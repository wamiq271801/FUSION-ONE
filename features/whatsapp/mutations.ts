'use client';

/**
 * WhatsApp feature — client-side mutations.
 *
 * Provides hooks for connect, disconnect, save settings, and send invoice.
 * All business logic is here; pages just call the returned handlers.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase }                    from '@/lib/supabase';
import { useAuth }                     from '@/components/auth/AuthProvider';
import { waKeys }                      from './constants';
import type { WaSettings, WaStatusResponse } from './types';
import type { SendInvoiceParams }      from './send-invoice';

// ── Connect ───────────────────────────────────────────────────────────────────

export function useWaConnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Connect failed');
      }
      return res.json();
    },
    onSuccess: () => {
      // Immediately invalidate so polling picks up the new state.
      queryClient.invalidateQueries({ queryKey: waKeys.status() });
    },
  });
}

// ── Disconnect ────────────────────────────────────────────────────────────────

export function useWaDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Disconnect failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData<WaStatusResponse>(waKeys.status(), {
        status: 'disconnected',
        state:  'DISCONNECTED',
        qr:    null,
        connectedSince: null,
        backendOnline: true,
      });
    },
  });
}

// ── Save settings (upsert) ────────────────────────────────────────────────────

export function useWaSaveSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<WaSettings>) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('whatsapp_settings')
        .upsert({ owner_user_id: user.id, ...patch }, { onConflict: 'owner_user_id' });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: waKeys.settings() });
      const prev = queryClient.getQueryData<WaSettings>(waKeys.settings());
      if (prev) {
        queryClient.setQueryData<WaSettings>(waKeys.settings(), { ...prev, ...patch });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(waKeys.settings(), ctx.prev);
    },
  });
}

// ── Send invoice ──────────────────────────────────────────────────────────────

export function useWaSendInvoice() {
  return useMutation({
    mutationFn: async (params: SendInvoiceParams) => {
      const res = await fetch('/api/whatsapp/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(params),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errorMsg = typeof body.error === 'object' ? body.error?.message : body.error;
        const errorCode = typeof body.error === 'object' ? body.error?.code : body.code;
        const err = new Error(errorMsg || 'Send failed');
        (err as any).code = errorCode || 'SEND_FAILED';
        throw err;
      }
      return res.json();
    },
  });
}
