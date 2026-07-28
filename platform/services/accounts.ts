/**
 * Server — Accounts service.
 *
 * Business logic for the accounts API routes, extracted from:
 *   app/api/accounts/add-funds/route.ts
 *   app/api/accounts/transfer/route.ts
 *   app/api/accounts/transactions/route.ts
 *
 * API routes become thin wrappers that parse/validate HTTP concerns
 * and delegate here for actual data operations.
 */
import { supabaseAdmin } from '../supabase/admin';

// ── Shared FY validation ──────────────────────────────────────────────────────

async function getOpenFinancialYear(financialYearId: string, date: string) {
  const { data: fy, error: fyErr } = await supabaseAdmin
    .from('financial_years')
    .select('id, start_date, end_date, status')
    .eq('id', financialYearId)
    .single();

  if (fyErr || !fy)             throw Object.assign(new Error('Financial year not found'), { status: 404 });
  if (fy.status === 'closed')   throw Object.assign(new Error('Cannot operate on a closed financial year'), { status: 400 });
  if (date < fy.start_date || date > fy.end_date)
    throw Object.assign(new Error(`Date must be within financial year range (${fy.start_date} to ${fy.end_date})`), { status: 400 });

  return fy;
}

// ── Add Funds ─────────────────────────────────────────────────────────────────

export interface AddFundsParams {
  bank_account_id:  string;
  amount:           number;
  date:             string;
  notes?:           string | null;
  financial_year_id: string;
}

export async function addFunds(params: AddFundsParams): Promise<{ id: string }> {
  const { bank_account_id, amount, date, notes, financial_year_id } = params;

  await getOpenFinancialYear(financial_year_id, date);

  // Verify account exists
  const { data: account, error: accErr } = await supabaseAdmin
    .from('bank_accounts').select('id').eq('id', bank_account_id).single();
  if (accErr || !account) throw Object.assign(new Error('Bank account not found'), { status: 404 });

  const { data: fundEntry, error: feErr } = await supabaseAdmin
    .from('account_fund_entries')
    .insert({ bank_account_id, amount, date, notes: notes?.trim() || null, financial_year_id })
    .select('id')
    .single();
  if (feErr) throw feErr;

  const { error: atErr } = await supabaseAdmin.from('account_transactions').insert({
    bank_account_id, payment_mode_id: null, type: 'credit', amount, date,
    reference_type: 'add_funds', reference_id: fundEntry.id,
    financial_year_id, notes: notes?.trim() || null,
  });
  if (atErr) throw atErr;

  return { id: fundEntry.id };
}

// ── Transfer ──────────────────────────────────────────────────────────────────

export interface TransferParams {
  from_bank_account_id: string;
  to_bank_account_id:   string;
  amount:               number;
  date:                 string;
  notes?:               string | null;
  financial_year_id:    string;
}

export async function transferFunds(params: TransferParams): Promise<{ id: string }> {
  const { from_bank_account_id, to_bank_account_id, amount, date, notes, financial_year_id } = params;

  if (from_bank_account_id === to_bank_account_id)
    throw Object.assign(new Error('Source and destination accounts must be different'), { status: 400 });

  await getOpenFinancialYear(financial_year_id, date);

  // Verify both accounts exist
  const { data: accounts, error: accErr } = await supabaseAdmin
    .from('bank_accounts').select('id').in('id', [from_bank_account_id, to_bank_account_id]);
  if (accErr) throw accErr;
  if (!accounts || accounts.length !== 2)
    throw Object.assign(new Error('One or both bank accounts not found'), { status: 404 });

  // Check source balance
  const { data: txs, error: txErr } = await supabaseAdmin
    .from('account_transactions').select('type, amount')
    .eq('bank_account_id', from_bank_account_id).eq('financial_year_id', financial_year_id);
  if (txErr) throw txErr;

  const sourceBalance = (txs || []).reduce((bal, tx) => {
    const a = Number(tx.amount);
    return bal + (tx.type === 'credit' ? a : -a);
  }, 0);

  if (sourceBalance < amount)
    throw Object.assign(
      new Error(`Insufficient balance. Source account has ${sourceBalance.toFixed(2)} Rs. available.`),
      { status: 400 },
    );

  const { data: transfer, error: trErr } = await supabaseAdmin
    .from('account_transfers')
    .insert({ from_bank_account_id, to_bank_account_id, amount, date, notes: notes?.trim() || null, financial_year_id })
    .select('id').single();
  if (trErr) throw trErr;

  const transferGroupId = crypto.randomUUID();
  const trimmedNotes    = notes?.trim() || null;

  const { error: debitErr } = await supabaseAdmin.from('account_transactions').insert({
    bank_account_id: from_bank_account_id, payment_mode_id: null, type: 'debit', amount, date,
    reference_type: 'transfer', reference_id: transfer.id, financial_year_id,
    notes: trimmedNotes, transfer_group_id: transferGroupId,
  });
  if (debitErr) throw debitErr;

  const { error: creditErr } = await supabaseAdmin.from('account_transactions').insert({
    bank_account_id: to_bank_account_id, payment_mode_id: null, type: 'credit', amount, date,
    reference_type: 'transfer', reference_id: transfer.id, financial_year_id,
    notes: trimmedNotes, transfer_group_id: transferGroupId,
  });
  if (creditErr) throw creditErr;

  return { id: transfer.id };
}

// ── Transaction history ───────────────────────────────────────────────────────

export async function getTransactions(bankAccountId: string, financialYearId: string) {
  const { data, error } = await supabaseAdmin
    .from('account_transactions')
    .select('id, bank_account_id, payment_mode_id, type, amount, date, reference_type, reference_id, financial_year_id, notes, transfer_group_id, created_at')
    .eq('bank_account_id', bankAccountId)
    .eq('financial_year_id', financialYearId)
    .order('date',       { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
