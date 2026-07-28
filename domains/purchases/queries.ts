/**
 * Purchases — data queries.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';
import type { FinancialYear } from '@/shared/types';

export const purchaseKeys = {
  page: (fyId: string) => ['purchases-page', fyId] as const,
};

export function usePurchasesPageData(selectedYear: FinancialYear | null, fyLoading: boolean) {
  return useQuery({
    queryKey: purchaseKeys.page(selectedYear?.id ?? ''),
    enabled:  !fyLoading && !!selectedYear,
    queryFn:  async () => {
      if (!selectedYear) return { purchases: [], bankAccounts: [], paymentModes: [] };
      const [
        { data: purData,  error: purErr  },
        { data: bankData, error: bankErr },
        { data: modeData, error: modeErr },
      ] = await Promise.all([
        supabase
          .from('purchases')
          .select('*, parties (name, number)')
          .eq('financial_year_id', selectedYear.id)
          .order('date', { ascending: false }),
        supabase.from('bank_accounts').select('*'),
        supabase.from('payment_modes').select('*'),
      ]);
      if (purErr) throw purErr;
      if (bankErr) throw bankErr;
      if (modeErr) throw modeErr;
      return { purchases: purData || [], bankAccounts: bankData || [], paymentModes: modeData || [] };
    },
  });
}

export function usePurchasesInvalidation() {
  const queryClient = useQueryClient();
  return (fyId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: purchaseKeys.page(fyId) }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts-page', fyId] }),
    ]);
}
