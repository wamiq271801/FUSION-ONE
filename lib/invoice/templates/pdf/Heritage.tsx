import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
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
  black: '#111111',
  charcoal: '#333333',
  textSecondary: '#666666',
  white: '#FFFFFF',
  goldDark: '#8A702B', // Subdued gold for elegant accents
  borderLight: '#E8E8E8',
};

// ─── Stylesheet ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: 'Times-Roman', // Elegant traditional font
    color: C.black,
    backgroundColor: '#FAFAFA', // Slight off-white for premium paper feel
    lineHeight: 1.5,
    padding: 40,
    paddingBottom: 60,
  },
  
  // ── HEADER ──
  headerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  logoContainer: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  logoImage: { width: 50, height: 50, objectFit: 'contain' },
  logoMark: { fontSize: 24, fontFamily: 'Times-Bold', color: C.black },
  
  storeInfoCenter: { alignItems: 'center', marginBottom: 30, borderBottomWidth: 1, borderBottomColor: C.goldDark, paddingBottom: 15 },
  storeName: { fontSize: 22, fontFamily: 'Times-Bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  storeMeta: { fontSize: 9, color: C.textSecondary, fontFamily: 'Times-Italic' },
  
  documentTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  documentTitle: { fontSize: 16, fontFamily: 'Times-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  documentMeta: { fontSize: 9, textAlign: 'right' },
  
  // ── CUSTOMER SECTION ──
  partySection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  partyBox: { width: '48%' },
  partyLabel: { fontSize: 9, fontFamily: 'Times-Italic', color: C.textSecondary, marginBottom: 4 },
  partyName: { fontSize: 11, fontFamily: 'Times-Bold', marginBottom: 2 },
  partyDetails: { fontSize: 9, color: C.charcoal },
  
  // ── TABLE ──
  table: { marginBottom: 20 },
  tHeadRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.black, paddingVertical: 6 },
  th: { fontSize: 8, fontFamily: 'Times-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  tRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  td: { fontSize: 9 },
  
  col1: { width: '5%', textAlign: 'center' },
  col2: { width: '45%' },
  col3: { width: '10%', textAlign: 'center' },
  col4: { width: '13%', textAlign: 'right' },
  col5: { width: '13%', textAlign: 'right' },
  col6: { width: '14%', textAlign: 'right' },
  
  itemDesc: { fontSize: 9, fontFamily: 'Times-Bold', marginBottom: 2 },
  itemSub: { fontSize: 8, fontFamily: 'Times-Italic', color: C.textSecondary },
  
  // ── TRADE-IN TABLE ──
  tradeInHeading: { fontSize: 10, fontFamily: 'Times-Bold', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginBottom: 5 },
  
  // ── SUMMARY ──
  summarySection: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  notesBox: { width: '50%' },
  notesLabel: { fontSize: 9, fontFamily: 'Times-Italic', color: C.textSecondary, marginBottom: 2 },
  amountWords: { fontSize: 10, fontFamily: 'Times-Bold', marginBottom: 15 },
  termsText: { fontSize: 8, color: C.charcoal },
  
  totalsBox: { width: '40%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 9 },
  totalValue: { fontSize: 9, textAlign: 'right' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.black, marginVertical: 6 },
  grandTotalLabel: { fontSize: 11, fontFamily: 'Times-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  grandTotalValue: { fontSize: 11, fontFamily: 'Times-Bold', textAlign: 'right' },
  
  // ── SIGNATURE ──
  signatureSection: { marginTop: 40, alignItems: 'center', width: '100%', flexDirection: 'column' },
  signatureBox: { width: 200, alignItems: 'center' },
  signatureImage: { width: 100, height: 35, objectFit: 'contain', marginBottom: 5 },
  signatureLine: { width: '100%', borderTopWidth: 1, borderTopColor: C.black, marginBottom: 4 },
  signatureName: { fontSize: 10, fontFamily: 'Times-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  signatureRole: { fontSize: 8, fontFamily: 'Times-Italic', color: C.textSecondary },
  
  // ── FOOTER ──
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center' },
  footerText: { fontSize: 8, fontFamily: 'Times-Italic', color: C.textSecondary }
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function HeritageTemplate({ data }: { data: InvoiceData }) {
  const title =
    data.type === 'proforma' ? 'Quotation' :
      data.type === 'purchase' ? 'Purchase Document' :
        'Tax Invoice';
        
  return (
    <Document>
      <Page size="A4" style={s.page}>
        
        {/* ── HEADER ── */}
        <View style={s.headerRow}>
          <View style={s.logoContainer}>
            {data.store?.logo_url ? (
              <Image src={data.store.logo_url} style={s.logoImage} />
            ) : (
              <Text style={s.logoMark}>
                {(data.store?.name || 'FG').substring(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
        </View>

        <View style={s.storeInfoCenter}>
          <Text style={s.storeName}>{data.store?.name || 'Fusion Gadgets'}</Text>
          <Text style={s.storeMeta}>
            {[data.store?.address?.split('\n').join(', '), data.store?.phone, data.store?.email]
              .filter(Boolean)
              .join(' • ')}
          </Text>
          {data.store?.gstin && <Text style={s.storeMeta}>GSTIN: {data.store.gstin}</Text>}
        </View>

        <View style={s.documentTitleRow}>
          <View>
            <Text style={s.documentTitle}>{title}</Text>
          </View>
          <View style={s.documentMeta}>
            <Text style={{ fontFamily: 'Times-Bold' }}>No. {data.bill_number}</Text>
            <Text>Date: {data.date}</Text>
          </View>
        </View>

        {/* ── CUSTOMER DETAILS ── */}
        <View style={s.partySection}>
          <View style={s.partyBox}>
            <Text style={s.partyLabel}>{data.type === 'purchase' ? 'Received From:' : 'Prepared For:'}</Text>
            <Text style={s.partyName}>{data.party?.name || 'Cash Customer'}</Text>
            {data.party?.address && <Text style={s.partyDetails}>{data.party.address.split('\n').join(', ')}</Text>}
            {data.party?.number && <Text style={s.partyDetails}>Contact: {data.party.number}</Text>}
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
            <Text style={s.tradeInHeading}>Trade-In Allowances</Text>
            <View style={s.tHeadRow}>
              <Text style={[s.th, s.col1]}>#</Text>
              <Text style={[s.th, s.col2]}>Item Description</Text>
              <Text style={[s.th, s.col3]}>Qty</Text>
              <Text style={[s.th, s.col4]}> </Text>
              <Text style={[s.th, s.col5]}> </Text>
              <Text style={[s.th, s.col6]}>Allowance</Text>
            </View>

            {data.trade_ins.map((item, idx) => (
              <View key={idx} style={s.tRow}>
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
            <Text style={s.notesLabel}>Sum in Words</Text>
            <Text style={s.amountWords}>{numberToWords(Math.round(data.final_total))}</Text>
            <Text style={s.notesLabel}>Terms</Text>
            <Text style={s.termsText}>1. Goods once sold will not be taken back or exchanged.</Text>
            <Text style={s.termsText}>2. Warranty as per manufacturer terms.</Text>
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
                <Text style={s.totalLabel}>Trade-In Allowance</Text>
                <Text style={s.totalValue}>{'\u2212'} {fmt(Number(data.trade_in_credit) || 0)}</Text>
              </View>
            )}

            <View style={s.grandTotalRow}>
              <Text style={s.grandTotalLabel}>Total Amount</Text>
              <Text style={s.grandTotalValue}>{fmt(data.final_total)}</Text>
            </View>

            {data.type !== 'proforma' && (
              <>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Payment Received</Text>
                  <Text style={s.totalValue}>{fmt(data.paid)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={[s.totalLabel, { fontFamily: 'Times-Bold' }]}>Balance Due</Text>
                  <Text style={[s.totalValue, { fontFamily: 'Times-Bold' }]}>{fmt(data.due)}</Text>
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
