/**
 * Parties — data queries.
 * Extracted from app/parties/page.tsx.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';
import type { FinancialYear } from '@/shared/types';

export const partyKeys = {
  page: (fyId: string) => ['parties-page', fyId] as const,
};

export function usePartiesPageData(selectedYear: FinancialYear | null, fyLoading: boolean) {
  return useQuery({
    queryKey: partyKeys.page(selectedYear?.id ?? ''),
    enabled:  !fyLoading && !!selectedYear,
    queryFn:  async () => {
      if (!selectedYear) return { parties: [], sales: [], purchases: [] };
      const [
        { data: pData,  error: pErr  },
        { data: sData,  error: sErr  },
        { data: puData, error: puErr },
      ] = await Promise.all([
        supabase.from('parties').select('*').order('name', { ascending: true }),
        supabase.from('sales').select('party_id, final_total, due').eq('financial_year_id', selectedYear.id).eq('status', 'active'),
        supabase.from('purchases').select('party_id, total, due').eq('financial_year_id', selectedYear.id).eq('status', 'active'),
      ]);
      if (pErr) throw pErr;
      if (sErr) throw sErr;
      if (puErr) throw puErr;
      return { parties: pData || [], sales: sData || [], purchases: puData || [] };
    },
  });
}

export function usePartiesInvalidation() {
  const queryClient = useQueryClient();
  return (fyId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: partyKeys.page(fyId) }),
    ]);
}
