'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useFinancialYear } from '@/components/providers/FinancialYearProvider';
import { Button } from '@/components/ui/Button';
import { Search, Plus, FileText, MoreVertical, FileDown, Share2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { printStoredPdf, exportStoredPdf, shareStoredPdf } from '@/lib/invoice/actions/client';
import { useProformasPageData } from '@/features/proformas';

export default function ProformasPage() {
  const router = useRouter();
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const proformasQuery = useProformasPageData(selectedYear, fyLoading);
  const proformas = proformasQuery.data || [];
  const pLoading  = proformasQuery.isLoading;

  const filteredPs = proformas.filter(p => {
    const s = searchQuery.toLowerCase();
    return p.bill_number.toLowerCase().includes(s) || (p.parties?.name || '').toLowerCase().includes(s);
  });

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

  const handleMenuOpen = useCallback((e: React.MouseEvent, proforma: any) => {
    e.stopPropagation();
    if (openMenuId === proforma.id) { setOpenMenuId(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right });
    setOpenMenuId(proforma.id);
  }, [openMenuId]);

  const handleSavePdf = useCallback(async (p: any) => {
    setOpenMenuId(null);
    if (p.pdf_path) await exportStoredPdf(p.pdf_path, `Proforma_${p.bill_number}.pdf`);
  }, []);

  const handleShare = useCallback(async (p: any) => {
    setOpenMenuId(null);
    if (p.pdf_path) await shareStoredPdf(p.pdf_path, p.bill_number || 'Proforma Invoice');
  }, []);

  const handlePrint = useCallback(async (p: any) => {
    setOpenMenuId(null);
    if (p.pdf_path) await printStoredPdf(p.pdf_path);
  }, []);

  if (fyLoading || pLoading) {
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
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Proforma Invoices</h1>
          <p className="text-[11px] text-slate-400 mt-1">Proforma invoices and estimates for this FY</p>
        </div>
        {!isReadOnly && (
          <Button size="sm" onClick={() => router.push('/proformas/new')} className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New Proforma
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              placeholder="Search proformas or customers…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Date','Proforma No','Customer','Status','Total',''].map((h, i) => (
                <th key={i} className={cn('px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400', i === 4 ? 'text-right' : i === 5 ? 'text-center' : '')}>{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPs.map(p => {
                const isMenuOpen = openMenuId === p.id;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{p.date}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-indigo-700 tabular-nums">{p.bill_number}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{p.parties?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-medium">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider',
                        p.status === 'converted' ? 'bg-emerald-100 text-emerald-800' :
                        p.status === 'void' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700')}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-900 tabular-nums">{Number(p.final_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.</td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => router.push(`/proformas/${p.id}`)} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="View">
                          <FileText className="h-3.5 w-3.5" />
                        </button>
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
              {filteredPs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">No proformas found for the selected year.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
