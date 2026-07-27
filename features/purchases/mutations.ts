/**
 * Purchases — mutations.
 */
import { supabase } from '@/lib/supabase';
import type { FinancialYear } from '@/types';

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
