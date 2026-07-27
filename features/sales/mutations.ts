/**
 * Sales — mutations.
 *
 * Extracted from app/sales/page.tsx.
 * Each mutation is a standalone async function to keep them testable
 * and importable without coupling to React component state.
 */
import { supabase } from '@/lib/supabase';
import type { FinancialYear } from '@/types';

// ── Receive payment (payments_in + account_transactions) ─────────────────────

export interface ReceivePaymentParams {
  saleId:        string;
  partyId:       string;
  currentPaid:   number;
  currentDue:    number;
  amount:        number;
  date:          string;
  bankAccountId: string;
  paymentModeId: string | null;
  financialYear: FinancialYear;
}

export async function receivePayment(params: ReceivePaymentParams): Promise<void> {
  const {
    saleId, partyId, currentPaid, currentDue,
    amount, date, bankAccountId, paymentModeId, financialYear,
  } = params;

  const { error: updErr } = await supabase
    .from('sales')
    .update({ paid: currentPaid + amount, due: currentDue - amount })
    .eq('id', saleId);
  if (updErr) throw updErr;

  const { data: piData, error: piErr } = await supabase
    .from('payments_in')
    .insert({
      sale_id:          saleId,
      party_id:         partyId,
      amount,
      bank_account_id:  bankAccountId,
      payment_mode_id:  paymentModeId || null,
      date,
      financial_year_id: financialYear.id,
    })
    .select('id')
    .single();
  if (piErr) throw piErr;

  const { error: atErr } = await supabase
    .from('account_transactions')
    .insert({
      bank_account_id:  bankAccountId,
      payment_mode_id:  paymentModeId || null,
      type:             'credit',
      amount,
      date,
      reference_type:   'payment_in',
      reference_id:     piData.id,
      financial_year_id: financialYear.id,
    });
  if (atErr) throw atErr;
}

// ── Cancel sale ──────────────────────────────────────────────────────────────

export interface CancelSaleParams {
  saleId:       string;
  saleItems:    { inventory_item_id?: string }[];
  tradeIns:     { new_inventory_item_id?: string }[];
  paymentsIn?:  { id: string; amount: number; bank_account_id: string }[];
  financialYear: FinancialYear;
}

export async function cancelSale(params: CancelSaleParams): Promise<void> {
  const { saleId, saleItems, tradeIns, financialYear } = params;

  // 1. Mark sale cancelled
  await supabase.from('sales').update({ status: 'cancelled' }).eq('id', saleId);

  // 2. Return sold inventory items to stock
  for (const si of saleItems) {
    if (si.inventory_item_id) {
      await supabase
        .from('inventory_items')
        .update({ status: 'in_stock' })
        .eq('id', si.inventory_item_id);
    }
  }

  // 3. Reverse payment_in entries
  const { data: paymentsIn } = await supabase
    .from('payments_in')
    .select('id, amount, bank_account_id')
    .eq('sale_id', saleId);

  const today = new Date().toISOString().split('T')[0];
  for (const pi of paymentsIn || []) {
    await supabase.from('account_transactions').insert({
      bank_account_id:   pi.bank_account_id,
      type:              'debit',
      amount:            pi.amount,
      date:              today,
      reference_type:    'sale_cancelled',
      reference_id:      saleId,
      financial_year_id: financialYear.id,
    });
  }

  // 4. Handle trade-ins — reverse linked purchase if item still in stock
  for (const ti of tradeIns) {
    if (!ti.new_inventory_item_id) continue;
    const { data: piRows } = await supabase
      .from('purchase_items')
      .select('purchase_id')
      .eq('inventory_item_id', ti.new_inventory_item_id)
      .limit(1);

    const purchaseId = piRows?.[0]?.purchase_id;

    const { data: inv } = await supabase
      .from('inventory_items')
      .select('status')
      .eq('id', ti.new_inventory_item_id)
      .single();

    if (inv?.status === 'in_stock') {
      if (purchaseId) {
        await supabase.from('purchase_items').delete().eq('purchase_id', purchaseId);
        await supabase.from('purchases').delete().eq('id', purchaseId);
      }
      await supabase.from('inventory_items').delete().eq('id', ti.new_inventory_item_id);
    } else if (purchaseId) {
      await supabase.from('purchases').update({ status: 'cancelled' }).eq('id', purchaseId);
    }
  }
}
