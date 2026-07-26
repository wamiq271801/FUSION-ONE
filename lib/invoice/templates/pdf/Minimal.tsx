import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Svg, Path, Polyline, Circle } from '@react-pdf/renderer';
import type { InvoiceData } from '../../types';

// ─── Business Logic ─────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rs.`;

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

// ─── Design Tokens ──────────────────────────────────────────────────────────

const C = {
  black: '#111827',
  gray700: '#374151',
  gray500: '#6B7280',
  gray300: '#D1D5DB',
  gray100: '#F3F4F6',
  white: '#FFFFFF',
};

// ─── Stylesheet ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: C.gray700,
    backgroundColor: C.white,
    lineHeight: 1.5,
    padding: 40,
    paddingBottom: 60,
  },
  
  // ── HEADER ──
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 },
  logoContainer: { width: 40, height: 40, marginBottom: 8, alignItems: 'flex-start', justifyContent: 'center' },
  logoImage: { width: 40, height: 40, objectFit: 'contain' },
  logoMark: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: C.black },
  storeName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 4 },
  storeText: { fontSize: 9, color: C.gray500, marginBottom: 2 },
  
  docTitleBlock: { alignItems: 'flex-end' },
  documentTitle: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: C.black, letterSpacing: -0.5, marginBottom: 4 },
  invoiceNumber: { fontSize: 10, color: C.gray500 },
  
  // ── BILLING + META ──
  infoSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  infoCol: { width: '45%' },
  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  customerName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 4 },
  customerText: { fontSize: 9, color: C.gray700, marginBottom: 2 },
  
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.gray100, paddingVertical: 6 },
  metaLabel: { fontSize: 9, color: C.gray500 },
  metaValue: { fontSize: 9, color: C.black, fontFamily: 'Helvetica-Bold' },
  
  // ── TABLE ──
  tableSection: { marginBottom: 30 },
  tHeadRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.gray300, paddingBottom: 8, marginBottom: 8 },
  tRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.gray100 },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { fontSize: 9, color: C.black },
  col1: { width: '45%' },
  col2: { width: '10%', textAlign: 'center' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  itemDesc: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 2 },
  itemSub: { fontSize: 8, color: C.gray500 },
  
  // ── TRADE-IN TABLE ──
  tradeInTitleRow: { marginTop: 20, marginBottom: 10 },
  
  // ── SUMMARY ──
  summarySection: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  notesBox: { width: '45%' },
  notesLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  notesText: { fontSize: 9, color: C.gray700, marginBottom: 4, lineHeight: 1.4 },
  amountWords: { fontSize: 9, fontStyle: 'italic', color: C.gray700, marginBottom: 15 },
  
  totalsBox: { width: '40%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalLabel: { fontSize: 9, color: C.gray500 },
  totalValue: { fontSize: 9, color: C.black },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.gray300, borderBottomWidth: 1, borderBottomColor: C.gray300, marginTop: 6, marginBottom: 6 },
  grandTotalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.black },
  grandTotalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.black },
  
  // ── SIGNATURE ──
  signatureSection: { marginTop: 40, alignItems: 'flex-end' },
  signatureBox: { width: 140 },
  signatureImage: { width: 100, height: 35, objectFit: 'contain', marginBottom: 4, alignSelf: 'flex-end' },
  signatureLine: { width: '100%', borderTopWidth: 1, borderTopColor: C.gray300, marginBottom: 6 },
  signatureName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.black, textAlign: 'right' },
  signatureRole: { fontSize: 8, color: C.gray500, textAlign: 'right' },
  
  // ── FOOTER ──
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center' },
  footerText: { fontSize: 8, color: C.gray500 }
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function MinimalTemplate({ data }: { data: InvoiceData }) {
  const title =
    data.type === 'proforma' ? 'Quotation' :
      data.type === 'purchase' ? 'Purchase Bill' :
        'Invoice';
        
  return (
    <Document>
      <Page size="A4" style={s.page}>
        
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View>
            <View style={s.logoContainer}>
              {data.store?.logo_url ? (
                <Image src={data.store.logo_url} style={s.logoImage} />
              ) : (
                <Text style={s.logoMark}>
                  {(data.store?.name || 'FG').substring(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={s.storeName}>{data.store?.name || 'Fusion Gadgets'}</Text>
            {data.store?.address && <Text style={s.storeText}>{data.store.address.split('\n').join(', ')}</Text>}
            {data.store?.phone && <Text style={s.storeText}>{data.store.phone}</Text>}
            {data.store?.email && <Text style={s.storeText}>{data.store.email}</Text>}
            {data.store?.gstin && <Text style={s.storeText}>GSTIN: {data.store.gstin}</Text>}
          </View>

          <View style={s.docTitleBlock}>
            <Text style={s.documentTitle}>{title}</Text>
            <Text style={s.invoiceNumber}>#{data.bill_number}</Text>
          </View>
        </View>

        {/* ── BILLING + INVOICE META ── */}
        <View style={s.infoSection}>
          <View style={s.infoCol}>
            <Text style={s.sectionLabel}>{data.type === 'purchase' ? 'Received From' : 'Bill To'}</Text>
            <Text style={s.customerName}>{data.party?.name || 'Cash Customer'}</Text>
            {data.party?.address && (
              <Text style={s.customerText}>
                {data.party.address.split('\n').join(', ')}
              </Text>
            )}
            {data.party?.number && (
              <Text style={s.customerText}>{data.party.number}</Text>
            )}
          </View>
        </View>

        {/* ── ITEMS TABLE ── */}
        <View style={s.tableSection}>
          <View style={s.tHeadRow}>
            <Text style={[s.th, s.col1, { textAlign: 'left' }]}>Description</Text>
            <Text style={[s.th, s.col2]}>Qty</Text>
            <Text style={[s.th, s.col3]}>Rate</Text>
            <Text style={[s.th, s.col4]}>Discount</Text>
            <Text style={[s.th, s.col5]}>Amount</Text>
          </View>

          {data.items.map((item, idx) => (
            <View key={idx} style={s.tRow}>
              <View style={s.col1}>
                <Text style={s.itemDesc}>
                  {item.description || `${item.brand || ''} ${item.model || ''}`.trim()}
                </Text>
                {(item.ram_rom || item.color || item.imei) && (
                  <Text style={s.itemSub}>
                    {[item.ram_rom, item.color, item.imei ? `IMEI: ${item.imei}` : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                )}
              </View>
              <Text style={[s.td, s.col2]}>{item.qty || 1}</Text>
              <Text style={[s.td, s.col3]}>{fmt(item.rate || item.price || 0)}</Text>
              <Text style={[s.td, s.col4]}>
                {Number(item.discount) > 0 ? `\u2212 ${fmt(item.discount || 0)}` : '\u2014'}
              </Text>
              <Text style={[s.td, s.col5]}>{fmt(item.value || item.price || 0)}</Text>
            </View>
          ))}
        </View>

        {/* ── TRADE-IN TABLE ── */}
        {data.trade_ins && data.trade_ins.length > 0 && (
          <View style={s.tableSection}>
            <View style={s.tradeInTitleRow}>
              <Text style={s.sectionLabel}>Trade-In Deductions</Text>
            </View>
            <View style={s.tHeadRow}>
              <Text style={[s.th, s.col1, { textAlign: 'left' }]}>Item</Text>
              <Text style={[s.th, s.col2]}>Qty</Text>
              <Text style={[s.th, s.col3]}> </Text>
              <Text style={[s.th, s.col4]}> </Text>
              <Text style={[s.th, s.col5]}>Credit</Text>
            </View>

            {data.trade_ins.map((item, idx) => (
              <View key={idx} style={s.tRow}>
                <View style={s.col1}>
                  <Text style={s.itemDesc}>
                    {item.description || `${item.brand || ''} ${item.model || ''}`.trim()}
                  </Text>
                  {item.imei && <Text style={s.itemSub}>IMEI: {item.imei}</Text>}
                </View>
                <Text style={[s.td, s.col2]}>{item.qty ? item.qty : ''}</Text>
                <Text style={[s.td, s.col3]}> </Text>
                <Text style={[s.td, s.col4]}> </Text>
                <Text style={[s.td, s.col5]}>
                  {fmt((item.qty || 1) * (item.rate || item.credit_value || 0))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── SUMMARY ── */}
        <View style={s.summarySection}>
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Amount in Words</Text>
            <Text style={s.amountWords}>
              {numberToWords(Math.round(data.final_total))}
            </Text>
            
            <Text style={s.notesLabel}>Terms</Text>
            <Text style={s.notesText}>1. Goods once sold will not be taken back or exchanged.</Text>
            <Text style={s.notesText}>2. Warranty as per manufacturer terms.</Text>
          </View>

          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{fmt(data.subtotal)}</Text>
            </View>

            {Number(data.additional_discount) > 0 && Number(data.item_discount) > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Product Discount</Text>
                <Text style={s.totalValue}>{'\u2212'} {fmt(Number(data.item_discount) || 0)}</Text>
              </View>
            )}

            {Number(data.additional_discount) > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Additional Discount</Text>
                <Text style={s.totalValue}>{'\u2212'} {fmt(Number(data.additional_discount) || 0)}</Text>
              </View>
            )}

            {Number(data.discount) > 0 && (
              <View style={s.totalRow}>
                <Text style={[s.totalLabel, { fontFamily: 'Helvetica-Bold' }]}>Total Discount</Text>
                <Text style={[s.totalValue, { fontFamily: 'Helvetica-Bold' }]}>{'\u2212'} {fmt(Number(data.discount) || 0)}</Text>
              </View>
            )}

            {Number(data.trade_in_credit) > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Trade-In Credit</Text>
                <Text style={s.totalValue}>{'\u2212'} {fmt(Number(data.trade_in_credit) || 0)}</Text>
              </View>
            )}

            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalLabel}>Total Due</Text>
              <Text style={s.grandTotalValue}>{fmt(data.final_total)}</Text>
            </View>

            {data.type !== 'proforma' && (
              <>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Amount Paid</Text>
                  <Text style={s.totalValue}>{fmt(data.paid)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={[s.totalLabel, { fontFamily: 'Helvetica-Bold', color: C.black }]}>Balance</Text>
                  <Text style={[s.totalValue, { fontFamily: 'Helvetica-Bold' }]}>{fmt(data.due)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── SIGNATURE ── */}
        <View style={s.signatureSection}>
          <View style={s.signatureBox}>
            {data.store?.signature_url && (
              <Image src={data.store.signature_url} style={s.signatureImage} />
            )}
            <View style={s.signatureLine} />
            <Text style={s.signatureName}>{data.store?.name || 'Fusion Gadgets'}</Text>
            <Text style={s.signatureRole}>Authorized Signatory</Text>
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            This is a computer-generated invoice. No signature required if digitally authenticated.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
