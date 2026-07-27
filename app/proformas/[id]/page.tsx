'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import {
  downloadInvoicePdf,
  printInvoicePdf,
  shareInvoicePdf,
} from '@/lib/invoice/actions/client';
import { InvoiceDocument } from '@/components/invoice/InvoiceDocument';
import { InvoiceSidebar, SidebarButton } from '@/components/invoice/InvoiceSidebar';
import { useToast } from '@/components/ui/Toast';
import type { InvoiceData } from '@/lib/invoice/types';

export default function ProformaViewPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { success: toastSuccess, error: toastError } = useToast();

  const [pData, setPData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [tradeIns, setTradeIns] = useState<any[]>([]);
  const [storeData, setStoreData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const loadProforma = async () => {
    if (!id) return;
    try {
      const [{ data: pfData, error: pfErr }, { data: pfItems, error: pfIErr }, storeResult] = await Promise.all([
        supabase.from('proforma_invoices').select('*, parties (id, name, number, address)').eq('id', id).single(),
        supabase.from('proforma_invoice_items').select('*').eq('proforma_invoice_id', id),
        supabase.from('store').select('*').limit(1).maybeSingle(),
      ]);
      if (pfErr) throw pfErr;
      if (pfIErr) throw pfIErr;

      let pfTradeIns: any[] = [];
      const { data: tData } = await supabase.from('proforma_trade_ins').select('*').eq('proforma_invoice_id', id);
      if (tData) pfTradeIns = tData;

      setPData(pfData);
      setItems(pfItems || []);
      setTradeIns(pfTradeIns);
      setStoreData(storeResult.data || null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadProforma(); }, [id]);

  // ── Invoice data builder ─────────────────────────────────────────────────

  const getInvoiceData = (): InvoiceData => ({
    type: 'proforma',
    template: 'prestige',
    store: storeData,
    bill_number: pData.bill_number,
    date: pData.date,
    party: pData.parties,
    items: items.map((line: any) => ({
      description: line.description, qty: Number(line.qty),
      rate: Number(line.rate), discount: Number(line.discount || 0), value: Number(line.value),
    })) as any,
    subtotal: Number(pData.total),
    additional_discount: Number(pData.discount),
    discount: Number(pData.discount),
    trade_in_credit: Number(pData.trade_in_credit || 0),
    final_total: Number(pData.final_total),
    paid: 0, due: Number(pData.final_total),
    trade_ins: tradeIns.map((ti: any) => ({ description: ti.description, qty: Number(ti.qty), rate: Number(ti.rate), value: Number(ti.value) })),
  });

  // ── PDF helpers ─────────────────────────────────────────────────────────

  const handlePrint = async () => {
    if (!pData) return;
    try { await printInvoicePdf(getInvoiceData()); }
    catch (e: any) { toastError('Print Failed', e.message); }
  };

  const handleShare = async () => {
    if (!pData) return;
    setIsSendingWa(true);
    try { await shareInvoicePdf(getInvoiceData()); }
    catch (e: any) { toastError('Share Failed', e.message); }
    finally { setIsSendingWa(false); }
  };

  const handleExport = async () => {
    if (!pData) return;
    setIsPdfGenerating(true);
    try { await downloadInvoicePdf(getInvoiceData()); }
    catch (e: any) { toastError('Export Failed', e.message); }
    finally { setIsPdfGenerating(false); }
  };

  const handleConvert = () => {
    const prefilledTradeIns: any[] = [];
    tradeIns.forEach(ti => {
      const qty = Math.max(1, Math.round(Number(ti.qty) || 1));
      for (let i = 0; i < qty; i++) {
        prefilledTradeIns.push({ id: Math.random().toString(), brand: 'Exchange', model: ti.description, imei: '', ram_rom: '', color: '', credit_value: Number(ti.rate).toString(), mrp: '' });
      }
    });
    sessionStorage.setItem('convert_proforma', JSON.stringify({
      proforma_id: pData.id, party_id: pData.parties.id,
      discount: pData.discount, trade_ins: prefilledTradeIns,
    }));
    router.push('/sales/new');
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 68px)' }}>
      {/* ── Header strip ── */}
      <div className="flex-none pb-3">
        <button
          onClick={() => router.push('/proformas')}
          className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* ── Split panel ── */}
      <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">
        {/* Invoice document */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <InvoiceDocument type="proforma" billNumber="" date="" items={[]} subtotal={0} finalTotal={0} isLoading />
          ) : pData ? (
            <InvoiceDocument
              type="proforma"
              billNumber={pData.bill_number}
              date={pData.date}
              status={pData.status}
              party={pData.parties}
              store={storeData}
              items={items.map((line: any) => ({
                description: line.description || 'Item',
                qty: Number(line.qty) || 1,
                rate: Number(line.rate) || 0,
                discount: Number(line.discount) || 0,
                amount: Number(line.value) || 0,
              }))}
              subtotal={Number(pData.total) || 0}
              additionalDiscount={Number(pData.discount) || 0}
              tradeInCredit={Number(pData.trade_in_credit) || 0}
              finalTotal={Number(pData.final_total) || 0}
              tradeIns={tradeIns.map((ti: any) => ({
                description: ti.description || 'Trade-In',
                value: Number(ti.value) || 0,
              }))}
            />
          ) : null}
        </div>

        {/* Sidebar — independently scrollable */}
        {!isLoading && pData && (
          <div className="w-60 shrink-0 overflow-y-auto overflow-x-hidden">
            <InvoiceSidebar
              invoiceId={id}
              type="proforma"
              billNumber={pData.bill_number}
              date={pData.date}
              party={pData.parties}
              status={pData.status || 'active'}
              onPrint={handlePrint}
              onShare={handleShare}
              onExport={handleExport}
              isSendingWa={isSendingWa}
              isPdfGenerating={isPdfGenerating}
            >
              {/* Proforma-specific: Convert to Sale */}
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 px-0.5 mb-1">Quotation</p>
              {pData.status === 'active' ? (
                <SidebarButton
                  icon={ShoppingCart}
                  label="Convert to Sale"
                  onClick={handleConvert}
                  variant="primary"
                />
              ) : (
                <div className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                  Converted to Sale
                </div>
              )}
            </InvoiceSidebar>
          </div>
        )}
      </div>
    </div>
  );
}
