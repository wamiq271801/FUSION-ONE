import type { InvoiceData } from './types';

export type DeliverableInvoiceType = 'sale' | 'proforma';
export const isDeliverableInvoice = (type: InvoiceData['type']): type is DeliverableInvoiceType => type === 'sale' || type === 'proforma';
export interface DeliverySettings { sale: { autoSend: boolean; template: string }; proforma: { autoSend: boolean; template: string }; }
export const DELIVERY_SETTINGS_KEY = 'fusion-one.whatsapp-delivery';
export const defaultDeliverySettings: DeliverySettings = {
  sale: { autoSend: false, template: 'Hello {{customer_name}},\n\nPlease find your invoice {{invoice_number}} dated {{invoice_date}} from {{company_name}} attached.\nGrand Total: {{grand_total}}\nPayment Status: {{payment_status}}' },
  proforma: { autoSend: false, template: 'Hello {{customer_name}},\n\nPlease find your quotation {{invoice_number}} dated {{invoice_date}} from {{company_name}} attached.\nGrand Total: {{grand_total}}' },
};
export function getDeliverySettings(): DeliverySettings { if (typeof window === 'undefined') return defaultDeliverySettings; try { const saved = JSON.parse(localStorage.getItem(DELIVERY_SETTINGS_KEY) || '{}'); return { sale: { ...defaultDeliverySettings.sale, ...saved.sale }, proforma: { ...defaultDeliverySettings.proforma, ...saved.proforma } }; } catch { return defaultDeliverySettings; } }
export function resolveDeliveryMessage(data: InvoiceData, template: string) { const paymentStatus = data.type === 'proforma' ? 'Quotation' : data.due > 0 ? 'Balance due' : 'Paid'; const values: Record<string, string> = { customer_name: data.party?.name || 'Customer', invoice_number: data.bill_number, invoice_date: data.date, company_name: data.store?.name || 'Fusion Gadgets', grand_total: `${Number(data.final_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rs.`, due_date: data.due > 0 ? data.date : '', payment_status: paymentStatus, company_phone: data.store?.phone || '', company_address: data.store?.address || '' }; return template.replace(/{{\s*([a-z_]+)\s*}}/g, (_, name) => values[name] ?? ''); }
