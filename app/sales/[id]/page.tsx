'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Pencil, Ban, Trash2, AlertTriangle,
  RefreshCw, X, CheckCircle2, Loader2,
} from 'lucide-react';
import {
  printStoredPdf,
  exportStoredPdf,
  openStoredPdfLocation,
  triggerPdfGeneration,
} from '@/lib/invoice/actions/client';
import { InvoiceDocument } from '@/components/invoice/InvoiceDocument';
import { InvoiceSidebar, SidebarButton } from '@/components/invoice/InvoiceSidebar';
import { useFinancialYear } from '@/components/providers/FinancialYearProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { useWaStatus, useWaSettings, useWaSendInvoice, resolveWaError } from '@/features/whatsapp';
import type { InvoiceData } from '@/lib/invoice/types';
import { useStoreTemplates } from '@/hooks/useStoreTemplates';

export default function SaleViewPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { isReadOnly, selectedYear } = useFinancialYear();
  const { error: toastError, success: toastSuccess } = useToast();
  const queryClient = useQueryClient();
  const { templates } = useStoreTemplates();
  const { data: waStatusData } = useWaStatus();
  const { data: waSettings } = useWaSettings();
  const sendInvoiceMutation = useWaSendInvoice();

  const [sale, setSale] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [tradeIns, setTradeIns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [storeData, setStoreData] = useState<any>(null);


  // Dialogs
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Post-cancel resold trade-in warning
  const [resoldTradeIns, setResoldTradeIns] = useState<any[]>([]);
  const [showResoldWarning, setShowResoldWarning] = useState(false);
  const [isCreatingPurchase, setIsCreatingPurchase] = useState<string | null>(null);

  const loadSale = async () => {
    if (!id) return;
    try {
      const [
        { data: sData, error: sErr },
        { data: siData, error: siErr },
        { data: tiData },
        storeResult,
      ] = await Promise.all([
        supabase.from('sales').select('*, parties (name, number, address)').eq('id', id).single(),
        supabase.from('sale_items').select('sold_price, inventory_item_id, inventory_items (brand, model, imei, ram_rom, color, base_selling_price)').eq('sale_id', id),
        supabase.from('trade_ins').select('*, inventory_items!new_inventory_item_id (id, status)').eq('sale_id', id),
        supabase.from('store').select('*').limit(1).maybeSingle(),
      ]);
      if (sErr) throw sErr;
      if (siErr) throw siErr;
      setSale(sData);
      setItems(siData || []);
      setTradeIns(tiData || []);
      setStoreData(storeResult.data || null);
      const allTradeInsInStock = (tiData || []).every((ti: any) => ti.inventory_items?.status === 'in_stock');
      setCanDelete(Number(sData?.paid) === 0 && allTradeInsInStock);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSale(); }, [id]);

  // ── PDF / invoice helpers ──────────────────────────────────────────────────

  const getInvoiceData = (): InvoiceData => {
    const additionalDiscount = Number(sale.discount) || 0;
    const mappedItems = items.map(line => {
      const basePrice = Number(line.inventory_items?.base_selling_price) || Number(line.sold_price) || 0;
      const soldPrice = Number(line.sold_price) || 0;
      const itemDiscount = Math.max(0, basePrice - soldPrice);
      return { ...line.inventory_items, qty: 1, rate: basePrice, price: basePrice, discount: itemDiscount, value: soldPrice };
    });
    const itemDiscountTotal = mappedItems.reduce((s, i) => s + (i.discount || 0), 0);
    const subtotal = mappedItems.reduce((s, i) => s + (i.rate || 0), 0);
    return {
      type: 'sale', template: templates.sale, store: storeData,
      bill_number: sale.bill_number, date: sale.date, party: sale.parties,
      items: mappedItems, subtotal, item_discount: itemDiscountTotal,
      additional_discount: additionalDiscount, discount: itemDiscountTotal + additionalDiscount,
      trade_in_credit: Number(sale.trade_in_credit),
      final_total: Number(sale.final_total),
      paid: Number(sale.paid), due: Number(sale.due), trade_ins: tradeIns,
    };
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await triggerPdfGeneration(id, 'sale');
      if (result.error) {
        toastError('PDF Error', result.error);
      } else {
        toastSuccess('PDF Generated', 'Invoice PDF has been regenerated.');
        await loadSale();
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const handlePrint = async () => { await printStoredPdf(sale?.pdf_path); };

  const handleShare = async () => {
    if (!sale) return;
    const partyPhone = sale.parties?.number;
    if (!partyPhone) { toastError('Cannot Share', 'Customer has no phone number attached.'); return; }
    if (waStatusData?.status !== 'connected') { toastError('Cannot Share', 'WhatsApp is not connected in Settings.'); return; }
    const template = waSettings?.sale_message_template ?? '';
    setIsSendingWa(true);
    sendInvoiceMutation.mutate(
      { invoiceData: getInvoiceData(), phone: partyPhone, messageTemplate: template },
      {
        onSuccess: () => { toastSuccess('Sent via WhatsApp', `Invoice sent to ${partyPhone}`); setIsSendingWa(false); },
        onError: (err: any) => { const { title, message } = resolveWaError(err); toastError(title, message); setIsSendingWa(false); },
      },
    );
  };

  const handleExport = async () => {
    setIsPdfGenerating(true);
    try { await exportStoredPdf(sale?.pdf_path, `${sale?.bill_number || 'invoice'}.pdf`); }
    finally { setIsPdfGenerating(false); }
  };

  const handleOpenFileLocation = () => { if (sale?.pdf_path) openStoredPdfLocation(sale.pdf_path); };

  // ── Cancel ──────────────────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (!sale || !selectedYear) return;
    setIsCancelling(true);
    const resold: any[] = [];
    try {
      await supabase.from('sales').update({ status: 'cancelled' }).eq('id', id);
      for (const si of items) {
        if (si.inventory_item_id) {
          await supabase.from('inventory_items').update({ status: 'in_stock' }).eq('id', si.inventory_item_id);
        }
      }
      const { data: paymentsIn } = await supabase.from('payments_in').select('id, amount, bank_account_id').eq('sale_id', id);
      for (const pi of paymentsIn || []) {
        await supabase.from('account_transactions').insert({
          bank_account_id: pi.bank_account_id, type: 'debit', amount: pi.amount,
          date: new Date().toISOString().split('T')[0],
          reference_type: 'sale_cancelled', reference_id: id,
          financial_year_id: selectedYear.id,
        });
      }
      for (const ti of tradeIns) {
        const deviceStatus = ti.inventory_items?.status;
        const { data: piRows } = await supabase.from('purchase_items').select('purchase_id').eq('inventory_item_id', ti.new_inventory_item_id).limit(1);
        const purchaseId = piRows?.[0]?.purchase_id;
        if (deviceStatus === 'in_stock') {
          if (purchaseId) {
            await supabase.from('purchase_items').delete().eq('purchase_id', purchaseId);
            await supabase.from('purchases').delete().eq('id', purchaseId);
          }
          await supabase.from('inventory_items').delete().eq('id', ti.new_inventory_item_id);
        } else {
          if (purchaseId) await supabase.from('purchases').update({ status: 'cancelled' }).eq('id', purchaseId);
          resold.push({ ...ti, purchaseId });
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['accounts-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['exchange-page', selectedYear.id] }),
      ]);
      setShowCancelDialog(false);
      toastSuccess('Cancelled', `${sale.bill_number} has been cancelled.`);
      if (resold.length > 0) { setResoldTradeIns(resold); setShowResoldWarning(true); }
      await loadSale();
    } catch (err: any) {
      toastError('Error', err.message || 'Failed to cancel sale.');
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!sale || !selectedYear) return;
    setIsDeleting(true);
    try {
      if (Number(sale.paid) > 0) throw new Error('Cannot delete: payment has already been received.');
      for (const ti of tradeIns) {
        if (ti.inventory_items?.status !== 'in_stock') throw new Error(`Cannot delete: trade-in device has already been resold.`);
      }
      for (const ti of tradeIns) {
        const { data: piRows } = await supabase.from('purchase_items').select('purchase_id').eq('inventory_item_id', ti.new_inventory_item_id).limit(1);
        const purchaseId = piRows?.[0]?.purchase_id;
        if (purchaseId) {
          await supabase.from('purchase_items').delete().eq('purchase_id', purchaseId);
          await supabase.from('purchases').delete().eq('id', purchaseId);
        }
        await supabase.from('inventory_items').delete().eq('id', ti.new_inventory_item_id);
        await supabase.from('trade_ins').delete().eq('id', ti.id);
      }
      for (const si of items) {
        if (si.inventory_item_id) await supabase.from('inventory_items').update({ status: 'in_stock' }).eq('id', si.inventory_item_id);
      }
      await supabase.from('sale_items').delete().eq('sale_id', id);
      await supabase.from('sales').delete().eq('id', id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['exchange-page', selectedYear.id] }),
      ]);
      toastSuccess('Deleted', `${sale.bill_number} has been permanently deleted.`);
      router.push('/sales');
    } catch (err: any) {
      toastError('Cannot Delete', err.message || 'Failed to delete sale.');
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Create replacement purchase for resold trade-in ──────────────────────

  const handleCreatePurchaseBill = async (ti: any) => {
    if (!selectedYear || !sale) return;
    setIsCreatingPurchase(ti.id);
    try {
      const { data: fyData } = await supabase.from('financial_years').select('purchase_counter, start_date, end_date').eq('id', selectedYear.id).single();
      const counter = (fyData?.purchase_counter || 0) + 1;
      const sYear = fyData?.start_date?.slice(2, 4) || '';
      const eYear = fyData?.end_date?.slice(2, 4) || '';
      const billNo = `PUR-${sYear}-${eYear}-${counter.toString().padStart(4, '0')}`;
      const { data: purData, error: purErr } = await supabase.from('purchases').insert({
        bill_number: billNo, party_id: sale.party_id, total: Number(ti.credit_value),
        paid: Number(ti.credit_value), due: 0, bank_account_id: sale.bank_account_id,
        date: new Date().toISOString().split('T')[0], financial_year_id: selectedYear.id, status: 'active',
      }).select().single();
      if (purErr) throw purErr;
      await supabase.from('purchase_items').insert({ purchase_id: purData.id, inventory_item_id: ti.new_inventory_item_id });
      await supabase.from('financial_years').update({ purchase_counter: counter }).eq('id', selectedYear.id);
      setResoldTradeIns(prev => prev.filter(r => r.id !== ti.id));
      if (resoldTradeIns.length <= 1) setShowResoldWarning(false);
      toastSuccess('Created', `Purchase bill ${billNo} created.`);
      queryClient.invalidateQueries({ queryKey: ['purchases-page', selectedYear.id] });
    } catch (err: any) {
      toastError('Error', err.message || 'Failed to create purchase bill.');
    } finally {
      setIsCreatingPurchase(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const isCancelled = sale?.status === 'cancelled';
  const f = (n: number) => `${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.`;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 68px)' }}>
      {/* ── Header strip ── */}
      <div className="flex-none flex flex-col gap-3 pb-3">
        <button
          onClick={() => router.push('/sales')}
          className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Cancellation banner */}
        {!isLoading && isCancelled && (
          <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-5 py-3.5">
            <Ban className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-800">This invoice has been cancelled</p>
              <p className="text-xs text-rose-600 mt-0.5">All sold items have been returned to stock. Cash payments have been reversed in the ledger.</p>
            </div>
          </div>
        )}

        {/* Post-cancel resold trade-in warning */}
        {showResoldWarning && resoldTradeIns.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">Action Required — Trade-In Device Already Sold</p>
                <p className="text-[11px] text-amber-700 mt-0.5">The following trade-in device(s) were already resold. Their auto-purchase bills have been cancelled. Create proper purchase records for them.</p>
              </div>
              <button onClick={() => setShowResoldWarning(false)} className="ml-auto text-amber-500 hover:text-amber-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {resoldTradeIns.map(ti => (
                <div key={ti.id} className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2.5 text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">{ti.brand} {ti.model}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{ti.imei} · Credit: {f(ti.credit_value)}</p>
                  </div>
                  <Button size="sm" onClick={() => handleCreatePurchaseBill(ti)} isLoading={isCreatingPurchase === ti.id} className="text-xs h-7 ml-4 shrink-0">
                    Create Purchase Bill
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Split panel: Invoice document + Sidebar ── */}
      <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">
        {/* Invoice document — fills height, scrolls internally */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <InvoiceDocument type="sale" billNumber="" date="" items={[]} subtotal={0} finalTotal={0} isLoading />
          ) : sale ? (
            <InvoiceDocument
              type="sale"
              billNumber={sale.bill_number}
              date={sale.date}
              status={sale.status}
              party={sale.parties}
              store={storeData}
              items={items.map((line: any) => {
                const base = Number(line.inventory_items?.base_selling_price) || Number(line.sold_price) || 0;
                const sold = Number(line.sold_price) || 0;
                const inv = line.inventory_items || {};
                const desc = [inv.brand, inv.model].filter(Boolean).join(' ') || 'Item';
                const detail = [inv.imei, inv.ram_rom, inv.color].filter(Boolean).join(' · ') || undefined;
                return { description: desc, detail, qty: 1, rate: base, discount: Math.max(0, base - sold), amount: sold };
              })}
              subtotal={items.reduce((s: number, l: any) => s + (Number(l.inventory_items?.base_selling_price) || Number(l.sold_price) || 0), 0)}
              itemDiscount={items.reduce((s: number, l: any) => {
                const base = Number(l.inventory_items?.base_selling_price) || Number(l.sold_price) || 0;
                return s + Math.max(0, base - (Number(l.sold_price) || 0));
              }, 0)}
              additionalDiscount={Number(sale.discount) || 0}
              tradeInCredit={Number(sale.trade_in_credit) || 0}
              finalTotal={Number(sale.final_total)}
              paid={Number(sale.paid)}
              due={Number(sale.due)}
              tradeIns={tradeIns.map((ti: any) => ({
                description: [ti.brand, ti.model].filter(Boolean).join(' ') || 'Trade-In',
                detail: ti.imei || undefined,
                value: Number(ti.credit_value) || 0,
              }))}
            />
          ) : null}
        </div>

        {/* Sidebar — independently scrollable */}
        {!isLoading && sale && (
          <div className="w-60 shrink-0 overflow-y-auto overflow-x-hidden">
          <InvoiceSidebar
            invoiceId={id}
            type="sale"
            billNumber={sale.bill_number}
            date={sale.date}
            party={sale.parties}
            status={sale.status || 'active'}
            template={sale.pdf_template_version}
            pdfPath={sale.pdf_path}
            onPrint={handlePrint}
            onShare={handleShare}
            onExport={handleExport}
            onRegenerate={handleRegenerate}
            onOpenFileLocation={handleOpenFileLocation}
            isRegenerating={isRegenerating}
            isSendingWa={isSendingWa}
            isPdfGenerating={isPdfGenerating}
          >
            {/* Sale-specific: Edit, Cancel, Delete */}
            {!isReadOnly && !isCancelled && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 px-0.5 mb-1">Invoice</p>
                <SidebarButton
                  icon={Pencil}
                  label="Edit Invoice"
                  onClick={() => router.push(`/sales/${id}/edit`)}
                />
                <SidebarButton
                  icon={Ban}
                  label="Cancel Invoice"
                  onClick={() => setShowCancelDialog(true)}
                />
                {canDelete && (
                  <SidebarButton
                    icon={Trash2}
                    label="Delete Permanently"
                    onClick={() => setShowDeleteDialog(true)}
                  />
                )}
              </>
            )}
          </InvoiceSidebar>
          </div>
        )}
      </div>

      {/* ── Cancel Confirmation Dialog ── */}
      {showCancelDialog && sale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Ban className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Cancel Invoice {sale.bill_number}?</h3>
                <p className="text-xs text-slate-500 mt-1">This will mark the invoice as cancelled. The following will happen immediately:</p>
              </div>
            </div>
            <ul className="space-y-1.5 mb-6 pl-2">
              {items.length > 0 && (
                <li className="text-xs text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  {items.length} phone{items.length > 1 ? 's' : ''} returned to stock
                </li>
              )}
              {Number(sale.paid) > 0 && (
                <li className="text-xs text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  {f(sale.paid)} in received payments reversed in ledger
                </li>
              )}
              {tradeIns.length > 0 && (
                <li className="text-xs text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  {tradeIns.length} trade-in device{tradeIns.length > 1 ? 's' : ''} handled
                </li>
              )}
              <li className="text-xs text-slate-600 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                Bill number {sale.bill_number} preserved as a cancellation record
              </li>
            </ul>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCancelDialog(false)} disabled={isCancelling} className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                Keep Invoice
              </button>
              <Button onClick={handleCancel} isLoading={isCancelling} className="bg-amber-600 hover:bg-amber-700 text-xs h-9 px-5">
                Cancel Invoice
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {showDeleteDialog && sale && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-rose-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete {sale.bill_number} Permanently?</h3>
                <p className="text-xs text-slate-500 mt-1">This will completely erase this invoice and all associated records.</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-5 space-y-1.5">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Will be removed</p>
              <p className="text-xs text-slate-600">• This invoice and all {items.length} line item{items.length !== 1 ? 's' : ''}</p>
              {tradeIns.length > 0 && <p className="text-xs text-slate-600">• {tradeIns.length} trade-in device{tradeIns.length > 1 ? 's' : ''} and their purchase records</p>}
              <p className="text-xs text-emerald-700 font-medium mt-2">✓ No payments were received — nothing else is affected</p>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-5">
              <p className="text-xs font-semibold text-rose-800">This action is permanent and cannot be undone.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteDialog(false)} disabled={isDeleting} className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <Button onClick={handleDelete} isLoading={isDeleting} className="bg-rose-600 hover:bg-rose-700 text-xs h-9 px-5">
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
