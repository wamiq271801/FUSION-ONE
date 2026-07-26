'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useFinancialYear } from '@/components/providers/FinancialYearProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Search, Plus, FileText, MoreVertical, FileDown, Share2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { printStoredPdf, exportStoredPdf, shareStoredPdf } from '@/lib/invoice/actions/client';
import { usePurchasesPageData, payPurchase, usePurchasesInvalidation } from '@/features/purchases';

export default function PurchasesPage() {
  const router = useRouter();
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();
  const { error, success } = useToast();
  const invalidatePurchases = usePurchasesInvalidation();

  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payBankId, setPayBankId] = useState('');
  const [payModeId, setPayModeId] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const purchasesQuery = usePurchasesPageData(selectedYear, fyLoading);
  const { purchases = [], bankAccounts = [], paymentModes = [] } = purchasesQuery.data || {};

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return;
      setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMenuOpen = useCallback((e: React.MouseEvent, purchase: any) => {
    e.stopPropagation();
    if (openMenuId === purchase.id) { setOpenMenuId(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
    setOpenMenuId(purchase.id);
  }, [openMenuId]);

  // PDF actions operate directly on pdf_path (already on list row — no detail fetch needed)
  const handleSavePdf = useCallback(async (p: any) => {
    setOpenMenuId(null);
    if (p.pdf_path) await exportStoredPdf(p.pdf_path, `Purchase_${p.bill_number}.pdf`);
  }, []);

  const handleShare = useCallback(async (p: any) => {
    setOpenMenuId(null);
    if (p.pdf_path) await shareStoredPdf(p.pdf_path, p.bill_number || 'Purchase Bill');
  }, []);

  const handlePrint = useCallback(async (p: any) => {
    setOpenMenuId(null);
    if (p.pdf_path) await printStoredPdf(p.pdf_path);
  }, []);

  const filteredPurchases = purchases.filter(p => {
    const q = searchQuery.toLowerCase();
    return p.bill_number.toLowerCase().includes(q) || (p.parties?.name || '').toLowerCase().includes(q);
  });

  const openPayModal = (purchase: any) => {
    setSelectedPurchase(purchase); setPayAmount(purchase.due.toString());
    const today = new Date().toISOString().split('T')[0];
    setPayDate(selectedYear ? (today < selectedYear.start_date ? selectedYear.start_date : today > selectedYear.end_date ? selectedYear.end_date : today) : today);
    setPayBankId(''); setPayModeId(''); setIsPayModalOpen(true);
  };

  const handlePayParty = async () => {
    if (!selectedYear || !selectedPurchase) return;
    const parsedAmount = Number(payAmount);
    if (!payDate) { error('Validation', 'Date is required'); return; }
    if (payDate < selectedYear.start_date || payDate > selectedYear.end_date) { error('Validation', 'Date must be within FY'); return; }
    if (!payBankId) { error('Validation', 'Account is required'); return; }
    const bank = bankAccounts.find((b: any) => b.id === payBankId);
    if (!bank?.is_cash && !payModeId) { error('Validation', 'Payment mode required for non-cash accounts'); return; }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { error('Validation', 'Amount must be greater than zero'); return; }
    if (parsedAmount > selectedPurchase.due) { error('Validation', 'Cannot exceed due amount'); return; }
    setIsPaying(true);
    try {
      await payPurchase({
        purchaseId:    selectedPurchase.id,
        partyId:       selectedPurchase.party_id,
        currentPaid:   Number(selectedPurchase.paid),
        currentDue:    Number(selectedPurchase.due),
        amount:        parsedAmount,
        date:          payDate,
        bankAccountId: payBankId,
        paymentModeId: payModeId || null,
        financialYear: selectedYear,
      });
      success('Success', 'Payment recorded'); setIsPayModalOpen(false);
      await invalidatePurchases(selectedYear.id);
    } catch (err: any) { error('Error', err.message); } finally { setIsPaying(false); }
  };

  const selectedBank    = bankAccounts.find(b => b.id === payBankId);
  const applicableModes = paymentModes.filter(m => m.bank_account_id === payBankId);

  if (fyLoading || purchasesQuery.isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center justify-between"><div className="space-y-1.5"><div className="h-4 w-20 bg-slate-100 rounded" /><div className="h-3 w-44 bg-slate-100 rounded" /></div><div className="h-8 w-28 bg-slate-100 rounded-md" /></div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100"><div className="h-8 w-64 bg-slate-100 rounded-md" /></div>
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex gap-6">{[...Array(6)].map((_, i) => <div key={i} className="h-2.5 w-14 bg-slate-100 rounded" />)}</div>
          {[...Array(7)].map((_, i) => <div key={i} className="flex items-center gap-6 px-4 py-3 border-b border-slate-50">{[...Array(6)].map((_, j) => <div key={j} className="h-3 bg-slate-100 rounded" style={{ width: `${[20,28,32,18,14,12][j]}%` }} />)}</div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Purchases</h1>
          <p className="text-[11px] text-slate-400 mt-1">Purchase bills and supplier payments for this FY</p>
        </div>
        {!isReadOnly && (
          <Button size="sm" onClick={() => router.push('/purchases/new')} className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New Purchase
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input placeholder="Search bills or parties…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Date','Bill No','Party','Total','Due',''].map((h, i) => (
                <th key={i} className={cn('px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400', i >= 3 && i <= 4 ? 'text-right' : i === 5 ? 'text-center' : '')}>{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPurchases.map(p => {
                const isMenuOpen = openMenuId === p.id;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{p.date}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-indigo-700 tabular-nums">{p.bill_number}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{p.parties?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-900 tabular-nums">{Number(p.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums">
                      {Number(p.due) > 0 ? <span className="text-rose-600">{Number(p.due).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</span> : <span className="text-slate-300">0.00 Rs.</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => router.push(`/purchases/${p.id}`)} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="View">
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        {!isReadOnly && Number(p.due) > 0 && (
                          <button onClick={() => openPayModal(p)} className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-200">Pay</button>
                        )}
                        {/* ⋮ menu */}
                        <div ref={isMenuOpen ? triggerRef : undefined}>
                          <button
                            onClick={e => handleMenuOpen(e, p)}
                            className={cn('h-7 w-7 flex items-center justify-center rounded-md transition-colors', isMenuOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100')}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                          {isMenuOpen && typeof window !== 'undefined' && createPortal(
                            <div
                              ref={menuRef}
                              style={{ position: 'absolute', top: menuPos.top, right: menuPos.right }}
                              className="w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-[9999]"
                            >
                              <button onClick={() => handleSavePdf(p)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                <FileDown className="h-3.5 w-3.5 text-slate-400" /> Save PDF
                              </button>
                              <button onClick={() => handleShare(p)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                <Share2 className="h-3.5 w-3.5 text-slate-400" /> Share
                              </button>
                              <button onClick={() => handlePrint(p)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                <Printer className="h-3.5 w-3.5 text-slate-400" /> Print
                              </button>
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPurchases.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">No purchases found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isPayModalOpen} onClose={() => !isPaying && setIsPayModalOpen(false)} title="Pay Party"
        footer={<><Button variant="outline" onClick={() => setIsPayModalOpen(false)} disabled={isPaying}>Cancel</Button><Button onClick={handlePayParty} isLoading={isPaying}>Record Payment</Button></>}>
        {selectedPurchase && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3 flex justify-between text-xs">
              <div><p className="text-slate-400 mb-0.5">Bill No</p><p className="font-semibold text-slate-900">{selectedPurchase.bill_number}</p></div>
              <div className="text-right"><p className="text-slate-400 mb-0.5">Party</p><p className="font-semibold text-slate-900">{selectedPurchase.parties?.name}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-lg p-2.5 text-center"><p className="text-[10px] text-slate-400 mb-1">Total</p><p className="text-xs font-semibold tabular-nums">{Number(selectedPurchase.total).toFixed(2)} Rs.</p></div>
              <div className="bg-emerald-50 rounded-lg p-2.5 text-center border border-emerald-100"><p className="text-[10px] text-emerald-600 mb-1">Paid</p><p className="text-xs font-semibold text-emerald-800 tabular-nums">{Number(selectedPurchase.paid).toFixed(2)} Rs.</p></div>
              <div className="bg-rose-50 rounded-lg p-2.5 text-center border border-rose-100"><p className="text-[10px] text-rose-600 mb-1">Due</p><p className="text-xs font-bold text-rose-800 tabular-nums">{Number(selectedPurchase.due).toFixed(2)} Rs.</p></div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Amount *</label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="font-mono text-xs" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Date *</label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} min={selectedYear?.start_date} max={selectedYear?.end_date} className="text-xs" /></div>
              </div>
              <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Account *</label>
                <Select value={payBankId} onChange={v => { setPayBankId(v); setPayModeId(''); }}
                  options={[{ value: '', label: 'Select account' }, ...bankAccounts.map(b => ({ value: b.id, label: b.name + (b.is_cash ? ' (Cash)' : '') }))]} />
              </div>
              {selectedBank && !selectedBank.is_cash && (
                <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Payment Mode *</label>
                  <Select value={payModeId} onChange={v => setPayModeId(v)}
                    options={[{ value: '', label: 'Select mode' }, ...applicableModes.map(m => ({ value: m.id, label: m.name }))]} />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
