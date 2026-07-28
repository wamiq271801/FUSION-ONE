'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/platform/supabase/client';
import { useFinancialYear, FinancialYear } from '@/shared/providers/FinancialYearProvider';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Check, Lock, Plus, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '@/shared/providers/AuthProvider';
import { cn } from '@/shared/utils/utils';
import { createFinancialYear, setActiveFinancialYear } from '@/domains/financial-years';

export default function FinancialYearPage() {
  const { financialYears, selectedYear, setSelectedYearId, isReadOnly, refresh } = useFinancialYear();
  const { isOwner } = useAuth();
  const { error, success } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSystemYearId, setActiveSystemYearId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    supabase.from('store').select('active_financial_year_id').limit(1).maybeSingle().then(({ data }) => { if (data) setActiveSystemYearId(data.active_financial_year_id); });
  }, []);

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      await createFinancialYear(startDate, endDate, financialYears);
      success('Success', 'Financial year created');
      setIsModalOpen(false); setStartDate(''); setEndDate('');
      await refresh();
    } catch (err: any) { error('Error', err.message); } finally { setIsLoading(false); }
  };

  const handleSetActive = async (fyId: string) => {
    if (!isOwner) return;
    setIsLoading(true);
    try {
      await setActiveFinancialYear(fyId);
      success('Success', 'Default year updated'); setActiveSystemYearId(fyId); await refresh();
    } catch (err: any) { error('Error', err.message); } finally { setIsLoading(false); }
  };

  const handleSwitchTo = (fyId: string) => {
    setSelectedYearId(fyId);
    success('Switched', 'Working financial year changed');
  };

  const handleClose = async (fy: FinancialYear) => {
    if (fy.status === 'closed') return;
    if (!confirm(`Close FY ${fy.start_date} → ${fy.end_date}? This will freeze all records and carry forward unsold stock. Cannot be reversed.`)) return;
    setIsLoading(true);
    try {
      const { error: closeErr } = await supabase.from('financial_years').update({ status: 'closed' }).eq('id', fy.id).eq('status', 'active');
      if (closeErr) throw closeErr;
      const nextStart = new Date(fy.end_date); nextStart.setDate(nextStart.getDate() + 1);
      const nextStartStr = nextStart.toISOString().split('T')[0];
      let nextFyId = '';
      const { data: existFy } = await supabase.from('financial_years').select('id').eq('start_date', nextStartStr).maybeSingle();
      if (existFy) { nextFyId = existFy.id; } else {
        const nextEnd = new Date(nextStart); nextEnd.setFullYear(nextEnd.getFullYear() + 1); nextEnd.setDate(nextEnd.getDate() - 1);
        const { data: newFy, error: newFyErr } = await supabase.from('financial_years').insert({ start_date: nextStartStr, end_date: nextEnd.toISOString().split('T')[0], status: 'active' }).select('id').single();
        if (newFyErr) throw newFyErr; nextFyId = newFy.id;
      }
      const { data: unsoldItems, error: unsoldErr } = await supabase.from('inventory_items').select('*').eq('financial_year_id', fy.id).eq('status', 'in_stock');
      if (unsoldErr) throw unsoldErr;
      if (unsoldItems && unsoldItems.length > 0) {
        const { error: cfErr } = await supabase.from('inventory_items').insert(unsoldItems.map(item => ({ brand: item.brand, model: item.model, imei: item.imei, ram_rom: item.ram_rom, color: item.color, purchase_price: item.purchase_price, base_selling_price: item.base_selling_price, status: 'in_stock', source: item.source, financial_year_id: nextFyId, origin_inventory_item_id: item.id, opening_entry_type: 'carried_forward' })));
        if (cfErr) throw cfErr;
      }

      // ── Account balance carry-forward ──────────────────────────
      let accountsCf = 0;
      // Check if opening_balance entries already exist for next FY (idempotency)
      const { data: existingOb } = await supabase
        .from('account_transactions')
        .select('id')
        .eq('financial_year_id', nextFyId)
        .eq('reference_type', 'opening_balance')
        .limit(1);

      if (!existingOb || existingOb.length === 0) {
        // Fetch all account transactions for the closing year
        const { data: closingTxs, error: txErr } = await supabase
          .from('account_transactions')
          .select('bank_account_id, type, amount')
          .eq('financial_year_id', fy.id);
        if (txErr) throw txErr;

        // Compute closing balance per account
        const closingBalances: Record<string, number> = {};
        (closingTxs || []).forEach(tx => {
          const amt = Number(tx.amount);
          closingBalances[tx.bank_account_id] = (closingBalances[tx.bank_account_id] || 0) + (tx.type === 'credit' ? amt : -amt);
        });

        // Build FY label for notes
        const sYear = new Date(fy.start_date).getFullYear();
        const eYear = new Date(fy.end_date).getFullYear().toString().slice(-2);
        const fyLbl = `FY ${sYear}–${eYear}`;

        // Create opening balance entries in next FY for non-zero balances
        const obEntries = Object.entries(closingBalances)
          .filter(([, bal]) => bal !== 0)
          .map(([accountId, bal]) => ({
            bank_account_id: accountId,
            payment_mode_id: null,
            type: bal > 0 ? 'credit' : 'debit',
            amount: Math.abs(bal),
            date: nextStartStr,
            reference_type: 'opening_balance',
            reference_id: fy.id,
            financial_year_id: nextFyId,
            notes: `Opening balance carried forward from ${fyLbl}`,
          }));

        if (obEntries.length > 0) {
          const { error: obErr } = await supabase.from('account_transactions').insert(obEntries);
          if (obErr) throw obErr;
          accountsCf = obEntries.length;
        }
      }

      success('Success', `Year closed. ${unsoldItems?.length || 0} items carried forward. ${accountsCf} account balance(s) carried forward.`); await refresh();
    } catch (err: any) { error('Error', err.message); } finally { setIsLoading(false); }
  };

  function fyLabel(startDate: string, endDate: string) {
    const s = new Date(startDate).getFullYear();
    const e = new Date(endDate).getFullYear();
    return `FY ${s}–${e}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Financial Years</h1>
          <p className="text-[11px] text-slate-400 mt-1">Manage financial periods, switch working year, and carry forward stock</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-3.5 w-3.5" /> Create Year
        </Button>
      </div>

      {/* Current working year indicator */}
      {selectedYear && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-lg">
          <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span className="text-xs font-medium text-indigo-700">
            Working year: <span className="font-bold">{fyLabel(selectedYear.start_date, selectedYear.end_date)}</span>
          </span>
          {isReadOnly && (
            <span className="ml-2 flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-100">
              <Lock className="h-2.5 w-2.5" /> Read Only
            </span>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{['Period','Status','Default','Actions'].map((h, i) => (
              <th key={i} className={cn('px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400', i === 3 ? 'text-right' : '')}>{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {financialYears.map(fy => {
              const isDefault = activeSystemYearId === fy.id;
              const isSelected = selectedYear?.id === fy.id;
              return (
                <tr key={fy.id} className={cn('hover:bg-slate-50/60 transition-colors', isSelected && 'bg-indigo-50/30')}>
                  <td className="px-4 py-2.5 text-xs font-semibold text-slate-900 tabular-nums">
                    {fy.start_date} → {fy.end_date}
                    {isSelected && <span className="ml-2 text-[10px] font-bold text-indigo-600 uppercase">● Current</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {fy.status === 'active'
                      ? <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
                      : <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200"><Lock className="h-2.5 w-2.5" />Closed</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {isDefault
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Check className="h-3.5 w-3.5" />Default</span>
                      : <button onClick={() => handleSetActive(fy.id)} disabled={isLoading} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors">Set default</button>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isSelected && (
                        <button onClick={() => handleSwitchTo(fy.id)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                          Switch to
                        </button>
                      )}
                      {fy.status === 'active' && (
                        <button onClick={() => handleClose(fy)} disabled={isLoading} className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50 transition-colors">Close Year</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {financialYears.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-400">No financial years found.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Financial Year"
        footer={<><Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button onClick={handleCreate} isLoading={isLoading} disabled={!startDate || !endDate}>Create</Button></>}>
        <div className="space-y-3">
          <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Start Date</label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs" /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-slate-600">End Date</label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs" /></div>
        </div>
      </Modal>
    </div>
  );
}
