'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RefreshCw } from 'lucide-react';
import type { InvoiceData } from '@/domains/invoice/types';
import { getDeliverySettings, resolveDeliveryMessage } from '@/domains/invoice/delivery';
import { useToast } from '@/components/ui/Toast';

const normalizePhone = (value: string) => value.replace(/[^\d]/g, '');

export function InvoiceWhatsAppShare({ data }: { data: InvoiceData }) {
  const { success, error } = useToast();
  const [isSending, setIsSending] = useState(false);
  const deliveryType = data.type === 'proforma' ? 'proforma' : 'sale';
  const caption = useMemo(
    () => resolveDeliveryMessage(data, getDeliverySettings()[deliveryType].template),
    [data, deliveryType],
  );
  const autoSendHandled = useRef(false);

  const send = useCallback(async () => {
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

    const autoSendKey = 'fusion-one.whatsapp-auto-send';
    if (sessionStorage.getItem(autoSendKey) !== `${deliveryType}:${data.bill_number}`) return;

    // Consume the post-save request before sending so a re-render cannot deliver twice.
    autoSendHandled.current = true;
    sessionStorage.removeItem(autoSendKey);
    void send();
  }, [data.bill_number, deliveryType, send]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">WhatsApp</p>
      <button
        type="button"
        onClick={send}
        disabled={isSending}
        className="flex w-full items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
        {isSending ? 'Sending…' : 'Send via WhatsApp'}
      </button>
    </div>
  );
}
