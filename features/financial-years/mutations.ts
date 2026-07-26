/**
 * Financial Years — mutations and helpers.
 * Extracted from app/financial-year/page.tsx.
 */
import { supabase } from '@/lib/supabase';
import type { FinancialYear } from '@/types';

export async function createFinancialYear(
  startDate: string,
  endDate: string,
  existingYears: FinancialYear[],
): Promise<void> {
  if (!startDate || !endDate) throw new Error('Both dates required');
  if (new Date(startDate) >= new Date(endDate)) throw new Error('Start must be before end');

  const hasOverlap = existingYears.some(
    fy => new Date(startDate) <= new Date(fy.end_date) && new Date(endDate) >= new Date(fy.start_date),
  );
  if (hasOverlap) throw new Error('Date range overlaps with an existing year');

  const { error } = await supabase.from('financial_years').insert({ start_date: startDate, end_date: endDate, status: 'active' });
  if (error) {
    if (error.message.includes('fy_no_overlap') || error.code === 'EXCLUSION_VIOLATION')
      throw new Error('Range overlaps with an existing year');
    throw error;
  }
}

export async function setActiveFinancialYear(fyId: string): Promise<void> {
  const { error } = await supabase.from('store').update({ active_financial_year_id: fyId }).not('id', 'is', null);
  if (error) throw error;
}

export async function closeFinancialYear(fy: FinancialYear): Promise<void> {
  if (fy.status === 'closed') return;

  // 1. Mark year closed
  const { error: fyErr } = await supabase.from('financial_years').update({ status: 'closed' }).eq('id', fy.id);
  if (fyErr) throw fyErr;

  // 2. Carry forward unsold inventory items to the next open year
  const { data: nextFy } = await supabase
    .from('financial_years')
    .select('id')
    .eq('status', 'active')
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextFy) {
    await supabase
      .from('inventory_items')
      .update({ financial_year_id: nextFy.id })
      .eq('financial_year_id', fy.id)
      .eq('status', 'in_stock');
  }
}
