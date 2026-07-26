'use client';

import { useRef } from 'react';
import { useFinancialYear } from '@/components/providers/FinancialYearProvider';
import { useDashboardData } from '@/features/dashboard';
import Link from 'next/link';
import {
  TrendingUp,
  Package,
  AlertCircle,
  PlusCircle,
  ShoppingCart,
  Banknote,
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
  Wallet,
  Smartphone,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';



// Splits number and Rs. suffix into separate spans so each can carry its own
// weight/color. tabular-nums prevents reflow on number changes.

function Amount({
  value,
  size = 'md',
  dim = false,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  dim?: boolean;
}) {
  const formatted = value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dotIdx = formatted.lastIndexOf('.');
  const whole = formatted.slice(0, dotIdx);
  const dec = formatted.slice(dotIdx + 1);

  const sz = {
    sm: { symbol: 'text-[11px]', whole: 'text-sm',  dec: 'text-[11px]' },
    md: { symbol: 'text-sm',     whole: 'text-xl',  dec: 'text-sm'     },
    lg: { symbol: 'text-[15px]', whole: 'text-[26px] leading-none', dec: 'text-[15px]' },
  }[size];

  return (
    <span className={cn('inline-flex items-baseline gap-[1px] tabular-nums select-none', dim ? 'opacity-35' : '')}>
      <span className={cn(sz.whole, 'font-semibold text-slate-900 tracking-tight')}>{whole}</span>
      <span className={cn(sz.dec, 'font-normal text-slate-400')}>
        <span className="text-slate-300">.</span>{dec}
      </span>
      <span className={cn(sz.symbol, 'font-normal text-slate-500 ml-px')}>Rs.</span>
    </span>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  primary,
  secondary,
  secondaryLabel,
  iconBg,
  icon: Icon,
}: {
  label: string;
  primary: number;
  secondary?: number;
  secondaryLabel?: string;
  iconBg: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-slate-400 leading-none">
          {label}
        </span>
        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0', iconBg)}>
          <Icon className="w-3 h-3" />
        </div>
      </div>

      <div className="flex flex-col gap-px">
        <Amount value={primary} size="lg" />
        <span className="text-[10px] text-slate-400 font-medium">This month</span>
      </div>

      {secondary !== undefined && secondaryLabel && (
        <div className="flex items-center justify-between pt-2 mt-auto border-t border-slate-100">
          <span className="text-[10px] text-slate-400">{secondaryLabel}</span>
          <Amount value={secondary} size="sm" dim={secondary === 0} />
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
// Only shown on true first load (hasData is false). On year-switch, we keep
// showing the previous data faded out instead of re-showing the skeleton.

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse select-none">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-4 w-20 bg-slate-100 rounded" />
          <div className="h-3 w-36 bg-slate-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-slate-100 rounded-md" />
          <div className="h-8 w-28 bg-slate-100 rounded-md" />
          <div className="h-8 w-24 bg-slate-100 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-[106px] bg-slate-100 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="h-[120px] bg-slate-100 rounded-xl" />
        <div className="h-[120px] bg-slate-100 rounded-xl" />
        <div className="h-[120px] bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();

  const dashboardQuery = useDashboardData(selectedYear, isReadOnly, fyLoading);

  // Show skeleton on first load only (no cached data yet)
  if (fyLoading || (dashboardQuery.isLoading && !dashboardQuery.data)) return <Skeleton />;

  const data = dashboardQuery.data;
  const metrics = data?.metrics ?? { inStockCount: 0, totalStockValue: 0, todaySales: 0, thisMonthSales: 0, todayPurchases: 0, thisMonthPurchases: 0, totalDuesToReceive: 0, totalPayables: 0 };
  const accountBalances = data?.accountBalances ?? [];
  const alerts = data?.alerts ?? [];

  const fyLabel = selectedYear ? `${selectedYear.start_date} – ${selectedYear.end_date}` : '—';
  // Dim slightly while a background revalidation is running
  const dimming = dashboardQuery.isFetching && !!dashboardQuery.data ? 'opacity-70 pointer-events-none' : '';

  return (
    <div className={cn('space-y-5', dimming)}>

      {/* ── header row ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Overview</h1>
          <p className="text-[11px] text-slate-400 mt-1">
            FY {fyLabel}{isReadOnly ? ' · Read only' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isReadOnly ? (
            <>
              <Button disabled size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                <PlusCircle className="h-3.5 w-3.5" /> New Sale
              </Button>
              <Button disabled size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                <ShoppingCart className="h-3.5 w-3.5" /> New Purchase
              </Button>
            </>
          ) : (
            <>
              <Link href="/sales/new">
                <Button size="sm" className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
                  <PlusCircle className="h-3.5 w-3.5" /> New Sale
                </Button>
              </Link>
              <Link href="/purchases/new">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                  <ShoppingCart className="h-3.5 w-3.5" /> New Purchase
                </Button>
              </Link>
              <Link href="/inventory">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                  <Package className="h-3.5 w-3.5" /> Add Stock
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── metric cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Sales"      primary={metrics.thisMonthSales}     secondary={metrics.todaySales}     secondaryLabel="Today" iconBg="bg-indigo-50 text-indigo-500"  icon={TrendingUp}      />
        <MetricCard label="Purchases"  primary={metrics.thisMonthPurchases} secondary={metrics.todayPurchases} secondaryLabel="Today" iconBg="bg-violet-50 text-violet-500"  icon={ShoppingCart}    />
        <MetricCard label="To Receive" primary={metrics.totalDuesToReceive}                                                           iconBg="bg-emerald-50 text-emerald-500" icon={ArrowDownToLine}  />
        <MetricCard label="To Pay"     primary={metrics.totalPayables}                                                                iconBg="bg-rose-50 text-rose-500"     icon={ArrowUpFromLine}  />
      </div>

      {/* ── lower row: inventory | accounts | alerts ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* inventory */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-slate-400">Inventory</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">In Stock</p>
              <p className="text-lg font-semibold text-slate-900 tabular-nums leading-none">
                {metrics.inStockCount.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">units</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Value</p>
              <p className="text-lg font-semibold text-slate-900 tabular-nums leading-none">
                {metrics.totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Rs.
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">at cost</p>
            </div>
          </div>
          {!isReadOnly && (
            <Link href="/inventory" className="mt-auto">
              <p className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors text-center">
                Manage inventory →
              </p>
            </Link>
          )}
        </div>

        {/* account balances */}
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
          <div className="flex items-center gap-1.5 px-4 pt-4 pb-3 border-b border-slate-100">
            <Wallet className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-slate-400">Accounts</span>
            <span className="ml-auto text-[10px] text-slate-400">This FY</span>
          </div>
          {accountBalances.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-6 text-xs text-slate-400">
              No accounts configured.
            </div>
          ) : (
            <div className="flex-1 divide-y divide-slate-50">
              {accountBalances.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-5 h-5 rounded flex items-center justify-center', acc.is_cash ? 'bg-emerald-50' : 'bg-indigo-50')}>
                      {acc.is_cash
                        ? <Banknote className="w-2.5 h-2.5 text-emerald-600" />
                        : <Landmark className="w-2.5 h-2.5 text-indigo-600" />}
                    </div>
                    <span className="text-xs font-medium text-slate-700">{acc.name}</span>
                    {acc.is_cash && <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">Cash</span>}
                  </div>
                  <Amount value={acc.balance} size="sm" dim={acc.balance === 0} />
                </div>
              ))}
            </div>
          )}
          {!isReadOnly && (
            <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-3">
              <Link href="/payments?tab=in" className="flex-1 text-center text-[11px] font-medium text-emerald-600 hover:text-emerald-800 transition-colors">
                Receive →
              </Link>
              <div className="w-px h-3 bg-slate-200" />
              <Link href="/payments?tab=out" className="flex-1 text-center text-[11px] font-medium text-rose-500 hover:text-rose-700 transition-colors">
                Pay party →
              </Link>
            </div>
          )}
        </div>

        {/* alerts panel */}
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
          <div className="flex items-center gap-1.5 px-4 pt-4 pb-3 border-b border-slate-100">
            <Bell className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-slate-400">Notices</span>
            {alerts.length > 0 && (
              <span className="ml-auto flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">
                {alerts.length}
              </span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-6">
              <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center">
                <span className="text-emerald-500 text-sm">✓</span>
              </div>
              <p className="text-[11px] text-slate-400">All clear</p>
            </div>
          ) : (
            <div className="flex-1 divide-y divide-slate-50 overflow-auto">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                  <AlertCircle className={cn('w-3 h-3 mt-px shrink-0', a.type === 'warning' ? 'text-amber-500' : 'text-sky-500')} />
                  <div>
                    <p className={cn('text-[11px] font-semibold leading-none mb-0.5', a.type === 'warning' ? 'text-amber-700' : 'text-sky-700')}>
                      {a.title}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-snug">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

