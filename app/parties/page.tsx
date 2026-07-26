'use client';

import { useState, useMemo } from 'react';
import { useFinancialYear } from '@/components/providers/FinancialYearProvider';
import { Button } from '@/components/ui/Button';
import { PartyFormModal, Party } from '@/components/parties/PartyFormModal';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePartiesPageData, usePartiesInvalidation } from '@/features/parties';

interface PartyLedger { partyId: string; salesTotal: number; salesDue: number; purchasesTotal: number; purchasesDue: number; }

export default function PartiesPage() {
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const invalidateParties = usePartiesInvalidation();

  const partiesQuery = usePartiesPageData(selectedYear, fyLoading);
  const { parties = [], sales = [], purchases = [] } = partiesQuery.data || {};

  const ledgers = useMemo(() => {
    const map = new Map<string, PartyLedger>();
    parties.forEach(p => map.set(p.id, { partyId: p.id, salesTotal: 0, salesDue: 0, purchasesTotal: 0, purchasesDue: 0 }));
    sales.forEach(s => { const l = map.get(s.party_id); if (l) { l.salesTotal += Number(s.final_total || 0); l.salesDue += Number(s.due || 0); } });
    purchases.forEach(pu => { const l = map.get(pu.party_id); if (l) { l.purchasesTotal += Number(pu.total || 0); l.purchasesDue += Number(pu.due || 0); } });
    return map;
  }, [parties, sales, purchases]);

  const filteredParties = parties.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.number && p.number.toLowerCase().includes(searchQuery.toLowerCase())));

  if (fyLoading || partiesQuery.isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center justify-between"><div className="space-y-1.5"><div className="h-4 w-16 bg-slate-100 rounded" /><div className="h-3 w-56 bg-slate-100 rounded" /></div><div className="h-8 w-24 bg-slate-100 rounded-md" /></div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100"><div className="h-8 w-56 bg-slate-100 rounded-md" /></div>
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex gap-6">{[...Array(6)].map((_, i) => <div key={i} className="h-2.5 w-16 bg-slate-100 rounded" />)}</div>
          {[...Array(6)].map((_, i) => <div key={i} className="flex items-center gap-6 px-4 py-3 border-b border-slate-50"><div className="flex items-center gap-2"><div className="h-7 w-7 bg-slate-100 rounded-full" /><div className="space-y-1"><div className="h-3 w-24 bg-slate-100 rounded" /><div className="h-2.5 w-16 bg-slate-100 rounded" /></div></div>{[...Array(5)].map((_, j) => <div key={j} className="h-3 bg-slate-100 rounded ml-auto" style={{ width: `${[14,12,14,12,10][j]}%` }} />)}</div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Parties</h1>
          <p className="text-[11px] text-slate-400 mt-1">Customers and suppliers — single shared directory</p>
        </div>
        {!isReadOnly && (
          <Button size="sm" onClick={() => { setEditingParty(null); setIsModalOpen(true); }} className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> Add Party
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input placeholder="Search by name or number…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Party</th>
                {['Sales Biz','Sales Due','Purchase Biz','Purchase Due'].map(h => <th key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 text-right">{h}</th>)}
                <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredParties.map(party => {
                const l = ledgers.get(party.id);
                const fmt = (n: number) => `${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.`;
                return (
                  <tr key={party.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[11px] font-bold shrink-0">{party.name.charAt(0).toUpperCase()}</div>
                        <div><div className="text-xs font-medium text-slate-900">{party.name}</div><div className="text-[11px] text-slate-400">{party.number}</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium text-slate-700 tabular-nums">{fmt(l?.salesTotal || 0)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums">
                      {(l?.salesDue || 0) > 0 ? <span className="text-rose-600">{fmt(l!.salesDue)}</span> : <span className="text-slate-300">{fmt(0)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-medium text-slate-700 tabular-nums">{fmt(l?.purchasesTotal || 0)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums">
                      {(l?.purchasesDue || 0) > 0 ? <span className="text-rose-600">{fmt(l!.purchasesDue)}</span> : <span className="text-slate-300">{fmt(0)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {!isReadOnly && <button onClick={() => { setEditingParty(party); setIsModalOpen(true); }} className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">Edit</button>}
                    </td>
                  </tr>
                );
              })}
              {filteredParties.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">No parties found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <PartyFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          invalidateParties(selectedYear?.id ?? '');
        }}
        initialData={editingParty}
      />
    </div>
  );
}
