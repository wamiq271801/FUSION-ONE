/**
 * Purchases — mutations.
 */
import { supabase } from '@/lib/supabase';
import type { FinancialYear } from '@/types';

// ── Create purchase ──────────────────────────────────────────────────────────

export interface CreatePurchaseItem {
  brand: string;
  model: string;
  imei: string;
  ram_rom: string;
  color: string;
  purchase_price: string;
  base_selling_price: string;
}

export interface CreatePurchaseParams {
  partyId: string;
  date: string;
  items: CreatePurchaseItem[];
  total: number;
  paid: number;
  due: number;
  bankAccountId: string;
  paymentModeId: string;
  financialYear: FinancialYear;
}

export interface CreatePurchaseResult {
  purchaseId: string;
  billNumber: string;
}

export async function createPurchase(params: CreatePurchaseParams): Promise<CreatePurchaseResult> {
  const {
    partyId, date, items, total, paid, due,
    bankAccountId, paymentModeId, financialYear,
  } = params;

  // 1. Check for duplicate IMEI in DB
  const uniqueImeis = items.map(i => i.imei.trim());
  const { data: dupCheck, error: dupErr } = await supabase
    .from('inventory_items')
    .select('imei')
    .in('imei', uniqueImeis)
    .eq('status', 'in_stock');

  if (dupErr) throw dupErr;
  if (dupCheck && dupCheck.length > 0) {
    throw new Error(`IMEI ${dupCheck[0].imei} is already in stock in the database.`);
  }

  // 2. Get and increment counter
  const { data: fyData, error: fyErr } = await supabase
    .from('financial_years')
    .select('start_date, end_date, purchase_counter')
    .eq('id', financialYear.id)
    .single();
  if (fyErr) throw fyErr;

  const currentCounter = fyData.purchase_counter;
  const nextCounter = currentCounter + 1;
  const sYear = new Date(fyData.start_date).getFullYear();
  const eYear = new Date(fyData.end_date).getFullYear().toString().slice(-2);
  const billNumber = `PUR-${sYear}-${eYear}-${nextCounter.toString().padStart(4, '0')}`;

  const { error: updFyErr } = await supabase
    .from('financial_years')
    .update({ purchase_counter: nextCounter })
    .eq('id', financialYear.id);
  if (updFyErr) throw updFyErr;

  // 3. Create purchase
  const { data: purchaseData, error: purchaseErr } = await supabase
    .from('purchases')
    .insert({
      bill_number: billNumber,
      party_id: partyId,
      total,
      paid,
      due,
      bank_account_id: bankAccountId,
      payment_mode_id: paymentModeId || null,
      date,
      financial_year_id: financialYear.id,
      status: 'active',
    })
    .select('id')
    .single();
  if (purchaseErr) throw purchaseErr;

  // 4. Create inventory items
  const preparedItems = items.map(item => ({
    brand: item.brand.trim(),
    model: item.model.trim(),
    imei: item.imei.trim(),
    ram_rom: item.ram_rom.trim(),
    color: item.color.trim(),
    purchase_price: Number(item.purchase_price),
    base_selling_price: Number(item.base_selling_price),
    status: 'in_stock' as const,
    source: 'purchase' as const,
    financial_year_id: financialYear.id,
    opening_entry_type: 'direct' as const,
  }));

  const { data: addedItemsData, error: invErr } = await supabase
    .from('inventory_items')
    .insert(preparedItems)
    .select('id');
  if (invErr) throw invErr;

  // 5. Create purchase_items mappings
  const purchaseItemsData = addedItemsData.map(ai => ({
    purchase_id: purchaseData.id,
    inventory_item_id: ai.id,
  }));

  const { error: piErr } = await supabase
    .from('purchase_items')
    .insert(purchaseItemsData);
  if (piErr) throw piErr;

  // 6. Handle Payment transactions
  if (paid > 0) {
    const { error: atErr } = await supabase
      .from('account_transactions')
      .insert({
        bank_account_id: bankAccountId,
        payment_mode_id: paymentModeId || null,
        type: 'debit',
        amount: paid,
        date,
        reference_type: 'purchase',
        reference_id: purchaseData.id,
        financial_year_id: financialYear.id,
      });
    if (atErr) throw atErr;

    const { error: poErr } = await supabase
      .from('payments_out')
      .insert({
        purchase_id: purchaseData.id,
        party_id: partyId,
        amount: paid,
        bank_account_id: bankAccountId,
        payment_mode_id: paymentModeId || null,
        date,
        financial_year_id: financialYear.id,
      });
    if (poErr) throw poErr;
  }

  return { purchaseId: purchaseData.id, billNumber };
}

// ── Pay existing purchase ────────────────────────────────────────────────────

export interface PayPurchaseParams {
  purchaseId:    string;
  partyId:       string;
  currentPaid:   number;
  currentDue:    number;
  amount:        number;
  date:          string;
  bankAccountId: string;
  paymentModeId: string | null;
  financialYear: FinancialYear;
}

export async function payPurchase(params: PayPurchaseParams): Promise<void> {
  const {
    purchaseId, partyId, currentPaid, currentDue,
    amount, date, bankAccountId, paymentModeId, financialYear,
  } = params;

  const { error: updErr } = await supabase
    .from('purchases')
    .update({ paid: currentPaid + amount, due: currentDue - amount })
    .eq('id', purchaseId);
  if (updErr) throw updErr;

  const { data: poData, error: poErr } = await supabase
    .from('payments_out')
    .insert({
      purchase_id:       purchaseId,
      party_id:          partyId,
      amount,
      bank_account_id:   bankAccountId,
      payment_mode_id:   paymentModeId || null,
      date,
      financial_year_id: financialYear.id,
    })
    .select('id')
    .single();
  if (poErr) throw poErr;

  const { error: atErr } = await supabase
    .from('account_transactions')
    .insert({
      bank_account_id:   bankAccountId,
      payment_mode_id:   paymentModeId || null,
      type:              'debit',
      amount,
      date,
      reference_type:    'payment_out',
      reference_id:      poData.id,
      financial_year_id: financialYear.id,
    });
  if (atErr) throw atErr;
}
