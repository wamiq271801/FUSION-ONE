'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useFinancialYear } from '@/components/providers/FinancialYearProvider';
import { useToast } from '@/components/ui/Toast';
import { useStoreTemplates } from '@/hooks/useStoreTemplates';
import { downloadInvoicePdf } from '@/lib/invoice/actions/client';
import type { InvoiceData } from '@/lib/invoice/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Search, Plus, FileText, MoreVertical, FileDown, Share2, Printer, Ban, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSalesPageData, fetchSaleDetail, buildSaleInvoiceData, receivePayment, cancelSale as cancelSaleMutation, useSalesInvalidation } from '@/features/sales';

export default function SalesPage() {
  const router = useRouter();
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();
  const { error, success } = useToast();
  const invalidateSales = useSalesInvalidation();
  const { templates } = useStoreTemplates();

  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);       // portal dropdown node
  const triggerRef = useRef<HTMLDivElement>(null);    // ⋮ button wrapper

  // ponytail: lazy cache — fetch full sale data on first ⋮ open, reuse after
  const detailCache = useRef<Map<string, any>>(new Map());
  const [loadingMenuId, setLoadingMenuId] = useState<string | null>(null);

  // Cancel dialog state
  const [cancelSale, setCancelSale] = useState<any | null>(null);
  const [cancelDetail, setCancelDetail] = useState<any | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveDate, setReceiveDate] = useState('');
  const [receiveBankId, setReceiveBankId] = useState('');
  const [receiveModeId, setReceiveModeId] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);

  const salesQuery = useSalesPageData(selectedYear, fyLoading);
  const { sales = [], bankAccounts = [], paymentModes = [] } = salesQuery.data || {};

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

  const refreshData = async () => {
    if (!selectedYear) return;
    await invalidateSales(selectedYear.id);
  };

  // Fetch full sale detail (lazy, cached)
  const fetchDetail = useCallback(async (id: string) => {
    if (detailCache.current.has(id)) return detailCache.current.get(id);
    const detail = await fetchSaleDetail(id);
    detailCache.current.set(id, detail);
    return detail;
  }, []);

  const buildInvoiceData = (sale: any, detail: any): InvoiceData =>
    buildSaleInvoiceData(sale, detail, templates.sale);

  const handleMenuOpen = async (e: React.MouseEvent, sale: any) => {
    e.stopPropagation();
    if (openMenuId === sale.id) { setOpenMenuId(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
    setOpenMenuId(sale.id);
    if (!detailCache.current.has(sale.id)) {
      setLoadingMenuId(sale.id);
      await fetchDetail(sale.id).catch(() => null);
      setLoadingMenuId(null);
    }
  };

  const withDetail = async (saleId: string, fn: (detail: any) => Promise<void>) => {
    setOpenMenuId(null);
    const detail = await fetchDetail(saleId);
    const sale = sales.find(s => s.id === saleId);
    if (!sale || !detail) return;
    await fn(detail);
  };

  const handleSavePdf = (sale: any) => withDetail(sale.id, async (d) => {
    await downloadInvoicePdf(buildInvoiceData(sale, d));
  });

  const handleShare = (sale: any) => {
    setOpenMenuId(null);
    router.push(`/sales/${sale.id}`);
  };

  const handlePrint = (sale: any) => {
    setOpenMenuId(null);
    router.push(`/sales/${sale.id}`);
  };

  const openCancelDialog = async (sale: any) => {
    setOpenMenuId(null);
    const detail = await fetchDetail(sale.id);
    setCancelSale(sale);
    setCancelDetail(detail);
  };

  const handleCancel = async () => {
    if (!cancelSale || !selectedYear) return;
    setIsCancelling(true);
    try {
      await cancelSaleMutation({
        saleId:       cancelSale.id,
        saleItems:    cancelDetail?.items || [],
        tradeIns:     cancelDetail?.tradeIns || [],
        financialYear: selectedYear,
      });
      detailCache.current.delete(cancelSale.id);
      success('Cancelled', `${cancelSale.bill_number} has been cancelled.`);
      setCancelSale(null); setCancelDetail(null);
      await invalidateSales(selectedYear.id);
    } catch (err: any) { error('Error', err.message || 'Failed to cancel.'); }
    finally { setIsCancelling(false); }
  };

  const filteredSales = sales.filter(s => {
    const q = searchQuery.toLowerCase();
    return s.bill_number.toLowerCase().includes(q) || (s.parties?.name || '').toLowerCase().includes(q);
  });

  const openReceiveModal = (sale: any) => {
    setSelectedSale(sale);
    setReceiveAmount(sale.due.toString());
    const today = new Date().toISOString().split('T')[0];
    setReceiveDate(selectedYear ? (today < selectedYear.start_date ? selectedYear.start_date : today > selectedYear.end_date ? selectedYear.end_date : today) : today);
    setReceiveBankId(''); setReceiveModeId(''); setIsPayModalOpen(true);
  };

  const handleReceivePayment = async () => {
    if (!selectedYear || !selectedSale) return;
    const parsedAmount = Number(receiveAmount);
    if (!receiveDate) { error('Validation', 'Date is required'); return; }
    if (receiveDate < selectedYear.start_date || receiveDate > selectedYear.end_date) { error('Validation', 'Date must be within FY'); return; }
    if (!receiveBankId) { error('Validation', 'Account is required'); return; }
    const bank = bankAccounts.find((b: any) => b.id === receiveBankId);
    if (!bank?.is_cash && !receiveModeId) { error('Validation', 'Payment mode required for non-cash accounts'); return; }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { error('Validation', 'Amount must be greater than zero'); return; }
    if (parsedAmount > selectedSale.due) { error('Validation', 'Cannot exceed due amount'); return; }
    setIsReceiving(true);
    try {
      await receivePayment({
        saleId:        selectedSale.id,
        partyId:       selectedSale.party_id,
        currentPaid:   Number(selectedSale.paid),
        currentDue:    Number(selectedSale.due),
        amount:        parsedAmount,
        date:          receiveDate,
        bankAccountId: receiveBankId,
        paymentModeId: receiveModeId || null,
        financialYear: selectedYear,
      });
      success('Success', 'Payment received'); setIsPayModalOpen(false); refreshData();
    } catch (err: any) { error('Error', err.message); } finally { setIsReceiving(false); }
  };

  const selectedBank = bankAccounts.find(b => b.id === receiveBankId);
  const applicableModes = paymentModes.filter(m => m.bank_account_id === receiveBankId);

  if (fyLoading || salesQuery.isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="flex items-center justify-between"><div className="space-y-1.5"><div className="h-4 w-16 bg-slate-100 rounded" /><div className="h-3 w-44 bg-slate-100 rounded" /></div><div className="h-8 w-24 bg-slate-100 rounded-md" /></div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100"><div className="h-8 w-64 bg-slate-100 rounded-md" /></div>
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex gap-6">{[...Array(6)].map((_, i) => <div key={i} className="h-2.5 w-14 bg-slate-100 rounded" />)}</div>
          {[...Array(7)].map((_, i) => <div key={i} className="flex items-center gap-6 px-4 py-3 border-b border-slate-50">{[...Array(6)].map((_, j) => <div key={j} className="h-3 bg-slate-100 rounded" style={{ width: `${[20,28,32,18,14,12][j]}%` }} />)}</div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Sales</h1>
          <p className="text-[11px] text-slate-400 mt-1">Invoices and received payments for this FY</p>
        </div>
        {!isReadOnly && (
          <Button size="sm" onClick={() => router.push('/sales/new')} className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New Sale
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input placeholder="Search invoices or customers…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Date','Invoice No','Customer','Total','Due',''].map((h, i) => (
                <th key={i} className={cn('px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400', i >= 3 && i <= 4 ? 'text-right' : i === 5 ? 'text-center' : '')}>{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSales.map(s => {
                const isCancelled = s.status === 'cancelled';
                const isMenuOpen = openMenuId === s.id;
                return (
                  <tr key={s.id} className={`hover:bg-slate-50/60 transition-colors ${isCancelled ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{s.date}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold ${isCancelled ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>{s.bill_number}</span>
                        {isCancelled && <span className="text-[9px] font-bold uppercase tracking-widest bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">CANCELLED</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{s.parties?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-900 tabular-nums">{Number(s.final_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums">
                      {Number(s.due) > 0
                        ? <span className="text-rose-600">{Number(s.due).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</span>
                        : <span className="text-slate-300">0.00 Rs.</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => router.push(`/sales/${s.id}`)} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="View">
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        {!isReadOnly && !isCancelled && Number(s.due) > 0 && (
                          <button onClick={() => openReceiveModal(s)} className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors border border-emerald-200">
                            Receive
                          </button>
                        )}
                        {/* ⋮ menu */}
                        <div ref={isMenuOpen ? triggerRef : undefined}>
                          <button
                            onClick={e => handleMenuOpen(e, s)}
                            className={cn('h-7 w-7 flex items-center justify-center rounded-md transition-colors', isMenuOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100')}
                          >
                            {loadingMenuId === s.id
                              ? <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin block" />
                              : <MoreVertical className="h-3.5 w-3.5" />}
                          </button>
                          {isMenuOpen && typeof window !== 'undefined' && createPortal(
                            <div
                              ref={menuRef}
                              style={{ position: 'absolute', top: menuPos.top, right: menuPos.right }}
                              className="w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-[9999]"
                            >
                              <button onClick={() => handleSavePdf(s)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                <FileDown className="h-3.5 w-3.5 text-slate-400" /> Save PDF
                              </button>
                              <button onClick={() => handleShare(s)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                <Share2 className="h-3.5 w-3.5 text-slate-400" /> Share
                              </button>
                              <button onClick={() => handlePrint(s)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                <Printer className="h-3.5 w-3.5 text-slate-400" /> Print
                              </button>
                              {!isReadOnly && !isCancelled && (
                                <button onClick={() => openCancelDialog(s)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors border-t border-slate-100">
                                  <Ban className="h-3.5 w-3.5" /> Cancel Invoice
                                </button>
                              )}
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredSales.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">No sales found for the selected year.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receive Payment Modal */}
      <Modal isOpen={isPayModalOpen} onClose={() => !isReceiving && setIsPayModalOpen(false)} title="Receive Payment"
        footer={<><Button variant="outline" onClick={() => setIsPayModalOpen(false)} disabled={isReceiving}>Cancel</Button><Button onClick={handleReceivePayment} isLoading={isReceiving}>Record Receipt</Button></>}>
        {selectedSale && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3 flex justify-between text-xs">
              <div><p className="text-slate-400 mb-0.5">Invoice</p><p className="font-semibold text-slate-900">{selectedSale.bill_number}</p></div>
              <div className="text-right"><p className="text-slate-400 mb-0.5">Customer</p><p className="font-semibold text-slate-900">{selectedSale.parties?.name}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-lg p-2.5 text-center"><p className="text-[10px] text-slate-400 mb-1">Total</p><p className="text-xs font-semibold tabular-nums">{Number(selectedSale.final_total).toFixed(2)} Rs.</p></div>
              <div className="bg-emerald-50 rounded-lg p-2.5 text-center border border-emerald-100"><p className="text-[10px] text-emerald-600 mb-1">Received</p><p className="text-xs font-semibold text-emerald-800 tabular-nums">{Number(selectedSale.paid).toFixed(2)} Rs.</p></div>
              <div className="bg-rose-50 rounded-lg p-2.5 text-center border border-rose-100"><p className="text-[10px] text-rose-600 mb-1">Due</p><p className="text-xs font-bold text-rose-800 tabular-nums">{Number(selectedSale.due).toFixed(2)} Rs.</p></div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Amount *</label><Input type="number" value={receiveAmount} onChange={e => setReceiveAmount(e.target.value)} className="font-mono text-xs" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Date *</label><Input type="date" value={receiveDate} onChange={e => setReceiveDate(e.target.value)} min={selectedYear?.start_date} max={selectedYear?.end_date} className="text-xs" /></div>
              </div>
              <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Account *</label>
                <Select value={receiveBankId} onChange={v => { setReceiveBankId(v); setReceiveModeId(''); }}
                  options={[{ value: '', label: 'Select account' }, ...bankAccounts.map(b => ({ value: b.id, label: b.name + (b.is_cash ? ' (Cash)' : '') }))]} />
              </div>
              {selectedBank && !selectedBank.is_cash && (
                <div className="space-y-1"><label className="text-xs font-medium text-slate-600">Payment Mode *</label>
                  <Select value={receiveModeId} onChange={v => setReceiveModeId(v)}
                    options={[{ value: '', label: 'Select mode' }, ...applicableModes.map(m => ({ value: m.id, label: m.name }))]} />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation Dialog */}
      {cancelSale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Ban className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Cancel Invoice {cancelSale.bill_number}?</h3>
                <p className="text-xs text-slate-500 mt-1">This will mark the invoice as cancelled. The following will happen immediately:</p>
              </div>
            </div>
            <ul className="space-y-1.5 mb-6 pl-2">
              {cancelDetail?.items?.length > 0 && (
                <li className="text-xs text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  {cancelDetail.items.length} phone{cancelDetail.items.length > 1 ? 's' : ''} returned to stock
                </li>
              )}
              {Number(cancelSale.paid) > 0 && (
                <li className="text-xs text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  {Number(cancelSale.paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs. in payments reversed in ledger
                </li>
              )}
              {cancelDetail?.tradeIns?.length > 0 && (
                <li className="text-xs text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  {cancelDetail.tradeIns.length} trade-in device{cancelDetail.tradeIns.length > 1 ? 's' : ''} handled
                </li>
              )}
              <li className="text-xs text-slate-600 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                Bill number {cancelSale.bill_number} preserved as a cancellation record
              </li>
            </ul>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setCancelSale(null); setCancelDetail(null); }} disabled={isCancelling} className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                Keep Invoice
              </button>
              <Button onClick={handleCancel} isLoading={isCancelling} className="bg-amber-600 hover:bg-amber-700 text-xs h-9 px-5">
                Cancel Invoice
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
