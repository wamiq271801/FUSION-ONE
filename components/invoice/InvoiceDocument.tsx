'use client';

import React from 'react';
import { Phone, Mail, MapPin } from 'lucide-react';

export interface DocumentLineItem {
  description: string;
  detail?: string;
  qty: number;
  rate: number;
  discount?: number;
  amount: number;
  brand?: string;
  model?: string;
  imei?: string;
  ram_rom?: string;
  color?: string;
}

export interface DocumentTradeIn {
  description: string;
  detail?: string;
  value: number;
  brand?: string;
  model?: string;
  imei?: string;
  qty?: number;
  credit_value?: number;
  rate?: number;
}

export interface InvoiceDocumentProps {
  type: 'sale' | 'purchase' | 'proforma';
  billNumber: string;
  date: string;
  status?: string;
  party?: { name?: string; number?: string; address?: string } | null;
  store?: { name?: string; phone?: string; email?: string; address?: string; gstin?: string; logo_url?: string; signature_url?: string } | null;
  items: DocumentLineItem[];
  subtotal: number;
  itemDiscount?: number;
  additionalDiscount?: number;
  tradeInCredit?: number;
  finalTotal: number;
  paid?: number;
  due?: number;
  tradeIns?: DocumentTradeIn[];
  isLoading?: boolean;
}

function fmt(n: number) {
  return `${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rs.`;
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number) => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + 'Hundred ';
      n = n % 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ';
      n = n % 10;
    }
    str += a[n];
    return str;
  };

  let result = '';
  if (num > 9999999) {
    result += inWords(Math.floor(num / 10000000)) + 'Crore ';
    num %= 10000000;
  }
  if (num > 99999) {
    result += inWords(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }
  if (num > 999) {
    result += inWords(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  result += inWords(num);
  return result.trim() + ' Rupees Only';
}

function DocumentSkeleton() {
  return (
    <div className="h-full overflow-auto bg-[#e8e8e8] py-8">
      <div className="w-[794px] min-h-[1123px] mx-auto bg-white shadow-lg animate-pulse" />
    </div>
  );
}

export function InvoiceDocument({
  type,
  billNumber,
  date,
  party,
  store,
  items,
  subtotal,
  itemDiscount,
  additionalDiscount,
  tradeInCredit,
  finalTotal,
  paid,
  due,
  tradeIns,
  isLoading = false,
}: InvoiceDocumentProps) {
  if (isLoading) return <DocumentSkeleton />;

  const isProforma = type === 'proforma';
  const title = isProforma ? 'QUOTATION' : (type === 'sale' ? 'TAX INVOICE' : 'PURCHASE BILL');
  
  const totalDiscount = (itemDiscount || 0) + (additionalDiscount || 0);

  return (
    <div className="h-full overflow-auto bg-[#e8e8e8] py-8 flex justify-center">
      <div 
        className="bg-white shadow-lg relative"
        style={{ width: '794px', minHeight: '1123px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#111111' }}
      >
        <div style={{ height: '3px', backgroundColor: '#C9A227' }} />

        {/* ── HEADER ── */}
        <div className="flex justify-between items-center" style={{ padding: '21px 44px 19px', borderBottom: '2px solid #111111' }}>
          <div className="flex items-center">
            <div className="flex items-center justify-center shrink-0" style={{ width: '48px', height: '48px', border: '1.5px solid #111111', marginRight: '13px' }}>
              {store?.logo_url ? (
                <img src={store.logo_url} alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#111111' }}>
                  {(store?.name || 'FG').substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <span style={{ fontSize: '18.5px', fontWeight: 'bold', color: '#111111', lineHeight: '1.2' }}>{store?.name || 'FUSION GADGETS'}</span>
              {store?.gstin && (
                <span style={{ fontSize: '9px', color: '#6B7280', marginTop: '2.5px', lineHeight: '1.4' }}>GSTIN: {store.gstin}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end">
            {(store?.phone || '8881181000') && (
              <div className="flex items-center" style={{ marginBottom: '3px' }}>
                <Phone size={13} color="#C9A227" strokeWidth={2} style={{ marginRight: '5px' }} />
                <span style={{ fontSize: '9px', color: '#6B7280', textAlign: 'right' }}>{store?.phone || '8881181000'}</span>
              </div>
            )}
            {(store?.email || 'fusion@example.com') && (
              <div className="flex items-center" style={{ marginBottom: '3px' }}>
                <Mail size={13} color="#C9A227" strokeWidth={2} style={{ marginRight: '5px' }} />
                <span style={{ fontSize: '9px', color: '#6B7280', textAlign: 'right' }}>{store?.email || 'fusion@example.com'}</span>
              </div>
            )}
            {(store?.address || 'Mumbai, India') && (
              <div className="flex items-center">
                <MapPin size={13} color="#C9A227" strokeWidth={2} style={{ marginRight: '5px' }} />
                <span style={{ fontSize: '9px', color: '#6B7280', textAlign: 'right' }}>
                  {(store?.address || 'Mumbai, India').split('\n').join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── BILLING + INVOICE META ── */}
        <div className="flex justify-between items-start" style={{ padding: '32px 44px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ width: '48%' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#C9A227', marginBottom: '10px', letterSpacing: '1.2px' }}>
              {type === 'purchase' ? 'Received From' : 'Bill To'}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111111', marginBottom: '6px', lineHeight: '1.3' }}>
              {party?.name || 'Cash Customer'}
            </div>
            {party?.address && (
              <div style={{ fontSize: '9.5px', color: '#6B7280', marginBottom: '8px', lineHeight: '1.6' }}>
                {party.address.split('\n').join(', ')}
              </div>
            )}
            {party?.number && (
              <div className="flex" style={{ marginBottom: '4px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#111111', width: '72px' }}>Contact No.</div>
                <div style={{ fontSize: '9.5px', color: '#6B7280', flex: 1 }}>{party.number}</div>
              </div>
            )}
          </div>

          <div style={{ width: '1px', backgroundColor: '#E5E7EB', margin: '0 16px', alignSelf: 'stretch' }} />

          <div className="flex flex-col" style={{ width: '42%' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', textTransform: 'uppercase', color: '#111111', marginBottom: '18px', lineHeight: '1' }}>
              {title}
            </div>
            <div className="flex items-start" style={{ padding: '4px 0' }}>
              <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: '#111111', width: '90px', lineHeight: '1.5', letterSpacing: '0.5px' }}>
                Invoice No.
              </div>
              <div style={{ fontSize: '9.5px', color: '#6B7280', flex: 1, lineHeight: '1.5' }}>
                {billNumber}
              </div>
            </div>
            <div className="flex items-start" style={{ padding: '4px 0' }}>
              <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: '#111111', width: '90px', lineHeight: '1.5', letterSpacing: '0.5px' }}>
                Date
              </div>
              <div style={{ fontSize: '9.5px', color: '#6B7280', flex: 1, lineHeight: '1.5' }}>
                {date}
              </div>
            </div>
          </div>
        </div>

        {/* ── ITEMS TABLE ── */}
        <div style={{ padding: '0 44px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#6B7280', paddingTop: '20px', paddingBottom: '10px', letterSpacing: '1.2px' }}>
            Items Purchased
          </div>
          
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#111111' }}>
                <th style={{ width: '5%', padding: '10px 12px', fontSize: '9px', fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left' }}>#</th>
                <th style={{ width: '44%', padding: '10px 12px', fontSize: '9px', fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left' }}>Item Description</th>
                <th style={{ width: '9%', padding: '10px 12px', fontSize: '9px', fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '16%', padding: '10px 12px', fontSize: '9px', fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'right' }}>Rate (MRP)</th>
                <th style={{ width: '11%', padding: '10px 12px', fontSize: '9px', fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'right' }}>Discount</th>
                <th style={{ width: '15%', padding: '10px 12px', fontSize: '9px', fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: idx === items.length - 1 ? 'none' : '1px solid #E5E7EB' }}>
                  <td style={{ padding: '14px 12px', fontSize: '9.5px', color: '#111111', verticalAlign: 'top', textAlign: 'left' }}>{idx + 1}</td>
                  <td style={{ padding: '14px 12px', verticalAlign: 'top', textAlign: 'left' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#111111', marginBottom: '3px' }}>
                      {item.description}
                    </div>
                    {item.detail && (
                      <div style={{ fontSize: '8.5px', color: '#6B7280', lineHeight: '1.5' }}>
                        {item.detail}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 12px', fontSize: '9.5px', color: '#111111', verticalAlign: 'top', textAlign: 'center' }}>{item.qty || 1}</td>
                  <td style={{ padding: '14px 12px', fontSize: '9.5px', color: '#111111', verticalAlign: 'top', textAlign: 'right' }}>{fmt(item.rate)}</td>
                  <td style={{ padding: '14px 12px', fontSize: '9.5px', color: '#111111', verticalAlign: 'top', textAlign: 'right' }}>
                    {Number(item.discount) > 0 ? `− ${fmt(item.discount || 0)}` : '—'}
                  </td>
                  <td style={{ padding: '14px 12px', fontSize: '9.5px', color: '#111111', verticalAlign: 'top', textAlign: 'right' }}>{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── TRADE-IN TABLE ── */}
        {tradeIns && tradeIns.length > 0 && (
          <div style={{ padding: '0 44px' }}>
            <div className="flex items-center" style={{ paddingTop: '16px', paddingBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#2D6A35', letterSpacing: '1.2px', marginRight: '8px' }}>
                Trade-In
              </div>
            </div>

            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F6FBF6', borderTop: '1.5px solid #2D6A35' }}>
                  <th style={{ width: '5%', padding: '10px 12px', fontSize: '9px', fontWeight: 'bold', color: '#2D6A35', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left' }}>#</th>
                  <th style={{ width: '44%', padding: '10px 12px', fontSize: '9px', fontWeight: 'bold', color: '#2D6A35', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left' }}>Description</th>
                  <th style={{ width: '9%', padding: '10px 12px', fontSize: '9px', fontWeight: 'bold', color: '#2D6A35', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'center' }}>Qty</th>
                  <th style={{ width: '16%', padding: '10px 12px' }}></th>
                  <th style={{ width: '11%', padding: '10px 12px' }}></th>
                  <th style={{ width: '15%', padding: '10px 12px', fontSize: '9px', fontWeight: 'bold', color: '#2D6A35', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {tradeIns.map((item, idx) => (
                  <tr key={idx} style={{ backgroundColor: '#F6FBF6', borderBottom: idx === tradeIns.length - 1 ? 'none' : '1px solid #D1EAD4' }}>
                    <td style={{ padding: '14px 12px', fontSize: '9.5px', color: '#2D6A35', verticalAlign: 'top', textAlign: 'left' }}>{idx + 1}</td>
                    <td style={{ padding: '14px 12px', verticalAlign: 'top', textAlign: 'left' }}>
                      <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#2D6A35', marginBottom: '3px' }}>
                        {item.description}
                      </div>
                      {item.detail && (
                        <div style={{ fontSize: '8.5px', color: '#4B8B55', lineHeight: '1.5' }}>
                          IMEI: {item.detail}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: '9.5px', color: '#2D6A35', verticalAlign: 'top', textAlign: 'center' }}>{item.qty || 1}</td>
                    <td style={{ padding: '14px 12px' }}></td>
                    <td style={{ padding: '14px 12px' }}></td>
                    <td style={{ padding: '14px 12px', fontSize: '9.5px', color: '#2D6A35', verticalAlign: 'top', textAlign: 'right' }}>
                      {fmt(item.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── SUMMARY ── */}
        <div className="flex justify-between items-start" style={{ padding: '28px 44px 32px', borderTop: '1px solid #E5E7EB', marginTop: '20px' }}>
          <div style={{ width: '50%', paddingRight: '32px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: '6px', letterSpacing: '1.2px' }}>
              Amount in Words
            </div>
            <div style={{ fontSize: '9.5px', fontStyle: 'italic', color: '#111111', marginBottom: '20px', lineHeight: '1.5' }}>
              {numberToWords(Math.round(finalTotal))}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: '6px', letterSpacing: '1.2px' }}>
              Terms & Conditions
            </div>
            <div style={{ fontSize: '8.5px', color: '#6B7280', lineHeight: '1.7' }}>1. Goods once sold will not be taken back or exchanged.</div>
            <div style={{ fontSize: '8.5px', color: '#6B7280', lineHeight: '1.7' }}>2. Warranty as per manufacturer terms.</div>
            <div style={{ fontSize: '8.5px', color: '#6B7280', lineHeight: '1.7' }}>3. Thank you for doing business with us.</div>
          </div>

          <div style={{ width: '44%' }}>
            <div className="flex justify-between items-end" style={{ padding: '6px 0' }}>
              <div style={{ fontSize: '9.5px', color: '#6B7280' }}>Subtotal</div>
              <div style={{ fontSize: '9.5px', color: '#111111' }}>{fmt(subtotal)}</div>
            </div>

            {Number(itemDiscount) > 0 && Number(additionalDiscount) > 0 && (
              <div className="flex justify-between items-end" style={{ padding: '6px 0' }}>
                <div style={{ fontSize: '9.5px', color: '#6B7280' }}>Product Discount</div>
                <div style={{ fontSize: '9.5px', color: '#111111' }}>− {fmt(itemDiscount || 0)}</div>
              </div>
            )}

            {Number(additionalDiscount) > 0 && (
              <div className="flex justify-between items-end" style={{ padding: '6px 0' }}>
                <div style={{ fontSize: '9.5px', color: '#6B7280' }}>Additional Discount</div>
                <div style={{ fontSize: '9.5px', color: '#111111' }}>− {fmt(additionalDiscount || 0)}</div>
              </div>
            )}

            {totalDiscount > 0 && (
              <div className="flex justify-between items-end" style={{ padding: '6px 0' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#6B7280' }}>Total Discount</div>
                <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#111111' }}>− {fmt(totalDiscount)}</div>
              </div>
            )}

            {Number(tradeInCredit) > 0 && (
              <div className="flex justify-between items-end" style={{ padding: '6px 0' }}>
                <div style={{ fontSize: '9.5px', color: '#6B7280' }}>Trade-In Deduction</div>
                <div style={{ fontSize: '9.5px', color: '#111111' }}>− {fmt(tradeInCredit || 0)}</div>
              </div>
            )}

            <div className="flex justify-between items-center" style={{ backgroundColor: '#111111', padding: '14px 16px', margin: '12px 0' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '1px' }}>Grand Total</div>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#C9A227', letterSpacing: '0.5px' }}>{fmt(finalTotal)}</div>
            </div>

            {!isProforma && (
              <>
                <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '8px 0' }} />
                <div className="flex justify-between items-end" style={{ padding: '6px 0' }}>
                  <div style={{ fontSize: '9.5px', color: '#6B7280' }}>Amount Received</div>
                  <div style={{ fontSize: '9.5px', color: '#111111' }}>{fmt(paid || 0)}</div>
                </div>
                <div className="flex justify-between items-end" style={{ padding: '6px 0' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#111111' }}>Balance Due</div>
                  <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#111111' }}>{fmt(due || 0)}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── SIGNATURE ── */}
        <div className="flex justify-end" style={{ padding: '0 44px 36px' }}>
          <div className="flex flex-col items-center" style={{ width: '190px' }}>
            <div style={{ fontSize: '9px', fontStyle: 'italic', color: '#6B7280', marginBottom: '42px', alignSelf: 'flex-start' }}>
              For {store?.name || 'Fusion Gadgets'}
            </div>
            {store?.signature_url && (
              <img src={store.signature_url} alt="Signature" style={{ width: '100px', height: '40px', objectFit: 'contain', marginBottom: '5px' }} />
            )}
            <div style={{ width: '100%', borderTop: '1px solid #111111', marginBottom: '7px' }} />
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#111111', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'center' }}>
              {store?.name || 'Fusion Gadgets'}
            </div>
            <div style={{ fontSize: '8px', color: '#6B7280', textAlign: 'center', marginTop: '2px' }}>
              Authorized Signatory
            </div>
          </div>
        </div>

        {/* ── FOOTER (Absolute positioning inside relative container) ── */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between items-center" style={{ backgroundColor: '#111111', padding: '10px 44px' }}>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#C9A227', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {store?.name || 'Fusion Gadgets'}
          </div>
          <div style={{ fontSize: '8px', color: '#6B7280' }}>
            This is a computer-generated invoice. No signature required if digitally authenticated.
          </div>
        </div>

      </div>
    </div>
  );
}
