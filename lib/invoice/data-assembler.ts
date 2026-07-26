/**
 * Invoice data assembler — server-only.
 *
 * Fetches all required data from Supabase and assembles a complete
 * InvoiceData object, ready for PDF rendering.
 *
 * Replaces the duplicated client-side `getInvoiceData()` functions
 * scattered across app/sales/[id]/page.tsx, app/purchases/[id]/page.tsx,
 * and app/proformas/[id]/page.tsx.
 */
import { createClient } from '@supabase/supabase-js';
import type { InvoiceData, InvoiceType, TemplateVariant } from './types';

// Server-side Supabase client (service role for full access)
function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

const DEFAULT_TEMPLATE: TemplateVariant = 'prestige';

// ── Sale ────────────────────────────────────────────────────────────────────

async function assembleSaleData(id: string): Promise<InvoiceData> {
  const supabase = getServerSupabase();

  const [
    { data: sale, error: sErr },
    { data: saleItems, error: siErr },
    { data: tradeIns },
    { data: store },
  ] = await Promise.all([
    supabase.from('sales').select('*, parties (name, number, address)').eq('id', id).single(),
    supabase.from('sale_items').select('sold_price, inventory_item_id, inventory_items (brand, model, imei, ram_rom, color, base_selling_price)').eq('sale_id', id),
    supabase.from('trade_ins').select('*').eq('sale_id', id),
    supabase.from('store').select('*').limit(1).maybeSingle(),
  ]);

  if (sErr) throw new Error(`Failed to load sale: ${sErr.message}`);
  if (siErr) throw new Error(`Failed to load sale items: ${siErr.message}`);
  if (!sale) throw new Error(`Sale not found: ${id}`);

  const template = await getTemplate(store, 'sale');

  const additionalDiscount = Number(sale.discount) || 0;
  const mappedItems = (saleItems || []).map((line: any) => {
    const basePrice = Number(line.inventory_items?.base_selling_price) || Number(line.sold_price) || 0;
    const soldPrice = Number(line.sold_price) || 0;
    const itemDiscount = Math.max(0, basePrice - soldPrice);
    return {
      ...line.inventory_items,
      qty: 1,
      rate: basePrice,
      price: basePrice,
      discount: itemDiscount,
      value: soldPrice,
    };
  });

  const itemDiscountTotal = mappedItems.reduce((s: number, i: any) => s + (i.discount || 0), 0);
  const totalDiscount = itemDiscountTotal + additionalDiscount;
  const subtotal = mappedItems.reduce((s: number, i: any) => s + (i.rate || 0), 0);

  return {
    type: 'sale',
    template,
    store,
    bill_number: sale.bill_number,
    date: sale.date,
    party: sale.parties,
    items: mappedItems,
    subtotal,
    item_discount: itemDiscountTotal,
    additional_discount: additionalDiscount,
    discount: totalDiscount,
    trade_in_credit: Number(sale.trade_in_credit),
    final_total: Number(sale.final_total),
    paid: Number(sale.paid),
    due: Number(sale.due),
    trade_ins: tradeIns || [],
  };
}

// ── Purchase ────────────────────────────────────────────────────────────────

async function assemblePurchaseData(id: string): Promise<InvoiceData> {
  const supabase = getServerSupabase();

  const [
    { data: purchase, error: pErr },
    { data: purchaseItems, error: piErr },
    { data: store },
  ] = await Promise.all([
    supabase.from('purchases').select('*, parties (name, number, address)').eq('id', id).single(),
    supabase.from('purchase_items').select('inventory_items (brand, model, imei, ram_rom, color, purchase_price)').eq('purchase_id', id),
    supabase.from('store').select('*').limit(1).maybeSingle(),
  ]);

  if (pErr) throw new Error(`Failed to load purchase: ${pErr.message}`);
  if (piErr) throw new Error(`Failed to load purchase items: ${piErr.message}`);
  if (!purchase) throw new Error(`Purchase not found: ${id}`);

  const template = await getTemplate(store, 'purchase');
  const items = (purchaseItems || []).map((d: any) => d.inventory_items);

  return {
    type: 'purchase',
    template,
    store,
    bill_number: purchase.bill_number,
    date: purchase.date,
    party: purchase.parties,
    items: items.map((item: any) => ({ ...item, price: Number(item.purchase_price) })),
    subtotal: Number(purchase.total),
    final_total: Number(purchase.total),
    paid: Number(purchase.paid),
    due: Number(purchase.due),
  };
}

// ── Proforma ────────────────────────────────────────────────────────────────

async function assembleProformaData(id: string): Promise<InvoiceData> {
  const supabase = getServerSupabase();

  const [
    { data: proforma, error: pfErr },
    { data: pfItems, error: pfIErr },
    { data: store },
  ] = await Promise.all([
    supabase.from('proforma_invoices').select('*, parties (id, name, number, address)').eq('id', id).single(),
    supabase.from('proforma_invoice_items').select('*').eq('proforma_invoice_id', id),
    supabase.from('store').select('*').limit(1).maybeSingle(),
  ]);

  if (pfErr) throw new Error(`Failed to load proforma: ${pfErr.message}`);
  if (pfIErr) throw new Error(`Failed to load proforma items: ${pfIErr.message}`);
  if (!proforma) throw new Error(`Proforma not found: ${id}`);

  const template = await getTemplate(store, 'proforma');

  let pfTradeIns: any[] = [];
  try {
    const { data: tData } = await supabase.from('proforma_trade_ins').select('*').eq('proforma_invoice_id', id);
    if (tData) pfTradeIns = tData;
  } catch {
    // ignore
  }

  const items = (pfItems || []).map((line: any) => ({
    description: line.description,
    qty: Number(line.qty),
    rate: Number(line.rate),
    discount: Number(line.discount || 0),
    value: Number(line.value),
  }));

  return {
    type: 'proforma',
    template,
    store,
    bill_number: proforma.bill_number,
    date: proforma.date,
    party: proforma.parties,
    items: items as any,
    subtotal: Number(proforma.total),
    item_discount: items.reduce((sum: number, line: any) => sum + (Number(line.discount) || 0), 0),
    additional_discount: Number(proforma.discount),
    discount: items.reduce((sum: number, line: any) => sum + (Number(line.discount) || 0), 0) + (Number(proforma.discount) || 0),
    trade_in_credit: Number(proforma.trade_in_credit || 0),
    final_total: Number(proforma.final_total),
    paid: 0,
    due: Number(proforma.final_total),
    trade_ins: pfTradeIns.map((ti: any) => ({
      description: ti.description,
      qty: Number(ti.qty),
      rate: Number(ti.rate),
      value: Number(ti.value),
    })),
  };
}

// ── Template helper ─────────────────────────────────────────────────────────

async function getTemplate(store: any, type: InvoiceType): Promise<TemplateVariant> {
  if (!store?.invoice_templates) return DEFAULT_TEMPLATE;
  const templates = store.invoice_templates as Record<string, string>;
  return (templates[type] as TemplateVariant) || DEFAULT_TEMPLATE;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch and assemble complete InvoiceData from the database.
 *
 * This is the single server-side implementation that replaces all three
 * client-side getInvoiceData() functions.
 */
export async function getInvoiceDataFromDb(
  id: string,
  type: InvoiceType,
): Promise<InvoiceData> {
  switch (type) {
    case 'sale':     return assembleSaleData(id);
    case 'purchase': return assemblePurchaseData(id);
    case 'proforma': return assembleProformaData(id);
    default:
      throw new Error(`Unknown invoice type: ${type}`);
  }
}
