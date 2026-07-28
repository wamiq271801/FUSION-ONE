/**
 * Accounts — data queries.
 * Extracted from app/accounts/page.tsx.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FinancialYear } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AccountBankAccount {
  id: string;
  name: string;
  is_cash: boolean;
}

export interface AccountPaymentMode {
  id: string;
  bank_account_id: string;
  name: string;
}

export interface AccountTransaction {
  bank_account_id: string;
  type: 'credit' | 'debit';
  amount: number;
}

export interface TransactionRow {
  id: string;
  bank_account_id: string;
  type: 'credit' | 'debit';
  amount: number;
  date: string;
  reference_type: string;
  reference_id: string;
  notes: string | null;
  transfer_group_id: string | null;
  created_at: string;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const accountKeys = {
  page:    (fyId: string)                          => ['accounts-page',  fyId]                    as const,
  history: (accountId: string, fyId: string)       => ['account-history', accountId, fyId]         as const,
};

// ── Page data ─────────────────────────────────────────────────────────────────

export function useAccountsPageData(selectedYear: FinancialYear | null, fyLoading: boolean) {
  return useQuery({
    queryKey: accountKeys.page(selectedYear?.id ?? ''),
    enabled:  !fyLoading && !!selectedYear,
    queryFn:  async () => {
      if (!selectedYear) return {
        accounts: [] as AccountBankAccount[],
        paymentModes: [] as AccountPaymentMode[],
        transactions: [] as AccountTransaction[],
      };
      const [
        { data: accData,  error: accErr  },
        { data: modeData, error: modeErr },
        { data: txData,   error: txErr   },
      ] = await Promise.all([
        supabase.from('bank_accounts').select('id, name, is_cash').order('is_cash', { ascending: false }).order('name', { ascending: true }),
        supabase.from('payment_modes').select('id, bank_account_id, name').order('name', { ascending: true }),
        supabase.from('account_transactions').select('bank_account_id, type, amount').eq('financial_year_id', selectedYear.id),
      ]);
      if (accErr) throw accErr;
      if (modeErr) throw modeErr;
      if (txErr) throw txErr;
      return {
        accounts:      (accData  || []) as AccountBankAccount[],
        paymentModes:  (modeData || []) as AccountPaymentMode[],
        transactions:  (txData   || []) as AccountTransaction[],
      };
    },
  });
}

// ── Transaction history (per-account) ────────────────────────────────────────

export function useAccountHistory(
  accountId: string | null,
  selectedYear: FinancialYear | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: accountKeys.history(accountId ?? '', selectedYear?.id ?? ''),
    enabled:  enabled && !!accountId && !!selectedYear,
    queryFn:  async () => {
      if (!accountId || !selectedYear) return [] as TransactionRow[];
      const res = await fetch(
        `/api/accounts/transactions?bank_account_id=${accountId}&financial_year_id=${selectedYear.id}`,
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const data = await res.json();
      return data.transactions as TransactionRow[];
    },
  });
}

// ── Balance computation helper ────────────────────────────────────────────────

export function computeBalances(
  accounts: AccountBankAccount[],
  transactions: AccountTransaction[],
): Record<string, number> {
  const m: Record<string, number> = {};
  accounts.forEach(a => (m[a.id] = 0));
  transactions.forEach(tx => {
    const amt = Number(tx.amount);
    m[tx.bank_account_id] = (m[tx.bank_account_id] || 0) + (tx.type === 'credit' ? amt : -amt);
  });
  return m;
}

// ── Transaction label / color helpers ────────────────────────────────────────

export function getTransactionLabel(refType: string, txType: 'credit' | 'debit'): string {
  switch (refType) {
    case 'sale':             return 'Sale Receipt';
    case 'purchase':         return 'Purchase Payment';
    case 'payment_in':       return 'Payment Received';
    case 'payment_out':      return 'Payment Paid';
    case 'add_funds':        return 'Funds Added';
    case 'transfer':         return txType === 'debit' ? 'Transfer Out' : 'Transfer In';
    case 'opening_balance':  return 'Opening Balance';
    default:                 return refType;
  }
}

export function getTransactionColor(_refType: string, txType: 'credit' | 'debit') {
  if (txType === 'credit')
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' };
  return { bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700' };
}

// ── Invalidation ──────────────────────────────────────────────────────────────

export function useAccountsInvalidation() {
  const queryClient = useQueryClient();
  return (fyId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['accounts-page', fyId] }),
      queryClient.invalidateQueries({ queryKey: ['account-history'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}
