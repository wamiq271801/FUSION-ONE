'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RefreshCw } from 'lucide-react';
import type { InvoiceData } from '@/domains/invoice/types';
import { resolveDeliveryMessage } from '@/domains/invoice/delivery';
import { useWhatsAppDeliverySettings } from '@/hooks/useWhatsAppDeliverySettings';
import { useToast } from '@/components/ui/Toast';

const normalizePhone = (value: string) => value.replace(/[^\d]/g, '');

export function InvoiceWhatsAppShare({ data }: { data: InvoiceData }) {
  const { success, error } = useToast();
  const [isSending, setIsSending] = useState(false);
  // All three invoice types (sale / purchase / proforma) are deliverable and
  // share the same engine pipeline; the type only selects the message template.
  // The template always comes from Supabase — never from a hardcoded default.
  const { settings, isLoading } = useWhatsAppDeliverySettings();
  const deliveryType = data.type;
  const caption = useMemo(
    () => (settings[deliveryType].template ? resolveDeliveryMessage(data, settings[deliveryType].template) : null),
    [data, settings, deliveryType],
  );
  const autoSendHandled = useRef(false);

  const send = useCallback(async () => {
    if (!caption) {
      error('WhatsApp unavailable', 'No message template is configured for this document. Please set one in Settings → WhatsApp Delivery.');
      return;
    }
    const to = normalizePhone(data.party?.number || '');
    if (!/^\d{8,15}$/.test(to)) {
      error('WhatsApp unavailable', 'The customer does not have a valid phone number.');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/invoice/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice: data, to, caption }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send invoice');
      success('Invoice sent', `Invoice ${data.bill_number} was sent on WhatsApp.`);
    } catch (cause) {
      error('WhatsApp send failed', cause instanceof Error ? cause.message : 'Unable to send invoice');
    } finally {
      setIsSending(false);
    }
  }, [caption, data, error, success]);

  useEffect(() => {
    if (autoSendHandled.current) return;
    // Wait for the Supabase template to load before auto-sending so the
    // rendered caption (and any missing-template error) is based on the DB.
    if (isLoading) return;

    const autoSendKey = 'fusion-one.whatsapp-auto-send';
    if (sessionStorage.getItem(autoSendKey) !== `${deliveryType}:${data.bill_number}`) return;

    // Consume the post-save request before sending so a re-render cannot deliver twice.
    autoSendHandled.current = true;
    sessionStorage.removeItem(autoSendKey);
    void send();
  }, [data.bill_number, deliveryType, send, isLoading]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
      <p className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">WhatsApp</p>
      <button
        type="button"
        onClick={send}
        disabled={isSending || isLoading}
        className="flex w-full items-center gap-2.5 rounded-md bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSending ? <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5 shrink-0" />}
        {isSending ? 'Sending…' : 'Send via WhatsApp'}
      </button>
    </div>
  );
}

