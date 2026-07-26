'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from 'lucide-react';
import {
  printStoredPdf,
  shareStoredPdf,
  exportStoredPdf,
  openStoredPdfLocation,
  triggerPdfGeneration,
} from '@/lib/invoice/actions/client';
import { InvoiceDocument } from '@/components/invoice/InvoiceDocument';
import { InvoiceSidebar } from '@/components/invoice/InvoiceSidebar';
import { useToast } from '@/components/ui/Toast';

export default function PurchaseViewPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { error: toastError, success: toastSuccess } = useToast();

  const [purchase, setPurchase] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [storeData, setStoreData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);


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

  // ── PDF helpers ─────────────────────────────────────────────────────────────

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await triggerPdfGeneration(id, 'purchase');
      if (result.error) {
        toastError('PDF Error', result.error);
      } else {
        toastSuccess('PDF Generated', 'Invoice PDF has been regenerated.');
        await loadPurchase();
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const handlePrint = async () => {
    await printStoredPdf(purchase?.pdf_path);
  };

  const handleShare = async () => {
    // For purchases: share the stored PDF directly via desktop share or native share API
    setIsSendingWa(true);
    try {
      if (purchase?.pdf_path) {
        await shareStoredPdf(purchase.pdf_path, purchase?.bill_number || 'Purchase Invoice');
      }
    } finally {
      setIsSendingWa(false);
    }
  };

  const handleExport = async () => {
    setIsPdfGenerating(true);
    try {
      await exportStoredPdf(purchase?.pdf_path, `${purchase?.bill_number || 'purchase'}.pdf`);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleOpenFileLocation = () => {
    if (purchase?.pdf_path) openStoredPdfLocation(purchase.pdf_path);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 68px)' }}>
      {/* ── Header strip ── */}
      <div className="flex-none pb-3">
        <button
          onClick={() => router.push('/purchases')}
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
            <InvoiceDocument type="purchase" billNumber="" date="" items={[]} subtotal={0} finalTotal={0} isLoading />
          ) : purchase ? (
            <InvoiceDocument
              type="purchase"
              billNumber={purchase.bill_number}
              date={purchase.date}
              status={purchase.status}
              party={purchase.parties}
              store={storeData}
              items={items.map((line: any) => {
                const inv = line.inventory_items || {};
                const price = Number(inv.purchase_price) || 0;
                const desc = [inv.brand, inv.model].filter(Boolean).join(' ') || 'Item';
                const detail = [inv.imei, inv.ram_rom, inv.color].filter(Boolean).join(' · ') || undefined;
                return { description: desc, detail, qty: 1, rate: price, amount: price };
              })}
              subtotal={Number(purchase.total) || 0}
              finalTotal={Number(purchase.total) || 0}
              paid={Number(purchase.paid) || 0}
              due={Number(purchase.due) || 0}
            />
          ) : null}
        </div>

        {/* Sidebar — independently scrollable */}
        {!isLoading && purchase && (
          <div className="w-60 shrink-0 overflow-y-auto overflow-x-hidden">
            <InvoiceSidebar
              invoiceId={id}
              type="purchase"
              billNumber={purchase.bill_number}
              date={purchase.date}
              party={purchase.parties}
              status={purchase.status || 'active'}
              template={purchase.pdf_template_version}
              pdfPath={purchase.pdf_path}
              onPrint={handlePrint}
              onShare={handleShare}
              onExport={handleExport}
              onRegenerate={handleRegenerate}
              onOpenFileLocation={handleOpenFileLocation}
              isRegenerating={isRegenerating}
              isSendingWa={isSendingWa}
              isPdfGenerating={isPdfGenerating}
            />
          </div>
        )}
      </div>
    </div>
  );
}
