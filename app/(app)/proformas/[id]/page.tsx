'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/platform/supabase/client';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import {
  downloadInvoicePdf,
  downloadInvoicePng,
} from '@/domains/invoice/actions/client';
import { buildProformaInvoiceData } from '@/domains/invoice/builders';
import { InvoiceReview, InvoiceReviewSkeleton } from '@/components/invoice/InvoiceReview';
import { InvoiceSidebar, SidebarButton } from '@/components/invoice/InvoiceSidebar';
import { useToast } from '@/components/ui/Toast';

export default function ProformaViewPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { success: toastSuccess, error: toastError } = useToast();

  const [pData, setPData] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [tradeIns, setTradeIns] = useState<any[]>([]);
  const [storeData, setStoreData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isPngLoading, setIsPngLoading] = useState(false);

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

      const { data: tData } = await supabase.from('proforma_trade_ins').select('*').eq('proforma_invoice_id', id);

      setPData(pfData);
      setItems(pfItems || []);
      setTradeIns(tData || []);
      setStoreData(storeResult.data || null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadProforma(); }, [id]);

  const getInvoiceData = () => buildProformaInvoiceData({
    proforma: pData, items, tradeIns, store: storeData, template: 'prestige',
  });

  const handleDownloadPdf = async () => {
    if (!pData) return;
    setIsPdfLoading(true);
    try { await downloadInvoicePdf(getInvoiceData()); }
    catch (e: any) { toastError('PDF Failed', e.message); }
    finally { setIsPdfLoading(false); }
  };

  const handleDownloadPng = async () => {
    if (!pData) return;
    setIsPngLoading(true);
    try { await downloadInvoicePng(getInvoiceData()); }
    catch (e: any) { toastError('Image Failed', e.message); }
    finally { setIsPngLoading(false); }
  };

  const handleConvert = () => {
    const prefilledTradeIns: any[] = [];
    tradeIns.forEach(ti => {
      const qty = Math.max(1, Math.round(Number(ti.qty) || 1));
      for (let i = 0; i < qty; i++) {
        prefilledTradeIns.push({
          id: Math.random().toString(), brand: 'Exchange', model: ti.description,
          imei: '', ram_rom: '', color: '', credit_value: Number(ti.rate).toString(), mrp: '',
        });
      }
    });
    sessionStorage.setItem('convert_proforma', JSON.stringify({
      proforma_id: pData.id, party_id: pData.parties.id,
      discount: pData.discount, trade_ins: prefilledTradeIns,
    }));
    router.push('/sales/new');
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 68px)' }}>
      <div className="flex gap-5 flex-1">
        <div className="flex-1 min-w-0 relative group shadow-2xl shadow-slate-200/50 rounded-lg overflow-hidden">
          <button
            onClick={() => router.push('/proformas')}
            className="absolute top-4 left-4 z-10 h-8 w-8 rounded-full bg-white/70 backdrop-blur-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {isLoading
            ? <InvoiceReviewSkeleton />
            : pData && <InvoiceReview data={getInvoiceData()} status={pData.status} />
          }
        </div>

        {!isLoading && pData && (
          <div className="w-56 shrink-0">
            <InvoiceSidebar
              onDownloadPdf={handleDownloadPdf}
              onDownloadPng={handleDownloadPng}
              isPdfLoading={isPdfLoading}
              isPngLoading={isPngLoading}
              invoiceData={getInvoiceData()}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 px-0.5 mb-1">Quotation</p>
              {pData.status === 'active' ? (
                <SidebarButton
                  icon={ShoppingCart}
                  label="Convert to Sale"
                  onClick={handleConvert}
                  variant="primary"
                />
              ) : (
                <div className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
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
