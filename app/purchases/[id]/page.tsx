'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/platform/supabase/client';
import { ArrowLeft } from 'lucide-react';
import {
  downloadInvoicePdf,
  downloadInvoicePng,
} from '@/domains/invoice/actions/client';
import { buildPurchaseInvoiceData } from '@/domains/invoice/builders';
import { InvoiceReview, InvoiceReviewSkeleton } from '@/components/invoice/InvoiceReview';
import { InvoiceSidebar } from '@/components/invoice/InvoiceSidebar';
import { useToast } from '@/components/ui/Toast';

export default function PurchaseViewPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { error: toastError } = useToast();

  const [purchase, setPurchase] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [storeData, setStoreData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isPngLoading, setIsPngLoading] = useState(false);

  const loadPurchase = async () => {
    if (!id) return;
    try {
      const [{ data, error }, { data: piData }, storeResult] = await Promise.all([
        supabase.from('purchases').select('*, parties (name, number, address)').eq('id', id).single(),
        supabase.from('purchase_items').select('*, inventory_items (brand, model, imei, ram_rom, color, purchase_price)').eq('purchase_id', id),
        supabase.from('store').select('*').limit(1).maybeSingle(),
      ]);
      if (error) throw error;
      setPurchase(data);
      setItems(piData || []);
      setStoreData(storeResult.data || null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadPurchase(); }, [id]);

  const getInvoiceData = () => buildPurchaseInvoiceData({
    purchase, items, store: storeData, template: 'prestige',
  });

  const handleDownloadPdf = async () => {
    if (!purchase) return;
    setIsPdfLoading(true);
    try { await downloadInvoicePdf(getInvoiceData()); }
    catch (e: any) { toastError('PDF Failed', e.message); }
    finally { setIsPdfLoading(false); }
  };

  const handleDownloadPng = async () => {
    if (!purchase) return;
    setIsPngLoading(true);
    try { await downloadInvoicePng(getInvoiceData()); }
    catch (e: any) { toastError('Image Failed', e.message); }
    finally { setIsPngLoading(false); }
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 68px)' }}>
      <div className="flex-none pb-3">
        <button
          onClick={() => router.push('/purchases')}
          className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-5 flex-1">
        <div className="flex-1 min-w-0">
          {isLoading
            ? <InvoiceReviewSkeleton />
            : purchase && <InvoiceReview data={getInvoiceData()} status={purchase.status} />
          }
        </div>

        {!isLoading && purchase && (
          <div className="w-56 shrink-0">
            <InvoiceSidebar
              onDownloadPdf={handleDownloadPdf}
              onDownloadPng={handleDownloadPng}
              isPdfLoading={isPdfLoading}
              isPngLoading={isPngLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
