import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Svg, Path, Polyline, Circle } from '@react-pdf/renderer';
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

// ─── Icons ──────────────────────────────────────────────────────────────────

const PhoneIcon = () => (
  <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </Svg>
);

const EmailIcon = () => (
  <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <Polyline points="22,6 12,13 2,6" />
  </Svg>
);

const MapPinIcon = () => (
  <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <Circle cx="12" cy="10" r="3" />
  </Svg>
);

// ─── Design Tokens ──────────────────────────────────────────────────────────

const C = {
  black: '#000000',
  white: '#FFFFFF',
  textPrimary: '#111111',
  textSecondary: '#333333',
  border: '#999999',
  tableHeader: '#E5E5E5',
};

// ─── Stylesheet ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: C.textPrimary,
    backgroundColor: C.white,
    lineHeight: 1.4,
    padding: 30,
    paddingBottom: 50,
  },
  
  // ── HEADER ──
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logoContainer: { width: 50, height: 50, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  logoImage: { width: 48, height: 48, objectFit: 'contain' },
  logoMark: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.black },
  storeBlock: { flexDirection: 'column' },
  storeName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 2 },
  storeMeta: { fontSize: 9, color: C.textSecondary },
  
  headerRight: { flexDirection: 'column', alignItems: 'flex-end' },
  contactLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  contactIcon: { marginRight: 4 },
  contactText: { fontSize: 9, color: C.textSecondary, textAlign: 'right' },
  
  documentTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, paddingVertical: 5, backgroundColor: C.tableHeader, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  
  // ── BILLING + META ──
  infoSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  infoBox: { width: '48%', borderWidth: 1, borderColor: C.border, padding: 8 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 4, marginBottom: 6, backgroundColor: C.tableHeader, marginHorizontal: -8, marginTop: -8, paddingHorizontal: 8, paddingTop: 4 },
  customerName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  customerText: { fontSize: 9, color: C.textSecondary, marginBottom: 2 },
  metaRow: { flexDirection: 'row', marginBottom: 4 },
  metaLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', width: 80 },
  metaValue: { fontSize: 9, flex: 1 },
  
  // ── TABLE ──
  table: { borderWidth: 1, borderColor: C.border, borderBottomWidth: 0, borderRightWidth: 0, marginBottom: 15 },
  tHeadRow: { flexDirection: 'row', backgroundColor: C.tableHeader },
  tRow: { flexDirection: 'row' },
  tColHeader: { padding: 6, borderBottomWidth: 1, borderRightWidth: 1, borderColor: C.border, fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  tCol: { padding: 6, borderBottomWidth: 1, borderRightWidth: 1, borderColor: C.border, fontSize: 9, color: C.textPrimary },
  col1: { width: '5%', textAlign: 'center' },
  col2: { width: '45%' },
  col3: { width: '10%', textAlign: 'center' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '10%', textAlign: 'right' },
  col6: { width: '15%', textAlign: 'right' },
  itemDesc: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  itemSub: { fontSize: 8, color: C.textSecondary },
  
  // ── SUMMARY ──
  summarySection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  notesBox: { width: '55%', borderWidth: 1, borderColor: C.border, padding: 8 },
  amountWordsLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  amountWords: { fontSize: 9, fontStyle: 'italic', marginBottom: 10 },
  termsLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  termsText: { fontSize: 8, color: C.textSecondary, marginBottom: 2 },
  
  totalsBox: { width: '42%', borderWidth: 1, borderColor: C.border, padding: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  totalValue: { fontSize: 9, textAlign: 'right' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.tableHeader, marginVertical: 4 },
  grandTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  
  // ── SIGNATURE ──
  signatureSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  signatureBox: { width: 150, alignItems: 'center' },
  signatureFor: { fontSize: 9, alignSelf: 'flex-start', marginBottom: 30 },
  signatureImage: { width: 100, height: 35, objectFit: 'contain', marginBottom: 5 },
  signatureLine: { width: '100%', borderTopWidth: 1, borderColor: C.black, marginBottom: 4 },
  signatureName: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  signatureRole: { fontSize: 8, color: C.textSecondary },
  
  // ── FOOTER ──
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, borderTopWidth: 1, borderColor: C.border, paddingTop: 5, textAlign: 'center' },
  footerText: { fontSize: 8, color: C.textSecondary }
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function ClassicTemplate({ data }: { data: InvoiceData }) {
  const title =
    data.type === 'proforma' ? 'QUOTATION' :
      data.type === 'purchase' ? 'PURCHASE BILL' :
        'TAX INVOICE';
        
  return (
    <Document>
      <Page size="A4" style={s.page}>
        
        {/* ── HEADER ── */}
        <View style={s.headerRow}>
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
              {data.store?.gstin && <Text style={s.storeMeta}>GSTIN: {data.store.gstin}</Text>}
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
              <View style={s.contactLine}>
                <View style={s.contactIcon}><MapPinIcon /></View>
                <Text style={s.contactText}>{data.store.address.split('\n').join(', ')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── TITLE ── */}
        <Text style={s.documentTitle}>{title}</Text>

        {/* ── BILLING + INVOICE META ── */}
        <View style={s.infoSection}>
          <View style={s.infoBox}>
            <Text style={s.sectionTitle}>{data.type === 'purchase' ? 'RECEIVED FROM' : 'BILL TO'}</Text>
            <Text style={s.customerName}>{data.party?.name || 'Cash Customer'}</Text>
            {data.party?.address && (
              <Text style={s.customerText}>
                {data.party.address.split('\n').join(', ')}
              </Text>
            )}
            {data.party?.number && (
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Contact No:</Text>
                <Text style={s.metaValue}>{data.party.number}</Text>
              </View>
            )}
          </View>

          <View style={s.infoBox}>
            <Text style={s.sectionTitle}>INVOICE DETAILS</Text>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Invoice No:</Text>
              <Text style={s.metaValue}>{data.bill_number}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Date:</Text>
              <Text style={s.metaValue}>{data.date}</Text>
            </View>
          </View>
        </View>

        {/* ── ITEMS TABLE ── */}
        <View style={s.table}>
          <View style={s.tHeadRow}>
            <Text style={[s.tColHeader, s.col1]}>#</Text>
            <Text style={[s.tColHeader, s.col2, { textAlign: 'left' }]}>Description of Goods</Text>
            <Text style={[s.tColHeader, s.col3]}>Qty</Text>
            <Text style={[s.tColHeader, s.col4]}>Rate</Text>
            <Text style={[s.tColHeader, s.col5]}>Discount</Text>
            <Text style={[s.tColHeader, s.col6]}>Amount</Text>
          </View>

          {data.items.map((item, idx) => (
            <View key={idx} style={s.tRow}>
              <Text style={[s.tCol, s.col1]}>{idx + 1}</Text>
              <View style={[s.tCol, s.col2]}>
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
              <Text style={[s.tCol, s.col3]}>{item.qty || 1}</Text>
              <Text style={[s.tCol, s.col4]}>{fmt(item.rate || item.price || 0)}</Text>
              <Text style={[s.tCol, s.col5]}>
                {Number(item.discount) > 0 ? `\u2212 ${fmt(item.discount || 0)}` : '\u2014'}
              </Text>
              <Text style={[s.tCol, s.col6]}>{fmt(item.value || item.price || 0)}</Text>
            </View>
          ))}
        </View>

        {/* ── TRADE-IN TABLE ── */}
        {data.trade_ins && data.trade_ins.length > 0 && (
          <View style={s.table}>
            <View style={s.tHeadRow}>
              <Text style={[s.tColHeader, s.col1]}>#</Text>
              <Text style={[s.tColHeader, s.col2, { textAlign: 'left' }]}>Trade-In Description</Text>
              <Text style={[s.tColHeader, s.col3]}>Qty</Text>
              <Text style={[s.tColHeader, s.col4]}> </Text>
              <Text style={[s.tColHeader, s.col5]}> </Text>
              <Text style={[s.tColHeader, s.col6]}>Credit</Text>
            </View>

            {data.trade_ins.map((item, idx) => (
              <View key={idx} style={s.tRow}>
                <Text style={[s.tCol, s.col1]}>{idx + 1}</Text>
                <View style={[s.tCol, s.col2]}>
                  <Text style={s.itemDesc}>
                    {item.description || `${item.brand || ''} ${item.model || ''}`.trim()}
                  </Text>
                  {item.imei && <Text style={s.itemSub}>IMEI: {item.imei}</Text>}
                </View>
                <Text style={[s.tCol, s.col3]}>{item.qty ? item.qty : ''}</Text>
                <Text style={[s.tCol, s.col4]}> </Text>
                <Text style={[s.tCol, s.col5]}> </Text>
                <Text style={[s.tCol, s.col6]}>
                  {fmt((item.qty || 1) * (item.rate || item.credit_value || 0))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── SUMMARY ── */}
        <View style={s.summarySection}>
          <View style={s.notesBox}>
            <Text style={s.amountWordsLabel}>Amount Chargeable (in words)</Text>
            <Text style={s.amountWords}>
              INR {numberToWords(Math.round(data.final_total))}
            </Text>
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
              <Text style={s.grandTotalLabel}>Total</Text>
              <Text style={s.grandTotalValue}>{fmt(data.final_total)}</Text>
            </View>

            {data.type !== 'proforma' && (
              <>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Amount Paid</Text>
                  <Text style={s.totalValue}>{fmt(data.paid)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Balance Due</Text>
                  <Text style={s.totalValue}>{fmt(data.due)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── SIGNATURE ── */}
        <View style={s.signatureSection}>
          <View style={s.signatureBox}>
            <Text style={s.signatureFor}>For {data.store?.name || 'Fusion Gadgets'}</Text>
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
