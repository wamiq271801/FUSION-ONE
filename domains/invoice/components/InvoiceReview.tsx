'use client';

/**
 * InvoiceReview — premium React UI for viewing invoice data.
 *
 * Renders directly from InvoiceData — no PDF, no iframe.
 * PNG export is handled server-side via /api/invoice/png.
 */
import React from 'react';
import { Building2, Phone, Mail, MapPin, Hash, Calendar, User, CheckCircle2, AlertCircle, Clock, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InvoiceData } from '@/lib/invoice/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rs.`;
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const inWords = (n: number): string => {
    let str = '';
    if (n > 99) { str += a[Math.floor(n / 100)] + 'Hundred '; n = n % 100; }
    if (n > 19) { str += b[Math.floor(n / 10)] + ' '; n = n % 10; }
    str += a[n];
    return str;
  };
  let result = '';
  if (num > 9999999) { result += inWords(Math.floor(num / 10000000)) + 'Crore '; num %= 10000000; }
  if (num > 99999)   { result += inWords(Math.floor(num / 100000)) + 'Lakh '; num %= 100000; }
  if (num > 999)     { result += inWords(Math.floor(num / 1000)) + 'Thousand '; num %= 1000; }
  result += inWords(num);
  return result.trim() + ' Rupees Only';
}

// ── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-slate-400 min-w-[72px] shrink-0 font-medium">{label}</span>
      <span className="text-slate-700 font-semibold">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">{children}</p>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === 'active') return null;
  const configs: Record<string, { icon: any; label: string; cls: string }> = {
    cancelled:  { icon: Ban,          label: 'Cancelled',  cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    converted:  { icon: CheckCircle2, label: 'Converted',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    paid:       { icon: CheckCircle2, label: 'Paid',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    partial:    { icon: Clock,        label: 'Partial',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    unpaid:     { icon: AlertCircle,  label: 'Unpaid',     cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  };
  const cfg = configs[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold', cfg.cls)}>
      <Icon className="h-3 w-3" />{cfg.label}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

export function InvoiceReviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="h-5 w-40 bg-slate-100 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
          <div className="h-8 w-28 bg-slate-100 rounded-lg" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="h-3 w-16 bg-slate-100 rounded" />
        <div className="h-4 w-48 bg-slate-100 rounded" />
        <div className="h-3 w-32 bg-slate-100 rounded" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="h-8 bg-slate-50 border-b border-slate-100" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-slate-50">
            <div className="h-3 w-6 bg-slate-100 rounded" />
            <div className="flex-1 h-3 bg-slate-100 rounded" />
            <div className="h-3 w-12 bg-slate-100 rounded" />
            <div className="h-3 w-16 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export interface InvoiceReviewProps {
  data: InvoiceData;
  status?: string;
}

export const InvoiceReview = function InvoiceReview({ data, status }: InvoiceReviewProps) {
  const { store, party, items, trade_ins, type } = data;
  const isProforma = type === 'proforma';
  const typeLabel = isProforma ? 'Quotation' : type === 'sale' ? 'Tax Invoice' : 'Purchase Bill';
  const totalDiscount = (data.item_discount ?? 0) + (data.additional_discount ?? 0);

  return (
    <div className="space-y-3 pb-6">

      {/* ── Header card: Store + Invoice Meta ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Gold accent bar */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            {/* Store info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 overflow-hidden">
                {store?.logo_url ? (
                  <img src={store.logo_url} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-sm font-black text-white tracking-tight">
                    {(store?.name || 'FG').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{store?.name || 'Fusion Gadgets'}</p>
                {store?.gstin && <p className="text-[10px] text-slate-400 font-mono">GSTIN: {store.gstin}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {store?.phone && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Phone className="h-2.5 w-2.5 text-amber-500" />{store.phone}
                    </span>
                  )}
                  {store?.email && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Mail className="h-2.5 w-2.5 text-amber-500" />{store.email}
                    </span>
                  )}
                  {store?.address && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <MapPin className="h-2.5 w-2.5 text-amber-500" />{store.address.split('\n')[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Invoice type label + status */}
            <div className="text-right shrink-0">
              <div className="inline-block bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg mb-1.5">
                {typeLabel}
              </div>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Invoice meta + Party info ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Invoice details */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <SectionLabel>Invoice Details</SectionLabel>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Hash className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="text-xs font-bold text-slate-800 font-mono">{data.bill_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="text-xs text-slate-600">{data.date}</span>
            </div>
          </div>
        </div>

        {/* Party info */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <SectionLabel>{type === 'purchase' ? 'Received From' : 'Bill To'}</SectionLabel>
          <div className="flex items-start gap-2">
            <User className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-800">{party?.name || 'Cash Customer'}</p>
              {party?.number && <p className="text-[10px] text-slate-500 mt-0.5">{party.number}</p>}
              {party?.address && <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{party.address.split('\n')[0]}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Items table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-2">
          <Building2 className="h-3 w-3 text-amber-400" />
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Items</p>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-400">
          <span className="w-5">#</span>
          <span>Description</span>
          <span className="w-14 text-center">Qty</span>
          <span className="w-20 text-right">Rate (MRP)</span>
          <span className="w-20 text-right">Amount</span>
        </div>

        {items.map((item, idx) => {
          const desc = item.description || [item.brand, item.model].filter(Boolean).join(' ') || 'Item';
          const detail = [item.ram_rom, item.color, item.imei ? `IMEI: ${item.imei}` : null].filter(Boolean).join(' · ');
          const amount = item.value ?? ((item.rate ?? 0) * (item.qty ?? 1) - (item.discount ?? 0));
          return (
            <div
              key={idx}
              className={cn(
                'grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-4 py-3 text-xs',
                idx < items.length - 1 && 'border-b border-slate-100'
              )}
            >
              <span className="w-5 text-slate-400 font-mono text-[10px] pt-0.5">{idx + 1}</span>
              <div>
                <p className="font-semibold text-slate-800 leading-tight">{desc}</p>
                {detail && <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{detail}</p>}
                {Number(item.discount) > 0 && (
                  <p className="text-[10px] text-rose-500 mt-0.5">Disc: − {fmt(item.discount!)}</p>
                )}
              </div>
              <span className="w-14 text-center text-slate-600">{item.qty ?? 1}</span>
              <span className="w-20 text-right text-slate-600">{fmt(item.rate ?? 0)}</span>
              <span className="w-20 text-right font-semibold text-slate-800">{fmt(amount)}</span>
            </div>
          );
        })}
      </div>

      {/* ── Trade-ins table ── */}
      {trade_ins && trade_ins.length > 0 && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
          <div className="bg-emerald-700 px-4 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-100">Trade-In</p>
          </div>
          <div className="grid grid-cols-[auto_1fr_auto] gap-2 px-4 py-2 bg-emerald-50 border-b border-emerald-100 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
            <span className="w-5">#</span>
            <span>Device</span>
            <span className="w-24 text-right">Credit</span>
          </div>
          {trade_ins.map((ti, idx) => {
            const desc = ti.description || [ti.brand, ti.model].filter(Boolean).join(' ') || 'Trade-In';
            const credit = (ti.qty ?? 1) * (ti.rate ?? ti.credit_value ?? 0);
            return (
              <div
                key={idx}
                className={cn(
                  'grid grid-cols-[auto_1fr_auto] gap-2 px-4 py-3 text-xs',
                  idx < trade_ins.length - 1 && 'border-b border-emerald-100'
                )}
              >
                <span className="w-5 text-emerald-400 font-mono text-[10px] pt-0.5">{idx + 1}</span>
                <div>
                  <p className="font-semibold text-emerald-800 leading-tight">{desc}</p>
                  {ti.imei && <p className="text-[10px] text-emerald-600 font-mono mt-0.5">IMEI: {ti.imei}</p>}
                </div>
                <span className="w-24 text-right font-semibold text-emerald-700">{fmt(credit)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Totals + Amount in Words ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-8">
          {/* Amount in words */}
          <div className="flex-1">
            <SectionLabel>Amount in Words</SectionLabel>
            <p className="text-xs italic text-slate-600 leading-relaxed">
              {numberToWords(Math.round(data.final_total))}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <SectionLabel>Terms &amp; Conditions</SectionLabel>
              <ul className="space-y-0.5">
                <li className="text-[10px] text-slate-500">1. Goods once sold will not be taken back or exchanged.</li>
                <li className="text-[10px] text-slate-500">2. Warranty as per manufacturer terms.</li>
                <li className="text-[10px] text-slate-500">3. Thank you for doing business with us.</li>
              </ul>
            </div>
          </div>

          {/* Totals */}
          <div className="w-full sm:w-56 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span><span className="font-mono">{fmt(data.subtotal)}</span>
            </div>

            {(data.item_discount ?? 0) > 0 && (data.additional_discount ?? 0) > 0 && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>Product Discount</span>
                <span className="font-mono text-rose-500">− {fmt(data.item_discount!)}</span>
              </div>
            )}

            {(data.additional_discount ?? 0) > 0 && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>Additional Discount</span>
                <span className="font-mono text-rose-500">− {fmt(data.additional_discount!)}</span>
              </div>
            )}

            {totalDiscount > 0 && (
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Total Discount</span>
                <span className="font-mono text-rose-500">− {fmt(totalDiscount)}</span>
              </div>
            )}

            {(data.trade_in_credit ?? 0) > 0 && (
              <div className="flex justify-between text-xs text-emerald-600">
                <span>Trade-In</span>
                <span className="font-mono">− {fmt(data.trade_in_credit!)}</span>
              </div>
            )}

            {/* Grand total */}
            <div className="flex justify-between items-center bg-slate-900 text-white rounded-xl px-3 py-2.5 mt-2">
              <span className="text-[10px] font-black uppercase tracking-widest">Grand Total</span>
              <span className="text-sm font-bold font-mono text-amber-400">{fmt(data.final_total)}</span>
            </div>

            {!isProforma && (
              <>
                <div className="pt-1 border-t border-slate-100 space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Amount Received</span><span className="font-mono">{fmt(data.paid)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-slate-800">
                    <span>Balance Due</span>
                    <span className={cn('font-mono', data.due > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                      {fmt(data.due)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Signature ── */}
      {store?.signature_url && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex justify-end">
          <div className="text-center w-36">
            <p className="text-[9px] text-slate-400 mb-3 text-left">For {store.name || 'Fusion Gadgets'}</p>
            <img
              src={store.signature_url}
              alt="Signature"
              className="w-24 h-10 object-contain mx-auto mb-2"
              referrerPolicy="no-referrer"
            />
            <div className="border-t border-slate-900 pt-1.5">
              <p className="text-[9px] font-bold text-slate-800 uppercase tracking-wider">{store.name}</p>
              <p className="text-[8px] text-slate-400">Authorized Signatory</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
