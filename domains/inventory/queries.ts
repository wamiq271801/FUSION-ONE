/**
 * Inventory — data queries and mutations.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';
import type { FinancialYear } from '@/shared/types';

export interface InventoryItem {
  id: string;
  brand: string;
  model: string;
  imei: string;
  ram_rom: string;
  color: string;
  purchase_price: number;
  base_selling_price: number;
  status: 'in_stock' | 'sold';
  source: 'purchase' | 'trade_in';
}

export const inventoryKeys = {
  page: (fyId: string) => ['inventory-page', fyId] as const,
};

export function useInventoryPageData(selectedYear: FinancialYear | null, fyLoading: boolean) {
  return useQuery({
    queryKey: inventoryKeys.page(selectedYear?.id ?? ''),
    enabled:  !fyLoading && !!selectedYear,
    queryFn:  async () => {
      if (!selectedYear) return [] as InventoryItem[];
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('financial_year_id', selectedYear.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InventoryItem[];
    },
  });
}

export function useInventoryInvalidation() {
  const queryClient = useQueryClient();
  return (fyId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: inventoryKeys.page(fyId) }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateInventoryForm(data: {
  brand: string; model: string; imei: string; ram_rom: string;
  color: string; purchase_price: string; base_selling_price: string;
}): string | null {
  if (!data.brand.trim())        return 'Brand is required';
  if (!data.model.trim())        return 'Model is required';
  if (!data.imei.trim() || !/^\d{15}$/.test(data.imei.trim())) return 'IMEI must be exactly 15 digits';
  if (!data.ram_rom.trim())      return 'RAM/ROM is required';
  if (!data.color.trim())        return 'Color is required';
  if (!data.purchase_price || isNaN(Number(data.purchase_price)) || Number(data.purchase_price) < 0)
    return 'Valid purchase price required';
  if (!data.base_selling_price || isNaN(Number(data.base_selling_price)) || Number(data.base_selling_price) < 0)
    return 'Valid selling price required';
  return null;
}
