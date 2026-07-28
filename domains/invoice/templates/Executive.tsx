import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { InvoiceData } from '../types';

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
  navy: '#0F2C59',
  navyLight: '#E8EDF2',
  grayText: '#4B5563',
  grayBorder: '#D1D5DB',
  black: '#111827',
  white: '#FFFFFF'
};

// ─── Stylesheet ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: C.black,
    backgroundColor: C.white,
    lineHeight: 1.4,
    padding: 40,
    paddingBottom: 60,
  },
  
  // ── HEADER ──
  headerBorder: { height: 4, backgroundColor: C.navy, position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, paddingTop: 10 },
  
  logoContainer: { width: 50, height: 50, justifyContent: 'center' },
  logoImage: { width: 50, height: 50, objectFit: 'contain' },
  logoMark: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.navy },
  
  docInfo: { alignItems: 'flex-end' },
  docTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: C.navy, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  docNumber: { fontSize: 10, color: C.grayText },
  docDate: { fontSize: 10, color: C.grayText },
  
  // ── STORE & CUSTOMER ──
  detailsSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  detailsBox: { width: '45%' },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.navy, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: C.navy, paddingBottom: 4, marginBottom: 8 },
  nameText: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  addressText: { fontSize: 9, color: C.grayText, marginBottom: 2 },
  
  // ── TABLE ──
  table: { marginBottom: 20 },
  tHeadRow: { flexDirection: 'row', backgroundColor: C.navy, paddingVertical: 6, paddingHorizontal: 4 },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.white, textTransform: 'uppercase' },
  tRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.grayBorder },
  td: { fontSize: 9 },
  
  col1: { width: '5%', textAlign: 'center' },
  col2: { width: '45%', textAlign: 'left' },
  col3: { width: '10%', textAlign: 'center' },
  col4: { width: '13%', textAlign: 'right' },
  col5: { width: '13%', textAlign: 'right' },
  col6: { width: '14%', textAlign: 'right' },
  
  itemDesc: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  itemSub: { fontSize: 8, color: C.grayText },
  
  // ── TRADE IN ──
  tradeInLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 6 },
  tradeInRow: { flexDirection: 'row', backgroundColor: C.navyLight, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.grayBorder },
  
  // ── SUMMARY ──
  summarySection: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  notesBox: { width: '50%' },
  notesLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 4 },
  amountWords: { fontSize: 9, fontStyle: 'italic', marginBottom: 12 },
  termsText: { fontSize: 8, color: C.grayText, marginBottom: 2 },
  
  totalsBox: { width: '40%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 9, color: C.grayText },
  totalValue: { fontSize: 9, textAlign: 'right' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, backgroundColor: C.navyLight, paddingHorizontal: 8, marginTop: 4, marginBottom: 4 },
  grandTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy },
  grandTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, textAlign: 'right' },
  
  // ── SIGNATURE ──
  signatureSection: { marginTop: 40, alignItems: 'flex-end' },
  signatureBox: { width: 150, alignItems: 'center' },
  signatureImage: { width: 100, height: 35, objectFit: 'contain', marginBottom: 5 },
  signatureLine: { width: '100%', borderTopWidth: 1, borderTopColor: C.navy, marginBottom: 4 },
  signatureName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.navy },
  signatureRole: { fontSize: 8, color: C.grayText },
  
  // ── FOOTER ──
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', borderTopWidth: 1, borderTopColor: C.grayBorder, paddingTop: 10 },
  footerText: { fontSize: 8, color: C.grayText }
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExecutiveTemplate({ data }: { data: InvoiceData }) {
  const title =
    data.type === 'proforma' ? 'QUOTATION' :
      data.type === 'purchase' ? 'PURCHASE BILL' :
        'TAX INVOICE';
        
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBorder} />
        
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={s.logoContainer}>
              {data.store?.logo_url ? (
                <Image src={data.store.logo_url} style={s.logoImage} />
              ) : (
                <Text style={s.logoMark}>
                  {(data.store?.name || 'FG').substring(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={s.nameText}>{data.store?.name || 'FUSION GADGETS'}</Text>
              {data.store?.gstin && <Text style={s.addressText}>GSTIN: {data.store.gstin}</Text>}
            </View>
          </View>

          <View style={s.docInfo}>
            <Text style={s.docTitle}>{title}</Text>
            <Text style={s.docNumber}>Invoice No: {data.bill_number}</Text>
            <Text style={s.docDate}>Date: {data.date}</Text>
          </View>
        </View>

        {/* ── STORE & CUSTOMER DETAILS ── */}
        <View style={s.detailsSection}>
          <View style={s.detailsBox}>
            <Text style={s.sectionTitle}>From</Text>
            <Text style={s.nameText}>{data.store?.name || 'FUSION GADGETS'}</Text>
            {data.store?.address && <Text style={s.addressText}>{data.store.address.split('\n').join(', ')}</Text>}
            {data.store?.phone && <Text style={s.addressText}>Phone: {data.store.phone}</Text>}
            {data.store?.email && <Text style={s.addressText}>Email: {data.store.email}</Text>}
          </View>

          <View style={s.detailsBox}>
            <Text style={s.sectionTitle}>{data.type === 'purchase' ? 'Received From' : 'Bill To'}</Text>
            <Text style={s.nameText}>{data.party?.name || 'Cash Customer'}</Text>
            {data.party?.address && (
              <Text style={s.addressText}>{data.party.address.split('\n').join(', ')}</Text>
            )}
            {data.party?.number && <Text style={s.addressText}>Contact: {data.party.number}</Text>}
          </View>
        </View>

        {/* ── ITEMS TABLE ── */}
        <View style={s.table}>
          <View style={s.tHeadRow}>
            <Text style={[s.th, s.col1]}>#</Text>
            <Text style={[s.th, s.col2]}>Description</Text>
            <Text style={[s.th, s.col3]}>Qty</Text>
            <Text style={[s.th, s.col4]}>Rate</Text>
            <Text style={[s.th, s.col5]}>Discount</Text>
            <Text style={[s.th, s.col6]}>Amount</Text>
          </View>

          {data.items.map((item, idx) => (
            <View key={idx} style={s.tRow}>
              <Text style={[s.td, s.col1]}>{idx + 1}</Text>
              <View style={s.col2}>
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
              <Text style={[s.td, s.col3]}>{item.qty || 1}</Text>
              <Text style={[s.td, s.col4]}>{fmt(item.rate || item.price || 0)}</Text>
              <Text style={[s.td, s.col5]}>
                {Number(item.discount) > 0 ? `\u2212 ${fmt(item.discount || 0)}` : '\u2014'}
              </Text>
              <Text style={[s.td, s.col6]}>{fmt(item.value || item.price || 0)}</Text>
            </View>
          ))}
        </View>

        {/* ── TRADE-IN TABLE ── */}
        {data.trade_ins && data.trade_ins.length > 0 && (
          <View style={s.table}>
            <Text style={s.tradeInLabel}>Trade-In Details</Text>
            <View style={s.tHeadRow}>
              <Text style={[s.th, s.col1]}>#</Text>
              <Text style={[s.th, s.col2]}>Trade-In Description</Text>
              <Text style={[s.th, s.col3]}>Qty</Text>
              <Text style={[s.th, s.col4]}> </Text>
              <Text style={[s.th, s.col5]}> </Text>
              <Text style={[s.th, s.col6]}>Credit</Text>
            </View>

            {data.trade_ins.map((item, idx) => (
              <View key={idx} style={s.tradeInRow}>
                <Text style={[s.td, s.col1]}>{idx + 1}</Text>
                <View style={s.col2}>
                  <Text style={s.itemDesc}>
                    {item.description || `${item.brand || ''} ${item.model || ''}`.trim()}
                  </Text>
                  {item.imei && <Text style={s.itemSub}>IMEI: {item.imei}</Text>}
                </View>
                <Text style={[s.td, s.col3]}>{item.qty ? item.qty : ''}</Text>
                <Text style={[s.td, s.col4]}> </Text>
                <Text style={[s.td, s.col5]}> </Text>
                <Text style={[s.td, s.col6]}>
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
            <Text style={s.amountWords}>{numberToWords(Math.round(data.final_total))}</Text>
            <Text style={s.notesLabel}>Terms &amp; Conditions</Text>
            <Text style={s.termsText}>1. Goods once sold will not be taken back or exchanged.</Text>
            <Text style={s.termsText}>2. Warranty as per manufacturer terms.</Text>
            <Text style={s.termsText}>3. Subject to local jurisdiction.</Text>
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
                <Text style={s.totalLabel}>Trade-In Deduction</Text>
                <Text style={s.totalValue}>{'\u2212'} {fmt(Number(data.trade_in_credit) || 0)}</Text>
              </View>
            )}

            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalLabel}>Grand Total</Text>
              <Text style={s.grandTotalValue}>{fmt(data.final_total)}</Text>
            </View>

            {data.type !== 'proforma' && (
              <>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Amount Paid</Text>
                  <Text style={s.totalValue}>{fmt(data.paid)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={[s.totalLabel, { fontFamily: 'Helvetica-Bold', color: C.black }]}>Balance Due</Text>
                  <Text style={[s.totalValue, { fontFamily: 'Helvetica-Bold', color: C.black }]}>{fmt(data.due)}</Text>
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
            <Text style={s.signatureName}>For {data.store?.name || 'Fusion Gadgets'}</Text>
            <Text style={s.signatureRole}>Authorized Signatory</Text>
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            This is a computer-generated document. No signature required if digitally authenticated.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
