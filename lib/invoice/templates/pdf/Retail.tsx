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
  black: '#000000',
  white: '#FFFFFF',
  text: '#222222',
  textLight: '#555555',
  borderDark: '#000000',
  borderLight: '#CCCCCC',
  headerBg: '#E8E8E8',
};

// ─── Stylesheet ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: C.text,
    backgroundColor: C.white,
    lineHeight: 1.3,
    padding: 20,
    paddingBottom: 40,
  },
  
  // ── HEADER ──
  headerBlock: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: C.borderDark, paddingBottom: 10, marginBottom: 10 },
  logoContainer: { width: 50, height: 50, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  logoImage: { width: 50, height: 50, objectFit: 'contain' },
  logoMark: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  storeInfo: { flex: 1, justifyContent: 'center' },
  storeName: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  storeMeta: { fontSize: 8, color: C.textLight },
  
  docTitleBlock: { width: 120, alignItems: 'flex-end', justifyContent: 'center' },
  docTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 4 },
  docNo: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  
  // ── META ──
  metaSection: { flexDirection: 'row', marginBottom: 10 },
  metaBox: { flex: 1, borderWidth: 1, borderColor: C.borderDark, padding: 5, marginRight: 5 },
  metaBoxLast: { marginRight: 0 },
  metaLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: C.borderLight, paddingBottom: 2, marginBottom: 3 },
  customerName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  metaText: { fontSize: 8, marginBottom: 1 },
  
  // ── TABLE ──
  table: { borderWidth: 1, borderColor: C.borderDark, marginBottom: 10 },
  tHead: { flexDirection: 'row', backgroundColor: C.headerBg, borderBottomWidth: 1, borderBottomColor: C.borderDark },
  tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderLight },
  tRowLast: { borderBottomWidth: 0 },
  th: { paddingVertical: 4, paddingHorizontal: 2, borderRightWidth: 1, borderRightColor: C.borderDark, fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  td: { paddingVertical: 4, paddingHorizontal: 2, borderRightWidth: 1, borderRightColor: C.borderLight, fontSize: 8 },
  tdLast: { borderRightWidth: 0 },
  
  col1: { width: '4%', textAlign: 'center' },
  col2: { width: '46%' },
  col3: { width: '8%', textAlign: 'center' },
  col4: { width: '14%', textAlign: 'right' },
  col5: { width: '14%', textAlign: 'right' },
  col6: { width: '14%', textAlign: 'right' },
  
  itemDesc: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  itemSub: { fontSize: 7, color: C.textLight },
  
  // ── SUMMARY ──
  summarySection: { flexDirection: 'row' },
  notesBox: { width: '60%', borderWidth: 1, borderColor: C.borderDark, padding: 5, marginRight: 5 },
  totalsBox: { width: '40%', borderWidth: 1, borderColor: C.borderDark },
  
  wordsLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2 },
  wordsText: { fontSize: 8, fontStyle: 'italic', marginBottom: 6 },
  termsLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 2 },
  termsText: { fontSize: 7, color: C.textLight },
  
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  totalRowLast: { borderBottomWidth: 0 },
  totalLabel: { fontSize: 8 },
  totalValue: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 5, backgroundColor: C.headerBg, borderBottomWidth: 1, borderBottomColor: C.borderDark },
  grandTotalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  
  // ── FOOTER ──
  footerBlock: { marginTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  authSignLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginTop: 30, borderTopWidth: 1, borderTopColor: C.borderDark, paddingTop: 2, width: 120 },
  signImg: { width: 80, height: 25, objectFit: 'contain', position: 'absolute', bottom: 15, left: 20 },
  pageFooter: { position: 'absolute', bottom: 15, left: 20, right: 20, textAlign: 'center', fontSize: 7, color: C.textLight }
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function RetailTemplate({ data }: { data: InvoiceData }) {
  const title =
    data.type === 'proforma' ? 'QUOTATION' :
      data.type === 'purchase' ? 'PURCHASE BILL' :
        'TAX INVOICE';
        
  return (
    <Document>
      <Page size="A4" style={s.page}>
        
        {/* ── HEADER ── */}
        <View style={s.headerBlock}>
          <View style={s.logoContainer}>
            {data.store?.logo_url ? (
              <Image src={data.store.logo_url} style={s.logoImage} />
            ) : (
              <Text style={s.logoMark}>
                {(data.store?.name || 'FG').substring(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={s.storeInfo}>
            <Text style={s.storeName}>{data.store?.name || 'FUSION GADGETS'}</Text>
            {data.store?.address && <Text style={s.storeMeta}>{data.store.address.split('\n').join(', ')}</Text>}
            <Text style={s.storeMeta}>
              {[data.store?.phone ? `Ph: ${data.store.phone}` : null,
                data.store?.email ? `Email: ${data.store.email}` : null,
                data.store?.gstin ? `GSTIN: ${data.store.gstin}` : null]
                .filter(Boolean)
                .join(' | ')}
            </Text>
          </View>
          <View style={s.docTitleBlock}>
            <Text style={s.docTitle}>{title}</Text>
            <Text style={s.docNo}>No: {data.bill_number}</Text>
          </View>
        </View>

        {/* ── META ── */}
        <View style={s.metaSection}>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>{data.type === 'purchase' ? 'Supplier Details' : 'Customer Details'}</Text>
            <Text style={s.customerName}>{data.party?.name || 'Cash Customer'}</Text>
            {data.party?.number && <Text style={s.metaText}>Ph: {data.party.number}</Text>}
            {data.party?.address && <Text style={s.metaText}>{data.party.address.split('\n').join(', ')}</Text>}
          </View>
          <View style={[s.metaBox, s.metaBoxLast]}>
            <Text style={s.metaLabel}>Invoice Details</Text>
            <Text style={s.metaText}>Date: {data.date}</Text>
          </View>
        </View>

        {/* ── ITEMS TABLE ── */}
        <View style={s.table}>
          <View style={s.tHead}>
            <Text style={[s.th, s.col1]}>#</Text>
            <Text style={[s.th, s.col2, { textAlign: 'left' }]}>Item Description</Text>
            <Text style={[s.th, s.col3]}>Qty</Text>
            <Text style={[s.th, s.col4]}>MRP</Text>
            <Text style={[s.th, s.col5]}>Discount</Text>
            <Text style={[s.th, s.col6, s.tdLast]}>Amount</Text>
          </View>

          {data.items.map((item, idx) => (
            <View key={idx} style={[s.tRow, idx === data.items.length - 1 ? s.tRowLast : {}]}>
              <Text style={[s.td, s.col1, { textAlign: 'center' }]}>{idx + 1}</Text>
              <View style={[s.td, s.col2]}>
                <Text style={s.itemDesc}>
                  {item.description || `${item.brand || ''} ${item.model || ''}`.trim()}
                </Text>
                {(item.ram_rom || item.color || item.imei) && (
                  <Text style={s.itemSub}>
                    {[item.ram_rom, item.color, item.imei ? `IMEI: ${item.imei}` : null]
                      .filter(Boolean)
                      .join(' | ')}
                  </Text>
                )}
              </View>
              <Text style={[s.td, s.col3, { textAlign: 'center' }]}>{item.qty || 1}</Text>
              <Text style={[s.td, s.col4, { textAlign: 'right' }]}>{fmt(item.rate || item.price || 0)}</Text>
              <Text style={[s.td, s.col5, { textAlign: 'right' }]}>
                {Number(item.discount) > 0 ? `\u2212 ${fmt(item.discount || 0)}` : '\u2014'}
              </Text>
              <Text style={[s.td, s.col6, s.tdLast, { textAlign: 'right' }]}>{fmt(item.value || item.price || 0)}</Text>
            </View>
          ))}
        </View>

        {/* ── TRADE-IN TABLE ── */}
        {data.trade_ins && data.trade_ins.length > 0 && (
          <View style={s.table}>
            <View style={s.tHead}>
              <Text style={[s.th, s.col1]}>#</Text>
              <Text style={[s.th, s.col2, { textAlign: 'left' }]}>Trade-In Items</Text>
              <Text style={[s.th, s.col3]}>Qty</Text>
              <Text style={[s.th, s.col4]}> </Text>
              <Text style={[s.th, s.col5]}> </Text>
              <Text style={[s.th, s.col6, s.tdLast]}>Credit Value</Text>
            </View>

            {data.trade_ins.map((item, idx) => (
              <View key={idx} style={[s.tRow, idx === (data.trade_ins?.length ?? 0) - 1 ? s.tRowLast : {}]}>
                <Text style={[s.td, s.col1, { textAlign: 'center' }]}>{idx + 1}</Text>
                <View style={[s.td, s.col2]}>
                  <Text style={s.itemDesc}>
                    {item.description || `${item.brand || ''} ${item.model || ''}`.trim()}
                  </Text>
                  {item.imei && <Text style={s.itemSub}>IMEI: {item.imei}</Text>}
                </View>
                <Text style={[s.td, s.col3, { textAlign: 'center' }]}>{item.qty ? item.qty : ''}</Text>
                <Text style={[s.td, s.col4]}> </Text>
                <Text style={[s.td, s.col5]}> </Text>
                <Text style={[s.td, s.col6, s.tdLast, { textAlign: 'right' }]}>
                  {fmt((item.qty || 1) * (item.rate || item.credit_value || 0))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── SUMMARY ── */}
        <View style={s.summarySection}>
          <View style={s.notesBox}>
            <Text style={s.wordsLabel}>Amount in Words</Text>
            <Text style={s.wordsText}>{numberToWords(Math.round(data.final_total))}</Text>
            
            <Text style={s.termsLabel}>Terms &amp; Conditions</Text>
            <Text style={s.termsText}>1. Goods once sold will not be taken back or exchanged.</Text>
            <Text style={s.termsText}>2. Warranty as per manufacturer terms.</Text>
            <Text style={s.termsText}>3. Thank you for doing business with us.</Text>
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
              <Text style={s.grandTotalLabel}>Net Total</Text>
              <Text style={s.grandTotalValue}>{fmt(data.final_total)}</Text>
            </View>
            {data.type !== 'proforma' && (
              <>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Amount Received</Text>
                  <Text style={s.totalValue}>{fmt(data.paid)}</Text>
                </View>
                <View style={[s.totalRow, s.totalRowLast]}>
                  <Text style={[s.totalLabel, { fontFamily: 'Helvetica-Bold' }]}>Balance Due</Text>
                  <Text style={[s.totalValue, { fontFamily: 'Helvetica-Bold' }]}>{fmt(data.due)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── FOOTER & SIGN ── */}
        <View style={s.footerBlock}>
          <View>
            {/* Left space for potential stamp or customer sign */}
          </View>
          <View style={{ width: 120, position: 'relative' }}>
            {data.store?.signature_url && (
              <Image src={data.store.signature_url} style={s.signImg} />
            )}
            <Text style={s.authSignLabel}>Authorized Signatory</Text>
          </View>
        </View>

        <Text style={s.pageFooter}>
          This is a computer-generated invoice. No signature required if digitally authenticated.
        </Text>
      </Page>
    </Document>
  );
}
