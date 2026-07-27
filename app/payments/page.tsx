'use client';

import { useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFinancialYear } from '@/components/providers/FinancialYearProvider';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/Select';

function PaymentsContent() {
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'in' | 'out'>(searchParams.get('tab') === 'out' ? 'out' : 'in');
  const { selectedYear, isLoading: fyLoading } = useFinancialYear();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState('');

  const handleTabChange = (tab: 'in' | 'out') => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const paymentsQuery = useQuery({
    queryKey: ['payments-page', selectedYear?.id],
    enabled: !fyLoading && !!selectedYear,
    queryFn: async () => {
      if (!selectedYear) return { paymentsIn: [], paymentsOut: [], parties: [] };

        const [pinRes, poutRes, partyRes] = await Promise.all([
          supabase.from('payments_in').select('id, amount, date, sale_id, parties (id, name), bank_accounts (name), payment_modes (name), sales (bill_number)').eq('financial_year_id', selectedYear.id).order('date', { ascending: false }),
          supabase.from('payments_out').select('id, amount, date, purchase_id, parties (id, name), bank_accounts (name), payment_modes (name), purchases (bill_number)').eq('financial_year_id', selectedYear.id).order('date', { ascending: false }),
          supabase.from('parties').select('id, name').order('name'),
        ]);
        if (pinRes.error) throw pinRes.error; if (poutRes.error) throw poutRes.error; if (partyRes.error) throw partyRes.error;
        return { paymentsIn: pinRes.data || [], paymentsOut: poutRes.data || [], parties: partyRes.data || [] };
    },
  });

  const { paymentsIn = [], paymentsOut = [], parties = [] } = paymentsQuery.data || {};

  const filterFn = (list: any[], billKey: string) => list.filter(p => {
    if (selectedPartyId && p.parties?.id !== selectedPartyId) return false;
    if (searchQuery) { const q = searchQuery.toLowerCase(); const name = p.parties?.name?.toLowerCase() || ''; const bill = p[billKey]?.bill_number?.toLowerCase() || ''; if (!name.includes(q) && !bill.includes(q)) return false; }
    return true;
  });

  const filteredIn = filterFn(paymentsIn, 'sales');
  const filteredOut = filterFn(paymentsOut, 'purchases');

  if (fyLoading || paymentsQuery.isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="space-y-1.5"><div className="h-4 w-20 bg-slate-100 rounded" /><div className="h-3 w-60 bg-slate-100 rounded" /></div>
        <div className="flex gap-1 border-b border-slate-200"><div className="h-8 w-24 bg-slate-100 rounded-t" /><div className="h-8 w-28 bg-slate-100 rounded-t" /></div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex gap-3"><div className="h-8 w-56 bg-slate-100 rounded-md" /><div className="h-8 w-36 bg-slate-100 rounded-md" /></div>
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex gap-6">{[...Array(5)].map((_, i) => <div key={i} className="h-2.5 w-16 bg-slate-100 rounded" />)}</div>
          {[...Array(6)].map((_, i) => <div key={i} className="flex items-center gap-6 px-4 py-3 border-b border-slate-50">{[...Array(5)].map((_, j) => <div key={j} className="h-3 bg-slate-100 rounded" style={{ width: `${[20,24,22,20,14][j]}%` }} />)}</div>)}
        </div>
      </div>
    );
  }

  const tabData = activeTab === 'in' ? filteredIn : filteredOut;
  const isIn = activeTab === 'in';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Payments</h1>
        <p className="text-[11px] text-slate-400 mt-1">Received and made payments for this FY</p>
      </div>

      <div className="flex border-b border-slate-200 gap-0">
        {(['in','out'] as const).map(tab => (
          <button key={tab} onClick={() => handleTabChange(tab)}
            className={cn('px-4 py-2 text-xs font-semibold tracking-wide transition-colors border-b-2 -mb-px',
              activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300')}>
            {tab === 'in' ? 'Payments In' : 'Payments Out'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input placeholder="Search by party or bill no…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <Select
            value={selectedPartyId}
            onChange={v => setSelectedPartyId(v)}
            options={[{ value: '', label: 'All Parties' }, ...parties.map(p => ({ value: p.id, label: p.name }))]}
            className="w-full sm:w-48"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Date','Party', isIn ? 'Sale Bill' : 'Purchase Bill', isIn ? 'Received' : 'Paid','Account / Mode'].map((h, i) => (
                <th key={i} className={cn('px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400', i === 3 ? 'text-right' : '')}>{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tabData.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{p.date}</td>
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-900">{p.parties?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {(isIn ? p.sales?.bill_number : p.purchases?.bill_number) ? (
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border', isIn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200')}>
                        {isIn ? p.sales.bill_number : p.purchases.bill_number}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={cn('px-4 py-2.5 text-right text-xs font-semibold tabular-nums', isIn ? 'text-emerald-700' : 'text-rose-600')}>
                    {isIn ? '+' : '-'}{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs font-medium text-slate-700">{p.bank_accounts?.name || '—'}</div>
                    {p.payment_modes?.name && <div className="text-[11px] text-slate-400">{p.payment_modes.name}</div>}
                  </td>
                </tr>
              ))}
              {tabData.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">No {activeTab === 'in' ? 'received' : 'made'} payments found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5 animate-pulse">
        <div className="space-y-1.5"><div className="h-4 w-20 bg-slate-100 rounded" /><div className="h-3 w-52 bg-slate-100 rounded" /></div>
        <div className="flex gap-1 border-b border-slate-200"><div className="h-8 w-24 bg-slate-100 rounded-t" /><div className="h-8 w-28 bg-slate-100 rounded-t" /></div>
        <div className="bg-white rounded-xl border border-slate-200 h-80" />
      </div>
    }>
      <PaymentsContent />
    </Suspense>
  );
}
