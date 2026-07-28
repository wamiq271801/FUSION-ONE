/**
 * Sales — data queries.
 *
 * Extracted from app/sales/page.tsx.
 * Pages import this hook instead of inlining Supabase calls.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';
import type { FinancialYear } from '@/shared/types';

// ── Query key factory ────────────────────────────────────────────────────────

export const salesKeys = {
  page:   (fyId: string) => ['sales-page', fyId] as const,
  detail: (saleId: string) => ['sale-detail', saleId] as const,
};

// ── Page-level data ──────────────────────────────────────────────────────────

export function useSalesPageData(selectedYear: FinancialYear | null, fyLoading: boolean) {
  return useQuery({
    queryKey: salesKeys.page(selectedYear?.id ?? ''),
    enabled:  !fyLoading && !!selectedYear,
    queryFn:  async () => {
      if (!selectedYear) return { sales: [], bankAccounts: [], paymentModes: [] };
      const [
        { data: saleData,  error: saleErr  },
        { data: bankData,  error: bankErr  },
        { data: modeData,  error: modeErr  },
      ] = await Promise.all([
        supabase
          .from('sales')
          .select('*, parties (name, number)')
          .eq('financial_year_id', selectedYear.id)
          .order('date', { ascending: false }),
        supabase.from('bank_accounts').select('*'),
        supabase.from('payment_modes').select('*'),
      ]);
      if (saleErr) throw saleErr;
      if (bankErr) throw bankErr;
      if (modeErr) throw modeErr;
      return { sales: saleData || [], bankAccounts: bankData || [], paymentModes: modeData || [] };
    },
  });
}

// ── Sale detail (lazy, per-sale) ─────────────────────────────────────────────

export async function fetchSaleDetail(saleId: string) {
  const [
    { data: siData  },
    { data: tiData  },
    { data: storeData },
  ] = await Promise.all([
    supabase
      .from('sale_items')
      .select('sold_price, inventory_item_id, inventory_items (brand, model, imei, ram_rom, color, base_selling_price)')
      .eq('sale_id', saleId),
    supabase.from('trade_ins').select('*').eq('sale_id', saleId),
    supabase.from('store').select('*').limit(1).maybeSingle(),
  ]);
  return { items: siData || [], tradeIns: tiData || [], store: storeData };
}

// ── Cache invalidation helper ────────────────────────────────────────────────

export function useSalesInvalidation() {
  const queryClient = useQueryClient();
  return (fyId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: salesKeys.page(fyId) }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['payments-page', fyId] }),
      queryClient.invalidateQueries({ queryKey: ['accounts-page',  fyId] }),
    ]);
}
