'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/platform/supabase/client';
import { useFinancialYear } from '@/shared/providers/FinancialYearProvider';
import { FileText, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/shared/utils/utils';

export default function ExchangePage() {
  const { selectedYear, isLoading: fyLoading } = useFinancialYear();
  const [searchQuery, setSearchQuery] = useState('');

  const exchangeQuery = useQuery({
    queryKey: ['exchange-page', selectedYear?.id],
    enabled: !fyLoading && !!selectedYear,
    queryFn: async () => {
      if (!selectedYear) return [];

        const { data, error: tErr } = await supabase.from('trade_ins').select('*, sales!inner (id, bill_number, financial_year_id), inventory_items!new_inventory_item_id (id, status)').eq('sales.financial_year_id', selectedYear.id).order('id', { ascending: false });
        if (tErr) throw tErr;
        return (data || []).map((t: any) => ({
          ...t,
          sales: Array.isArray(t.sales) ? t.sales[0] ?? null : t.sales,
        }));
    },
  });

  const tradeIns = exchangeQuery.data || [];

  const filtered = tradeIns.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (t.brand?.toLowerCase() || '').includes(q) || (t.model?.toLowerCase() || '').includes(q) || (t.imei?.toLowerCase() || '').includes(q) || (t.sales?.bill_number?.toLowerCase() || '').includes(q);
  });

  if (fyLoading || exchangeQuery.isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="space-y-1.5"><div className="h-4 w-20 bg-slate-100 rounded" /><div className="h-3 w-60 bg-slate-100 rounded" /></div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100"><div className="h-8 w-64 bg-slate-100 rounded-md" /></div>
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex gap-4">{[...Array(8)].map((_, i) => <div key={i} className="h-2.5 w-14 bg-slate-100 rounded" />)}</div>
          {[...Array(5)].map((_, i) => <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-50">{[...Array(8)].map((_, j) => <div key={j} className="h-3 bg-slate-100 rounded" style={{ width: `${[22,22,14,12,12,16,10,12][j]}%` }} />)}</div>)}
        </div>
      </div>
    );
  }

  const statusBadge = (status: string | undefined) => {
    if (status === 'in_stock') return <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">In Stock</span>;
    if (status === 'sold') return <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Sold</span>;
    return <span className="text-slate-300 text-xs"></span>;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Exchange</h1>
        <p className="text-[11px] text-slate-400 mt-1">All trade-in transactions for this FY</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input placeholder="Brand, model, IMEI or bill no" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Device','IMEI','Credit','MRP','Discount','Linked Sale','Doc','Status'].map((h, i) => (
                <th key={i} className={cn('px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400', i >= 2 && i <= 4 ? 'text-right' : '')}>{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(t => {
                const disc = Number(t.mrp || 0) > Number(t.credit_value) ? Number(t.mrp) - Number(t.credit_value) : 0;
                return (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="text-xs font-medium text-slate-900">{t.brand} {t.model}</div>
                      {(t.ram_rom || t.color) && <div className="text-[11px] text-slate-400">{[t.ram_rom, t.color].filter(Boolean).join(' · ')}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-500">{t.imei}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-emerald-700 tabular-nums">{Number(t.credit_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-500 tabular-nums">{t.mrp ? `${Number(t.mrp).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.` : ''}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium tabular-nums">{disc > 0 ? <span className="text-rose-600">{disc.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</span> : <span className="text-slate-300"></span>}</td>
                    <td className="px-4 py-2.5">
                      {t.sales?.bill_number
                        ? <Link href={`/sales/${t.sales.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800">{t.sales.bill_number}<ExternalLink className="h-3 w-3" /></Link>
                        : <span className="text-slate-300 text-xs"></span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.document_url
                        ? <a href={t.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition-colors"><FileText className="h-3 w-3" />View</a>
                        : <span className="text-slate-300 text-xs"></span>}
                    </td>
                    <td className="px-4 py-2.5">{statusBadge(t.inventory_items?.status)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-400">No trade-in transactions found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
