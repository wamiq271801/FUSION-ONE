/**
 * Dashboard — data queries.
 * Extracted from app/dashboard/page.tsx.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';
import type { FinancialYear } from '@/shared/types';

export const dashboardKeys = {
  page: (fyId: string) => ['dashboard', fyId] as const,
};

export interface DashboardMetrics {
  inStockCount:          number;
  totalStockValue:       number;
  todaySales:            number;
  thisMonthSales:        number;
  todayPurchases:        number;
  thisMonthPurchases:    number;
  totalDuesToReceive:    number;
  totalPayables:         number;
}

export interface DashboardAccountBalance {
  id:       string;
  name:     string;
  is_cash:  boolean;
  balance:  number;
}

export interface DashboardAlert {
  type:    'warning' | 'info';
  title:   string;
  message: string;
}

export interface DashboardData {
  metrics:         DashboardMetrics;
  accountBalances: DashboardAccountBalance[];
  alerts:          DashboardAlert[];
}

export function useDashboardData(
  selectedYear: FinancialYear | null,
  isReadOnly: boolean,
  fyLoading: boolean,
) {
  return useQuery({
    queryKey: dashboardKeys.page(selectedYear?.id ?? ''),
    enabled:  !fyLoading && !!selectedYear,
    queryFn:  async (): Promise<DashboardData | null> => {
      if (!selectedYear) return null;

      const todayStr = new Date().toISOString().split('T')[0];
      const monthStr = todayStr.substring(0, 7);

      const [
        { data: invData    },
        { data: salesData  },
        { data: purData    },
        { data: accountsData },
        { data: txData     },
      ] = await Promise.all([
        supabase.from('inventory_items').select('purchase_price').eq('financial_year_id', selectedYear.id).eq('status', 'in_stock'),
        supabase.from('sales').select('date, due, final_total').eq('financial_year_id', selectedYear.id).eq('status', 'active'),
        supabase.from('purchases').select('date, due, total').eq('financial_year_id', selectedYear.id).eq('status', 'active'),
        supabase.from('bank_accounts').select('id, name, is_cash'),
        supabase.from('account_transactions').select('bank_account_id, type, amount').eq('financial_year_id', selectedYear.id),
      ]);

      const inStock    = invData    ?? [];
      const sales      = salesData  ?? [];
      const purchases  = purData    ?? [];
      const accounts   = accountsData ?? [];
      const transactions = txData   ?? [];

      const stockValue          = inStock.reduce((a, c) => a + Number(c.purchase_price ?? 0), 0);
      const todaySales          = sales.filter(s => s.date === todayStr).reduce((a, s) => a + Number(s.final_total ?? 0), 0);
      const thisMonthSales      = sales.filter(s => s.date.startsWith(monthStr)).reduce((a, s) => a + Number(s.final_total ?? 0), 0);
      const totalDues           = sales.reduce((a, s) => a + Number(s.due ?? 0), 0);
      const todayPurchases      = purchases.filter(p => p.date === todayStr).reduce((a, p) => a + Number(p.total ?? 0), 0);
      const thisMonthPurchases  = purchases.filter(p => p.date.startsWith(monthStr)).reduce((a, p) => a + Number(p.total ?? 0), 0);
      const totalPayables       = purchases.reduce((a, p) => a + Number(p.due ?? 0), 0);

      const balMap: Record<string, number> = {};
      transactions.forEach(tx => {
        const amt = Number(tx.amount ?? 0);
        balMap[tx.bank_account_id] = (balMap[tx.bank_account_id] ?? 0) + (tx.type === 'credit' ? amt : -amt);
      });

      const accountBalances = accounts
        .map(a => ({ ...a, balance: balMap[a.id] ?? 0 }))
        .sort((a, b) => a.is_cash !== b.is_cash ? (a.is_cash ? -1 : 1) : a.name.localeCompare(b.name));

      const alerts: DashboardAlert[] = [];
      if (new Date() > new Date(selectedYear.end_date) && !isReadOnly)
        alerts.push({ type: 'warning', title: 'Financial Year Ended', message: `FY ${selectedYear.start_date} – ${selectedYear.end_date} has ended. Close it to carry forward stock.` });
      if (inStock.length === 0)
        alerts.push({ type: 'warning', title: 'Zero Stock', message: 'No items in stock for this financial year.' });
      if (totalDues > 0)
        alerts.push({ type: 'info', title: 'Outstanding Dues', message: `${totalDues.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs. pending from customers.` });
      if (totalPayables > 0)
        alerts.push({ type: 'info', title: 'Pending Payables', message: `${totalPayables.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs. pending to suppliers.` });

      return {
        metrics: {
          inStockCount: inStock.length, totalStockValue: stockValue,
          todaySales, thisMonthSales, todayPurchases, thisMonthPurchases,
          totalDuesToReceive: totalDues, totalPayables,
        },
        accountBalances,
        alerts,
      };
    },
  });
}
