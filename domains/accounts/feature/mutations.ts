/**
 * Accounts — mutations.
 * All Supabase writes for the accounts feature.
 */
import { supabase } from '@/lib/supabase';

// ── Bank account CRUD ─────────────────────────────────────────────────────────

export async function createBankAccount(name: string): Promise<void> {
  const { error } = await supabase.from('bank_accounts').insert({ name, is_cash: false });
  if (error) throw error;
}

export async function updateBankAccount(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('bank_accounts').update({ name }).eq('id', id);
  if (error) throw error;
}

// ── Payment mode CRUD ─────────────────────────────────────────────────────────

export async function createPaymentMode(bankAccountId: string, name: string): Promise<void> {
  const { error } = await supabase.from('payment_modes').insert({ bank_account_id: bankAccountId, name });
  if (error) throw error;
}

export async function deletePaymentMode(id: string): Promise<void> {
  const { error } = await supabase.from('payment_modes').delete().eq('id', id);
  if (error) throw error;
}

// ── Date clamping helper (shared by add-funds and transfer forms) ──────────────

export function clampToFinancialYear(fy: { start_date: string; end_date: string }): string {
  const today = new Date().toISOString().split('T')[0];
  if (today < fy.start_date) return fy.start_date;
  if (today > fy.end_date)   return fy.end_date;
  return today;
}

export function formatINR(val: number): string {
  return Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}
