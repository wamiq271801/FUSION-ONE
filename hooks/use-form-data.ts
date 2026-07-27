/**
 * Shared hook for form dropdown data (parties, bank accounts, payment modes).
 * Used by: sales/new, purchases/new, and any other form that needs these.
 *
 * Uses TanStack Query with a 5-minute staleTime so data is cached and
 * available instantly when opening forms. Background refresh occurs
 * automatically if data is stale.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useFormData() {
  return useQuery({
    queryKey: ['form-dropdown-data'],
    queryFn: async () => {
      const [{ data: parties, error: pErr }, { data: bankAccounts, error: bErr }, { data: paymentModes, error: mErr }] =
        await Promise.all([
          supabase.from('parties').select('*').order('name'),
          supabase.from('bank_accounts').select('*'),
          supabase.from('payment_modes').select('*'),
        ]);
      if (pErr) throw pErr;
      if (bErr) throw bErr;
      if (mErr) throw mErr;
      return {
        parties: parties || [],
        bankAccounts: bankAccounts || [],
        paymentModes: paymentModes || [],
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — same as global default
  });
}

/**
 * In-stock inventory items for the selected financial year.
 * Used by: sales/new (to pick phones to sell).
 */
export function useInStockItems(financialYearId: string | undefined) {
  return useQuery({
    queryKey: ['in-stock-items', financialYearId],
    enabled: !!financialYearId,
    queryFn: async () => {
      if (!financialYearId) return [];
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('financial_year_id', financialYearId)
        .eq('status', 'in_stock');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000, // 30 seconds — inventory changes frequently during sales
  });
}
