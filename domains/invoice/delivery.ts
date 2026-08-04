import type { InvoiceData } from './types';

export type DeliverableInvoiceType = 'sale' | 'purchase' | 'proforma';
export const isDeliverableInvoice = (type: InvoiceData['type']): type is DeliverableInvoiceType => type === 'sale' || type === 'purchase' || type === 'proforma';
export interface DeliverySettings { sale: { autoSend: boolean; template: string }; purchase: { autoSend: boolean; template: string }; proforma: { autoSend: boolean; template: string }; }
/**
 * Render a delivery message template (stored in Supabase) against invoice data.
 *
 * This is a pure renderer — it contains no template strings. The template is
 * always loaded from the database (see hooks/useWhatsAppDeliverySettings).
 * Unrecognized placeholders resolve to an empty string.
 */
export function resolveDeliveryMessage(data: InvoiceData, template: string) {
  const paymentStatus = data.type === 'proforma' ? 'Quotation' : data.due > 0 ? 'Balance due' : 'Paid';
  const values: Record<string, string> = {
    customer_name: data.party?.name || '',
    invoice_number: data.bill_number,
    invoice_date: data.date,
    company_name: data.store?.name || '',
    grand_total: Number(data.final_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    due_date: data.due > 0 ? data.date : '',
    payment_status: paymentStatus,
    company_phone: data.store?.phone || '',
    company_address: data.store?.address || '',
  };
  return template.replace(/{{\s*([a-z_]+)\s*}}/g, (_, name) => values[name] ?? '');
}
