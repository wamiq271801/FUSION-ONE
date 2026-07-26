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

// ─── Icons ──────────────────────────────────────────────────────────────────

const PhoneIcon = () => (
  <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </Svg>
);

const EmailIcon = () => (
  <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <Polyline points="22,6 12,13 2,6" />
  </Svg>
);

const MapPinIcon = () => (
  <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <Circle cx="12" cy="10" r="3" />
  </Svg>
);

// ─── Design Tokens ──────────────────────────────────────────────────────────

const C = {
  black: '#111111',
  gold: '#C9A227',
  white: '#FFFFFF',
  bgLight: '#F8F8F8',
  textPrimary: '#111111',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  tradeInBg: '#F6FBF6',
  tradeInText: '#2D6A35',
  tradeInBorder: '#D1EAD4',
};

// ─── Stylesheet ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: C.textPrimary,
    backgroundColor: C.white,
    lineHeight: 1.5,
    paddingBottom: 40, // Required so the main content doesn't underlap the absolute footer
  },

  // ── HEADER ──
  headerGoldBar: { height: 2.25, backgroundColor: C.gold },
  invoiceHeader: { paddingHorizontal: 33, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1.5, borderBottomColor: C.black },
  headerBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logoContainer: { width: 36, height: 36, borderWidth: 1.1, borderColor: C.black, alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 },
  logoImage: { width: 36, height: 36, objectFit: 'contain' },
  logoMark: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.black },
  storeBlock: { flexDirection: 'column', justifyContent: 'center' },
  storeName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.black, lineHeight: 1.2 },
  storeMeta: { fontSize: 6.75, color: C.textSecondary, marginTop: 2, lineHeight: 1.4 },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end' },
  contactLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 2.5 },
  contactIcon: { marginRight: 4 },
  contactText: { fontSize: 6.75, color: C.textSecondary, textAlign: 'right' },

  // ── BILLING + META SECTION ──
  billingSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 33, paddingTop: 24, paddingBottom: 24, borderBottomWidth: 0.75, borderBottomColor: C.border },
  billToCol: { width: '48%' },
  sectionLabel: { fontSize: 8.25, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: C.gold, marginBottom: 7.5, letterSpacing: 0.9 },
  customerName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.textPrimary, marginBottom: 4.5, lineHeight: 1.3 },
  customerAddress: { fontSize: 7.1, color: C.textSecondary, marginBottom: 6, lineHeight: 1.6 },
  customerDetailRow: { flexDirection: 'row', marginBottom: 3 },
  customerDetailLabel: { fontSize: 7.1, fontFamily: 'Helvetica-Bold', color: C.textPrimary, width: 54 },
  customerDetailValue: { fontSize: 7.1, color: C.textSecondary, flex: 1 },
  billingDivider: { width: 0.75, backgroundColor: C.border, marginHorizontal: 12, alignSelf: 'stretch' },
  invoiceMetaCol: { width: '42%', flexDirection: 'column' },
  invoiceTitle: { fontSize: 21, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: C.black, marginBottom: 13.5, lineHeight: 1 },
  metaRow: { flexDirection: 'row', paddingVertical: 3, alignItems: 'flex-start' },
  metaLabel: { fontSize: 6.75, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: C.textPrimary, width: 67.5, lineHeight: 1.5, letterSpacing: 0.375 },
  metaValue: { fontSize: 7.1, color: C.textSecondary, flex: 1, lineHeight: 1.5 },

  // ── ITEMS TABLE ──
  tableSection: { paddingHorizontal: 33 },
  tableLabel: { fontSize: 8.25, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: C.textSecondary, paddingTop: 15, paddingBottom: 7.5, letterSpacing: 0.9 },
  tHead: { flexDirection: 'row', backgroundColor: C.black, paddingVertical: 7.5, paddingHorizontal: 9 },
  th: { fontSize: 6.75, fontFamily: 'Helvetica-Bold', color: C.white, textTransform: 'uppercase', letterSpacing: 0.6 },
  tRow: { flexDirection: 'row', paddingVertical: 10.5, paddingHorizontal: 9, borderBottomWidth: 0.75, borderBottomColor: C.border },
  tRowLast: { borderBottomWidth: 0 },
  td: { fontSize: 7.1, color: C.textPrimary },
  tdDesc: { fontSize: 7.1, fontFamily: 'Helvetica-Bold', color: C.textPrimary, marginBottom: 2.25 },
  tdSub: { fontSize: 6.375, color: C.textSecondary, lineHeight: 1.5 },

  // Column widths
  col1: { width: '5%' },
  col2: { width: '44%' },
  col3: { width: '9%', textAlign: 'center' },
  col4: { width: '16%', textAlign: 'right' },
  col5: { width: '11%', textAlign: 'right' },
  col6: { width: '15%', textAlign: 'right' },

  // ── TRADE-IN TABLE ──
  tradeInSection: { paddingHorizontal: 33 },
  tradeInLabelRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 7.5 },
  tradeInLabelText: { fontSize: 8.25, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: C.tradeInText, letterSpacing: 0.9, marginRight: 6 },
  tradeInHead: { flexDirection: 'row', backgroundColor: C.tradeInBg, borderTopWidth: 1.125, borderTopColor: C.tradeInText, paddingVertical: 7.5, paddingHorizontal: 9 },
  tradeInTh: { fontSize: 6.75, fontFamily: 'Helvetica-Bold', color: C.tradeInText, textTransform: 'uppercase', letterSpacing: 0.6 },
  tradeInRow: { flexDirection: 'row', paddingVertical: 10.5, paddingHorizontal: 9, backgroundColor: C.tradeInBg, borderBottomWidth: 0.75, borderBottomColor: C.tradeInBorder },
  tradeInRowLast: { borderBottomWidth: 0 },
  tradeInTd: { fontSize: 7.1, color: C.tradeInText },
  tradeInTdDesc: { fontSize: 7.1, fontFamily: 'Helvetica-Bold', color: C.tradeInText, marginBottom: 2.25 },
  tradeInTdSub: { fontSize: 6.375, color: '#4B8B55', lineHeight: 1.5 },

  // ── SUMMARY SECTION ──
  summarySection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 33, paddingTop: 21, paddingBottom: 24, borderTopWidth: 0.75, borderTopColor: C.border, marginTop: 15 },
  notesBox: { width: '50%', paddingRight: 24 },
  notesSectionLabel: { fontSize: 8.25, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: C.textLight, marginBottom: 4.5, letterSpacing: 0.9 },
  amountWords: { fontSize: 7.1, fontFamily: 'Helvetica-Oblique', color: C.textPrimary, marginBottom: 15, lineHeight: 1.5 },
  termsText: { fontSize: 6.375, color: C.textSecondary, lineHeight: 1.7 },
  totalsBox: { width: '44%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: 4.5 },
  totalLabel: { fontSize: 7.1, color: C.textSecondary },
  totalValue: { fontSize: 7.1, color: C.textPrimary },
  totalsDivider: { height: 0.75, backgroundColor: C.border, marginVertical: 6 },
  grandTotalBlock: { backgroundColor: C.black, paddingVertical: 10.5, paddingHorizontal: 12, marginVertical: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandTotalLabel: { fontSize: 8.25, fontFamily: 'Helvetica-Bold', color: C.white, textTransform: 'uppercase', letterSpacing: 0.75 },
  grandTotalValue: { fontSize: 11.25, fontFamily: 'Helvetica-Bold', color: C.gold, letterSpacing: 0.375 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: 4.5 },
  balanceLabel: { fontSize: 7.1, fontFamily: 'Helvetica-Bold', color: C.textPrimary },
  balanceValue: { fontSize: 7.1, fontFamily: 'Helvetica-Bold', color: C.textPrimary },

  // ── SIGNATURE SECTION ──
  signatureSection: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 33, paddingBottom: 27 },
  signatureBlock: { width: 142.5, flexDirection: 'column', alignItems: 'center' },
  signatureFor: { fontSize: 6.75, fontFamily: 'Helvetica-Oblique', color: C.textSecondary, marginBottom: 31.5, alignSelf: 'flex-start' },
  signatureImage: { width: 75, height: 30, objectFit: 'contain', marginBottom: 3.75 },
  signatureLineRule: { width: '100%', borderTopWidth: 0.75, borderTopColor: C.black, marginBottom: 5.25 },
  signatureName: { fontSize: 6.75, fontFamily: 'Helvetica-Bold', color: C.black, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center' },
  signatureRole: { fontSize: 6, color: C.textSecondary, textAlign: 'center', marginTop: 1.5 },

  // ── FOOTER ──
  pageFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.black,
    paddingVertical: 7.5,
    paddingHorizontal: 33,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerBrand: { fontSize: 6.75, fontFamily: 'Helvetica-Bold', color: C.gold, textTransform: 'uppercase', letterSpacing: 0.75 },
  footerNote: { fontSize: 6, color: '#6B7280' },
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProformaTemplate({ data }: { data: InvoiceData }) {
  const isProforma = data.type === 'proforma';
  const title = isProforma
    ? 'QUOTATION'
    : (data.type === 'sale' ? 'TAX INVOICE' : 'PURCHASE BILL');

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerGoldBar} />

        {/* ── HEADER ── */}
        <View style={s.invoiceHeader}>
          <View style={s.headerBody}>
            <View style={s.headerLeft}>
              <View style={s.logoContainer}>
                {data.store?.logo_url ? (
                  <Image src={data.store.logo_url} style={s.logoImage} />
                ) : (
                  <Text style={s.logoMark}>
                    {(data.store?.name || 'FG').substring(0, 2).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={s.storeBlock}>
                <Text style={s.storeName}>{data.store?.name || 'FUSION GADGETS'}</Text>
                {data.store?.gstin && (
                  <Text style={s.storeMeta}>GSTIN: {data.store.gstin}</Text>
                )}
              </View>
            </View>

            <View style={s.headerRight}>
              {data.store?.phone && (
                <View style={s.contactLine}>
                  <View style={s.contactIcon}><PhoneIcon /></View>
                  <Text style={s.contactText}>{data.store.phone}</Text>
                </View>
              )}
              {data.store?.email && (
                <View style={s.contactLine}>
                  <View style={s.contactIcon}><EmailIcon /></View>
                  <Text style={s.contactText}>{data.store.email}</Text>
                </View>
              )}
              {data.store?.address && (
                <View style={[s.contactLine, { marginBottom: 0 }]}>
                  <View style={s.contactIcon}><MapPinIcon /></View>
                  <Text style={s.contactText}>
                    {data.store.address.split('\n').join(', ')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── BILLING + INVOICE META ── */}
        <View style={s.billingSection}>
          <View style={s.billToCol}>
            <Text style={s.sectionLabel}>{data.type === 'purchase' ? 'Received From' : 'Bill To'}</Text>
            <Text style={s.customerName}>{data.party?.name || 'Cash Customer'}</Text>
            {data.party?.address && (
              <Text style={s.customerAddress}>
                {data.party.address.split('\n').join(', ')}
              </Text>
            )}
            {data.party?.number && (
              <View style={s.customerDetailRow}>
                <Text style={s.customerDetailLabel}>Contact No.</Text>
                <Text style={s.customerDetailValue}>{data.party.number}</Text>
              </View>
            )}
          </View>

          <View style={s.billingDivider} />

          <View style={s.invoiceMetaCol}>
            <Text style={s.invoiceTitle}>{title}</Text>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Invoice No.</Text>
              <Text style={s.metaValue}>{data.bill_number}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Date</Text>
              <Text style={s.metaValue}>{data.date}</Text>
            </View>
          </View>
        </View>

        {/* ── ITEMS TABLE ── */}
        <View style={s.tableSection}>
          <Text style={s.tableLabel}>Items Purchased</Text>
          <View style={s.tHead}>
            <Text style={[s.th, s.col1]}>#</Text>
            <Text style={[s.th, s.col2]}>Item Description</Text>
            <Text style={[s.th, s.col3]}>Qty</Text>
            <Text style={[s.th, s.col4]}>Rate (MRP)</Text>
            <Text style={[s.th, s.col5]}>Discount</Text>
            <Text style={[s.th, s.col6]}>Amount</Text>
          </View>

          {data.items.map((item, idx) => (
            <View key={idx} style={[s.tRow, idx === data.items.length - 1 ? s.tRowLast : {}]}>
              <Text style={[s.td, s.col1]}>{idx + 1}</Text>
              <View style={s.col2}>
                <Text style={s.tdDesc}>
                  {item.description || `${item.brand || ''} ${item.model || ''}`.trim()}
                </Text>
                {(item.ram_rom || item.color || item.imei) && (
                  <Text style={s.tdSub}>
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
          <View style={s.tradeInSection}>
            <View style={s.tradeInLabelRow}>
              <Text style={s.tradeInLabelText}>Trade-In</Text>
            </View>

            <View style={s.tradeInHead}>
              <Text style={[s.tradeInTh, s.col1]}>#</Text>
              <Text style={[s.tradeInTh, s.col2]}>Description</Text>
              <Text style={[s.tradeInTh, s.col3]}>Qty</Text>
              <Text style={[s.tradeInTh, s.col4]}> </Text>
              <Text style={[s.tradeInTh, s.col5]}> </Text>
              <Text style={[s.tradeInTh, s.col6]}>Amount</Text>
            </View>

            {data.trade_ins.map((item, idx) => (
              <View key={idx} style={[s.tradeInRow, idx === (data.trade_ins?.length ?? 0) - 1 ? s.tradeInRowLast : {}]}>
                <Text style={[s.tradeInTd, s.col1]}>{idx + 1}</Text>
                <View style={s.col2}>
                  <Text style={s.tradeInTdDesc}>
                    {item.description || `${item.brand || ''} ${item.model || ''}`.trim()}
                  </Text>
                  {item.imei && <Text style={s.tradeInTdSub}>IMEI: {item.imei}</Text>}
                </View>
                <Text style={[s.tradeInTd, s.col3]}>{item.qty ? item.qty : ''}</Text>
                <Text style={[s.tradeInTd, s.col4]}> </Text>
                <Text style={[s.tradeInTd, s.col5]}> </Text>
                <Text style={[s.tradeInTd, s.col6]}>
                  {fmt((item.qty || 1) * (item.rate || item.credit_value || 0))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── SUMMARY ── */}
        <View style={s.summarySection}>
          <View style={s.notesBox}>
            <Text style={s.notesSectionLabel}>Amount in Words</Text>
            <Text style={s.amountWords}>
              {numberToWords(Math.round(data.final_total))}
            </Text>
            <Text style={s.notesSectionLabel}>Terms &amp; Conditions</Text>
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

            <View style={s.grandTotalBlock}>
              <Text style={s.grandTotalLabel}>Grand Total</Text>
              <Text style={s.grandTotalValue}>{fmt(data.final_total)}</Text>
            </View>

            {data.type !== 'proforma' && (
              <>
                <View style={s.totalsDivider} />
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Amount Received</Text>
                  <Text style={s.totalValue}>{fmt(data.paid)}</Text>
                </View>
                <View style={s.balanceRow}>
                  <Text style={s.balanceLabel}>Balance Due</Text>
                  <Text style={s.balanceValue}>{fmt(data.due)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── SIGNATURE ── */}
        <View style={s.signatureSection}>
          <View style={s.signatureBlock}>
            <Text style={s.signatureFor}>For {data.store?.name || 'Fusion Gadgets'}</Text>
            {data.store?.signature_url && (
              <Image src={data.store.signature_url} style={s.signatureImage} />
            )}
            <View style={s.signatureLineRule} />
            <Text style={s.signatureName}>{data.store?.name || 'Fusion Gadgets'}</Text>
            <Text style={s.signatureRole}>Authorized Signatory</Text>
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={s.pageFooter}>
          <Text style={s.footerBrand}>{data.store?.name || 'Fusion Gadgets'}</Text>
          <Text style={s.footerNote}>
            This is a computer-generated invoice. No signature required if digitally authenticated.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
