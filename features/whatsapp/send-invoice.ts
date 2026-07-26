/**
 * Invoice Send Orchestrator — server-only.
 *
 * Thin bridge between the centralized invoice module and the WhatsApp transport.
 * Flow: InvoiceData → renderPng (HTML-based) → build caption → send via backend
 */
import { renderPng }                             from '@/lib/invoice/renderers/png';
import { getStatusFromBackend, sendImageWithRetry } from './service';
import { formatMessage, buildItemList }           from './utils';
import type { InvoiceData }                       from '@/lib/invoice/types';

export interface SendInvoiceParams {
  invoiceData:     InvoiceData;
  phone:           string;
  messageTemplate: string;
}

export async function sendInvoice(params: SendInvoiceParams): Promise<void> {
  const { state } = await getStatusFromBackend();
  if (state !== 'READY') {
    throw Object.assign(new Error('WhatsApp is not connected'), { status: 503 });
  }

  const { invoiceData, phone, messageTemplate } = params;

  const caption = formatMessage(messageTemplate, {
    bill_number:     invoiceData.bill_number,
    customer_name:   invoiceData.party?.name   ?? '',
    customer_phone:  phone,
    store_name:      invoiceData.store?.name   ?? '',
    item_list:       buildItemList(invoiceData),
    final_total:     invoiceData.final_total,
    paid:            invoiceData.paid,
    due:             invoiceData.due,
    date:            invoiceData.date,
    trade_in_credit: invoiceData.trade_in_credit,
    discount:        invoiceData.discount,
  });

  const imageBuffer = await renderPng(invoiceData);
  await sendImageWithRetry(phone, imageBuffer, caption, 'image/png');
}
