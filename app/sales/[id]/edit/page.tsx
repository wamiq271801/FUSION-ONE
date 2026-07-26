'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFinancialYear } from '@/components/providers/FinancialYearProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import {
  ArrowLeft,
  AlertTriangle,
  Info,
  Lock,
  RefreshCw,
  Save,
} from 'lucide-react';
import { triggerPdfGeneration } from '@/lib/invoice/actions/client';

interface SaleItem {
  sale_item_id: string;
  inventory_item_id: string;
  brand: string;
  model: string;
  imei: string;
  ram_rom: string;
  color: string;
  base_selling_price: number;
  sold_price: string; // editable
}

interface TradeIn {
  id: string;
  brand: string;
  model: string;
  imei: string;
  credit_value: number;
  mrp: number | null;
}

export default function EditSalePage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { selectedYear, isReadOnly, isLoading: fyLoading } = useFinancialYear();
  const { error, success } = useToast();
  const queryClient = useQueryClient();

  // --- Loading & data state ---
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [originalSale, setOriginalSale] = useState<any>(null);

  // --- Editable form state ---
  const [date, setDate] = useState('');
  const [discount, setDiscount] = useState('');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);

  // --- Load sale data ---
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [
          { data: saleData, error: sErr },
          { data: itemsData, error: iErr },
          { data: tiData },
        ] = await Promise.all([
          supabase
            .from('sales')
            .select('*, parties (id, name, number)')
            .eq('id', id)
            .single(),
          supabase
            .from('sale_items')
            .select(
              'id, sold_price, inventory_item_id, inventory_items (brand, model, imei, ram_rom, color, base_selling_price)'
            )
            .eq('sale_id', id),
          supabase.from('trade_ins').select('*').eq('sale_id', id),
        ]);

        if (sErr) throw sErr;
        if (iErr) throw iErr;

        setOriginalSale(saleData);

        // Guard: cannot edit a cancelled sale
        if (saleData.status === 'cancelled') {
          error('Cannot Edit', 'This invoice has been cancelled and cannot be edited.');
          router.push(`/sales/${id}`);
          return;
        }

        setDate(saleData.date);
        setDiscount(saleData.discount?.toString() || '0');

        setSaleItems(
          (itemsData || []).map((row: any) => ({
            sale_item_id: row.id,
            inventory_item_id: row.inventory_item_id,
            brand: row.inventory_items?.brand || '',
            model: row.inventory_items?.model || '',
            imei: row.inventory_items?.imei || '',
            ram_rom: row.inventory_items?.ram_rom || '',
            color: row.inventory_items?.color || '',
            base_selling_price: Number(row.inventory_items?.base_selling_price) || 0,
            sold_price: row.sold_price?.toString() || '0',
          }))
        );

        setTradeIns(tiData || []);
      } catch (e: any) {
        error('Error', e.message || 'Failed to load sale.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  // --- Guard: redirect if read-only ---
  useEffect(() => {
    if (!fyLoading && isReadOnly) {
      error('Access Denied', 'Cannot edit a sale in a closed financial year.');
      router.push(`/sales/${id}`);
    }
  }, [fyLoading, isReadOnly]);

  // --- Calculated totals ---
  const subtotal = useMemo(
    () => saleItems.reduce((acc, item) => acc + (Number(item.sold_price) || 0), 0),
    [saleItems]
  );

  const totalTradeInCredit = useMemo(
    () => tradeIns.reduce((acc, ti) => acc + Number(ti.credit_value), 0),
    [tradeIns]
  );

  const newFinalTotal = useMemo(
    () => Math.max(0, subtotal - (Number(discount) || 0) - totalTradeInCredit),
    [subtotal, discount, totalTradeInCredit]
  );

  const alreadyPaid = Number(originalSale?.paid) || 0;
  const newDue = useMemo(
    () => Math.max(0, newFinalTotal - alreadyPaid),
    [newFinalTotal, alreadyPaid]
  );

  const isBelowPaid = newFinalTotal < alreadyPaid;
  const hasPaymentWarning = alreadyPaid > 0;

  // --- Handlers ---
  const handleUpdateItemPrice = (sale_item_id: string, price: string) => {
    setSaleItems(prev =>
      prev.map(item => (item.sale_item_id === sale_item_id ? { ...item, sold_price: price } : item))
    );
  };

  const handleSave = async () => {
    if (!originalSale || !selectedYear) return;

    // Validations
    if (!date) { error('Validation', 'Date is required.'); return; }
    if (date < selectedYear.start_date || date > selectedYear.end_date) {
      error('Validation', `Date must be within the financial year (${selectedYear.start_date} to ${selectedYear.end_date}).`);
      return;
    }
    if (Number(discount) < 0) { error('Validation', 'Discount cannot be negative.'); return; }

    for (const item of saleItems) {
      if (Number(item.sold_price) < 0) {
        error('Validation', `Sold price cannot be negative for ${item.brand} ${item.model}.`);
        return;
      }
    }

    if (isBelowPaid) {
      error(
        'Cannot Save',
        `New total (${newFinalTotal.toFixed(2)} Rs.) cannot be less than the already-received payment (${alreadyPaid.toFixed(2)} Rs.).`
      );
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update sale_items sold prices
      for (const item of saleItems) {
        const { error: siErr } = await supabase
          .from('sale_items')
          .update({ sold_price: Number(item.sold_price) })
          .eq('id', item.sale_item_id);
        if (siErr) throw siErr;
      }

      // 2. Update the sale master record
      const { error: saleErr } = await supabase
        .from('sales')
        .update({
          date,
          discount: Number(discount) || 0,
          total: subtotal,
          final_total: newFinalTotal,
          due: newDue,
        })
        .eq('id', id);
      if (saleErr) throw saleErr;

      // 3. Invalidate all caches that depend on sales data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['parties-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['payments-page', selectedYear.id] }),
        queryClient.invalidateQueries({ queryKey: ['accounts-page', selectedYear.id] }),
      ]);

      success('Saved', 'Sale updated successfully.');

      // Fire-and-forget: regenerate PDF with updated data
      triggerPdfGeneration(id, 'sale').catch(() => {});

      router.push(`/sales/${id}`);
    } catch (err: any) {
      error('Error', err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Skeleton loading state ---
  if (isLoading || fyLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-8 bg-slate-100 rounded-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><div className="h-3 w-10 bg-slate-100 rounded" /><div className="h-10 bg-slate-100 rounded-md" /></div>
                <div className="space-y-1.5"><div className="h-3 w-20 bg-slate-100 rounded" /><div className="h-10 bg-slate-100 rounded-md" /></div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="h-4 w-36 bg-slate-100 rounded" />
              {[...Array(2)].map((_, i) => <div key={i} className="h-16 w-full bg-slate-50 border border-slate-100 rounded-lg" />)}
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="h-4 w-28 bg-slate-100 rounded" />
              {[...Array(5)].map((_, i) => <div key={i} className="h-4 w-full bg-slate-100 rounded" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!originalSale) {
    return <div className="text-center py-16 text-xs text-slate-400">Sale not found.</div>;
  }

  const f = (n: number) =>
    `${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Rs.`;

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Back + Title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/sales/${id}`)}
          className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm transition-all shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">
            Edit Sale — {originalSale.bill_number}
          </h1>
          <p className="text-[11px] text-slate-400 mt-1">
            Correct prices, discount, date, or customer. Trade-ins and items list are locked.
          </p>
        </div>
      </div>

      {/* Payment already received warning */}
      {hasPaymentWarning && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-800">Payment Already Received</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              {f(alreadyPaid)} has already been received for this invoice. You can still adjust prices and discount — the system will only update the <strong>Due</strong> amount. The already-received amount and its account transactions will not be changed.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative items-start">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Date & Customer */}
          <Card className="border-slate-200 shadow-sm overflow-visible text-sm relative z-20">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-medium text-slate-700">Date *</label>
                  <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    min={selectedYear?.start_date}
                    max={selectedYear?.end_date}
                  />
                  {alreadyPaid > 0 && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                      <Info className="h-3 w-3 shrink-0" />
                      Existing payment entries keep their original dates.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-700">Customer (Party)</label>
                  <div className="h-10 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 font-medium">
                    {originalSale?.parties?.name || '—'}
                    {originalSale?.parties?.number && (
                      <span className="ml-2 text-slate-400 font-normal text-xs">({originalSale.parties.number})</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                    <Info className="h-3 w-3 shrink-0" />
                    Customer cannot be changed after a sale is created.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sale Items — prices editable, list locked */}
          <Card className="border-slate-200 shadow-sm text-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Sold Items</h3>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                  <Lock className="h-3 w-3" />
                  List is read-only — only prices are editable
                </div>
              </div>

              <div className="space-y-3">
                {saleItems.map(item => {
                  const mrp = item.base_selling_price;
                  const soldNum = Number(item.sold_price) || 0;
                  const disc = Math.max(0, mrp - soldNum);
                  return (
                    <div
                      key={item.sale_item_id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{item.brand} {item.model}</p>
                        <p className="text-xs text-slate-500 font-mono tracking-wide mt-0.5">
                          {item.imei} · {item.ram_rom} · {item.color}
                        </p>
                        {disc > 0 && (
                          <p className="text-[10px] text-rose-500 font-medium mt-1">
                            Discount from MRP: {f(disc)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="space-y-0.5">
                          <label className="text-[10px] font-bold uppercase text-slate-400 block">
                            MRP
                          </label>
                          <p className="text-xs font-mono text-slate-400 h-9 flex items-center px-1">
                            {f(mrp)}
                          </p>
                        </div>
                        <div className="space-y-0.5 relative">
                          <label className="text-[10px] font-bold uppercase text-slate-400 block">
                            Sold Price *
                          </label>
                          <Input
                            type="number"
                            value={item.sold_price}
                            onChange={e => handleUpdateItemPrice(item.sale_item_id, e.target.value)}
                            className="w-32 text-right font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {saleItems.length === 0 && (
                  <div className="text-center py-6 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                    No items found for this sale.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Trade-Ins — fully read-only */}
          {tradeIns.length > 0 && (
            <Card className="border-slate-200 shadow-sm text-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-emerald-600" />
                    Trade-Ins (Exchange)
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                    <Lock className="h-3 w-3" />
                    Cannot be edited after creation
                  </div>
                </div>
                <div className="space-y-3">
                  {tradeIns.map(ti => (
                    <div
                      key={ti.id}
                      className="flex justify-between items-center p-3 border border-emerald-100 bg-emerald-50/50 rounded-lg opacity-80"
                    >
                      <div>
                        <p className="font-medium text-emerald-900">{ti.brand} {ti.model}</p>
                        <p className="text-xs text-emerald-700/80 font-mono tracking-wide mt-0.5">{ti.imei}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-semibold text-emerald-700">
                          -{Number(ti.credit_value).toFixed(2)} Rs.
                        </p>
                        <p className="text-[10px] uppercase font-bold text-emerald-600/70">Credit Value</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />
                  Trade-in credit is locked because it is linked to auto-generated purchase records and inventory.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar — Totals */}
        <div className="lg:col-span-1">
          <Card className="border-slate-200 shadow-sm sticky top-6 text-sm">
            <CardContent className="p-5">
              <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-4">
                Updated Totals
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium text-slate-900">{f(subtotal)}</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Additional Discount</span>
                  </div>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    className="text-right font-mono"
                  />
                </div>

                {totalTradeInCredit > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 border-t border-slate-100 pt-3">
                    <span>Trade-In Credit</span>
                    <span className="font-mono font-medium">- {f(totalTradeInCredit)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-slate-200 mt-2">
                  <span className="font-bold text-slate-900 text-base">Final Total</span>
                  <span className={`text-xl font-mono font-bold ${isBelowPaid ? 'text-rose-600' : 'text-indigo-700'}`}>
                    {f(newFinalTotal)}
                  </span>
                </div>

                {/* Constraint error */}
                {isBelowPaid && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-rose-700">
                      Total cannot be less than the already-received amount of <strong>{f(alreadyPaid)}</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* Payment summary — read-only */}
              <div className="bg-slate-50 -mx-5 px-5 py-4 border-t border-b border-slate-100 space-y-2.5">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-sm font-medium">Already Received</span>
                  <span className="font-mono font-semibold text-emerald-700">{f(alreadyPaid)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-700">New Due</span>
                  <span className={`text-lg font-mono font-bold ${newDue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {f(newDue)}
                  </span>
                </div>
              </div>

              {/* Original amounts for reference */}
              <div className="mt-4 space-y-1.5 p-3 bg-slate-50/80 rounded-lg border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Original Values</p>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Total</span>
                  <span className="font-mono">{f(Number(originalSale.final_total))}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Paid</span>
                  <span className="font-mono">{f(alreadyPaid)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Due</span>
                  <span className="font-mono">{f(Number(originalSale.due))}</span>
                </div>
              </div>

              <div className="mt-5">
                <Button
                  onClick={handleSave}
                  isLoading={isSaving}
                  disabled={isBelowPaid}
                  className="w-full h-11 text-sm font-semibold shadow-sm gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
                <button
                  onClick={() => router.push(`/sales/${id}`)}
                  className="w-full mt-2 h-9 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
