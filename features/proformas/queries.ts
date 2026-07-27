/**
 * Proformas — data queries.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { FinancialYear } from '@/types';

export const proformaKeys = {
  page:   (fyId: string) => ['proformas-page', fyId] as const,
  detail: (id: string)   => ['proforma-detail', id]  as const,
};

export function useProformasPageData(selectedYear: FinancialYear | null, fyLoading: boolean) {
  return useQuery({
    queryKey: proformaKeys.page(selectedYear?.id ?? ''),
    enabled:  !fyLoading && !!selectedYear,
    queryFn:  async () => {
      if (!selectedYear) return [];
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select('*, parties (name, number)')
        .eq('financial_year_id', selectedYear.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}
