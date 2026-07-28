/**
 * Sales — mutations.
 *
 * Each mutation is a standalone async function to keep them testable
 * and importable without coupling to React component state.
 */
import { supabase } from '@/lib/supabase';
import type { FinancialYear } from '@/types';

// ── Create sale ──────────────────────────────────────────────────────────────

export interface CreateSaleItem {
  id: string;
  sold_price: string;
}

export interface CreateTradeIn {
  id: string;
  brand: string;
  model: string;
  imei: string;
  ram_rom: string;
  color: string;
  credit_value: string;
  mrp: string;
  file?: File | null;
}

export interface CreateSaleParams {
  partyId: string;
  date: string;
  selectedItems: CreateSaleItem[];
  tradeIns: CreateTradeIn[];
  discount: number;
  subtotal: number;
  totalTradeInCredit: number;
  finalTotal: number;
  paid: number;
  due: number;
  bankAccountId: string;
  paymentModeId: string;
  financialYear: FinancialYear;
}

export interface CreateSaleResult {
  saleId: string;
  billNumber: string;
}

export async function createSale(params: CreateSaleParams): Promise<CreateSaleResult> {
  const {
    partyId, date, selectedItems, tradeIns,
    discount, subtotal, totalTradeInCredit, finalTotal,
    paid, due, bankAccountId, paymentModeId, financialYear,
  } = params;

  // 1. Verify all selected items are still in stock
  const itemIds = selectedItems.map(i => i.id);
  const { data: checkStock, error: chkErr } = await supabase
    .from('inventory_items')
    .select('id')
    .in('id', itemIds)
    .eq('status', 'in_stock');

  if (chkErr) throw chkErr;
  if (checkStock.length !== selectedItems.length) {
    throw new Error('One or more selected items are no longer available in stock.');
  }

  // 2. Verify Trade-in IMEIs are not globally in stock
  const tiImeis = tradeIns.map(t => t.imei);
  if (tiImeis.length > 0) {
    const { data: tiDups } = await supabase
      .from('inventory_items')
      .select('imei')
      .in('imei', tiImeis)
      .eq('status', 'in_stock');
    if (tiDups && tiDups.length > 0) {
      throw new Error(`Trade-In IMEI ${tiDups[0].imei} already in stock in the system.`);
    }
  }

  // 3. Counters
  const { data: fyData, error: fyErr } = await supabase
    .from('financial_years')
    .select('sale_counter, purchase_counter, start_date, end_date')
    .eq('id', financialYear.id)
    .single();
  if (fyErr) throw fyErr;

  const currentSaleCounter = fyData.sale_counter;
  const currentPurchaseCounter = fyData.purchase_counter;

  const sYearStr = new Date(fyData.start_date).getFullYear();
  const eYearStr = new Date(fyData.end_date).getFullYear().toString().slice(-2);
  const saleBillNo = `SAL-${sYearStr}-${eYearStr}-${(currentSaleCounter + 1).toString().padStart(4, '0')}`;

  // 4. Update Counters
  await supabase.from('financial_years').update({
    sale_counter: currentSaleCounter + 1,
    purchase_counter: currentPurchaseCounter + tradeIns.length,
  }).eq('id', financialYear.id);

  // 5. Create Sale Record
  const { data: saleData, error: saleErr } = await supabase.from('sales').insert({
    bill_number: saleBillNo,
    party_id: partyId,
    total: subtotal,
    discount,
    trade_in_credit: totalTradeInCredit,
    final_total: finalTotal,
    paid,
    due,
    bank_account_id: bankAccountId,
    payment_mode_id: paymentModeId || null,
    date,
    financial_year_id: financialYear.id,
    status: 'active',
  }).select('id').single();
  if (saleErr) throw saleErr;

  // 6. Sale Items
  const saleItemsInsert = selectedItems.map(item => ({
    sale_id: saleData.id,
    inventory_item_id: item.id,
    sold_price: Number(item.sold_price),
  }));
  await supabase.from('sale_items').insert(saleItemsInsert);

  // 7. Update Inventory to Sold
  await supabase.from('inventory_items').update({ status: 'sold' }).in('id', itemIds);

  // 8. Process Trade-Ins
  for (let i = 0; i < tradeIns.length; i++) {
    const ti = tradeIns[i];

    // Purchase
    const pNum = currentPurchaseCounter + 1 + i;
    const pBillNo = `PUR-TRD-${sYearStr}-${eYearStr}-${pNum.toString().padStart(4, '0')}`;

    const { data: purData, error: purErr } = await supabase.from('purchases').insert({
      bill_number: pBillNo,
      party_id: partyId,
      total: Number(ti.credit_value),
      paid: Number(ti.credit_value),
      due: 0,
      bank_account_id: bankAccountId,
      date,
      financial_year_id: financialYear.id,
      status: 'active',
    }).select().single();
    if (purErr) throw purErr;

    // Inventory
    const { data: invData, error: invErr } = await supabase.from('inventory_items').insert({
      brand: ti.brand,
      model: ti.model,
      imei: ti.imei,
      ram_rom: ti.ram_rom,
      color: ti.color,
      purchase_price: Number(ti.credit_value),
      base_selling_price: Number(ti.credit_value),
      status: 'in_stock',
      source: 'trade_in',
      financial_year_id: financialYear.id,
      opening_entry_type: 'direct',
    }).select().single();
    if (invErr) throw invErr;

    // Purchase Items
    await supabase.from('purchase_items').insert({
      purchase_id: purData.id,
      inventory_item_id: invData.id,
    });

    // Trade-ins Map
    let documentUrl = null;
    if (ti.file) {
      try {
        const ext = ti.file.name.split('.').pop();
        const fileName = `trade_in_${Date.now()}.${ext}`;
        const { data: uploadData } = await supabase.storage.from('documents').upload(`trade_ins/${fileName}`, ti.file);
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(`trade_ins/${fileName}`);
          documentUrl = urlData.publicUrl;
        }
      } catch (e) {
        console.warn('Storage error', e);
      }
    }

    await supabase.from('trade_ins').insert({
      sale_id: saleData.id,
      brand: ti.brand,
      model: ti.model,
      imei: ti.imei,
      ram_rom: ti.ram_rom,
      color: ti.color,
      credit_value: Number(ti.credit_value),
      mrp: Number(ti.mrp) || null,
      document_url: documentUrl,
      new_inventory_item_id: invData.id,
    });
  }

  // 9. Account Transaction (Sale Payment)
  if (paid > 0) {
    await supabase.from('account_transactions').insert({
      bank_account_id: bankAccountId,
      payment_mode_id: paymentModeId || null,
      type: 'credit',
      amount: paid,
      date,
      reference_type: 'sale',
      reference_id: saleData.id,
      financial_year_id: financialYear.id,
    });

    // Also create payments_in record for payment history
    const { error: piErr } = await supabase
      .from('payments_in')
      .insert({
        sale_id: saleData.id,
        party_id: partyId,
        amount: paid,
        bank_account_id: bankAccountId,
        payment_mode_id: paymentModeId || null,
        date,
        financial_year_id: financialYear.id,
      });
    if (piErr) throw piErr;
  }

  return { saleId: saleData.id, billNumber: saleBillNo };
}

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
