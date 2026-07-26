/**
 * WhatsApp feature — pure utility functions.
 * No side effects. Safe on both server and client.
 */
import type { InvoiceData } from '@/lib/invoice/types';

// ── Message template substitution ────────────────────────────────────────────

export interface MessageVars {
  bill_number?:     string;
  customer_name?:   string;
  customer_phone?:  string;
  store_name?:      string;
  item_list?:       string;
  final_total?:     string | number;
  paid?:            string | number;
  due?:             string | number;
  date?:            string;
  trade_in_credit?: string | number;
  discount?:        string | number;
}

function fmtNum(val: string | number | undefined): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = Number(val);
  return isNaN(n) ? String(val) : n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export function formatMessage(template: string, vars: MessageVars): string {
  return template
    .replace(/{bill_number}/g,     vars.bill_number    ?? '')
    .replace(/{customer_name}/g,   vars.customer_name  ?? '')
    .replace(/{customer_phone}/g,  vars.customer_phone ?? '')
    .replace(/{store_name}/g,      vars.store_name     ?? '')
    .replace(/{item_list}/g,       vars.item_list      ?? '')
    .replace(/{final_total}/g,     fmtNum(vars.final_total))
    .replace(/{paid}/g,            fmtNum(vars.paid))
    .replace(/{due}/g,             fmtNum(vars.due))
    .replace(/{date}/g,            vars.date           ?? '')
    .replace(/{trade_in_credit}/g, fmtNum(vars.trade_in_credit))
    .replace(/{discount}/g,        fmtNum(vars.discount));
}

// ── Item list builder ─────────────────────────────────────────────────────────

export function buildItemList(data: InvoiceData): string {
  if (data.type === 'sale' || data.type === 'purchase') {
    return (data.items ?? [])
      .map((i) => `• ${i.brand} ${i.model}${i.imei ? ` (IMEI: ${i.imei})` : ''}`)
      .join('\n');
  }
  return (data.items ?? [])
    .map((i) => `• ${i.description}${i.qty && i.qty > 1 ? ` × ${i.qty}` : ''}`)
    .join('\n');
}
