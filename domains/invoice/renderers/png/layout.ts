import { createCanvas } from '@napi-rs/canvas';
import type { InvoiceViewModel } from '../../view-model';
import { formatCurrency } from '../../view-model';
import { loadOptionalImage, prestigeColors as C } from './assets';
import { lines, text } from './utilities';

const W = 1600, M = 88;
export async function drawPrestigeInvoice(vm: InvoiceViewModel): Promise<Buffer> {
  const rows = vm.items.length + vm.trade_ins.length;
  const height = Math.max(1500, 1110 + rows * 88 + (vm.trade_ins.length ? 90 : 0));
  const canvas = createCanvas(W, height); const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, height); ctx.fillStyle = C.gold; ctx.fillRect(0, 0, W, 6);
  const logo = await loadOptionalImage(vm.store?.logo_url); const signature = await loadOptionalImage(vm.store?.signature_url);
  ctx.strokeStyle = C.black; ctx.lineWidth = 2; ctx.strokeRect(M, 44, 74, 74);
  if (logo) ctx.drawImage(logo, M, 44, 74, 74); else text(ctx, (vm.store?.name || 'FG').slice(0, 2).toUpperCase(), M + 37, 91, 29, 'bold', C.black, 'center');
  text(ctx, vm.store?.name || 'FUSION GADGETS', M + 94, 76, 29, 'bold');
  if (vm.store?.gstin) text(ctx, `GSTIN: ${vm.store.gstin}`, M + 94, 101, 15, 'normal', C.muted);
  let contactY = 66; for (const contact of [vm.store?.phone, vm.store?.email, vm.store?.address?.replace(/\n/g, ', ')].filter(Boolean) as string[]) { text(ctx, contact, W - M, contactY, 14, 'normal', C.muted, 'right'); contactY += 23; }
  ctx.strokeStyle = C.black; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 140); ctx.lineTo(W, 140); ctx.stroke();
  text(ctx, vm.type === 'purchase' ? 'RECEIVED FROM' : 'BILL TO', M, 195, 16, 'bold', C.gold); text(ctx, vm.party?.name || 'Cash Customer', M, 234, 26, 'bold');
  let partyY = 260; if (vm.party?.address) partyY += lines(ctx, vm.party.address.replace(/\n/g, ', '), M, partyY, 560, 22, 15, 'normal', C.muted); if (vm.party?.number) text(ctx, `Contact No.  ${vm.party.number}`, M, partyY + 25, 15, 'normal', C.muted);
  ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(800, 174); ctx.lineTo(800, 330); ctx.stroke();
  text(ctx, vm.title, 860, 205, 42, 'bold'); text(ctx, 'INVOICE NO.', 860, 252, 13, 'bold'); text(ctx, vm.bill_number, 1060, 252, 15, 'normal', C.muted); text(ctx, 'DATE', 860, 280, 13, 'bold'); text(ctx, vm.formattedDate, 1060, 280, 15, 'normal', C.muted);
  ctx.strokeStyle = C.border; ctx.beginPath(); ctx.moveTo(0, 350); ctx.lineTo(W, 350); ctx.stroke();
  let y = 397; text(ctx, 'ITEMS PURCHASED', M, y, 16, 'bold', C.muted); y += 25; ctx.fillStyle = C.black; ctx.fillRect(M, y, W - M * 2, 43);
  const cols = [M + 20, M + 88, 900, 1060, 1250, W - M - 18]; ['#', 'ITEM DESCRIPTION', 'QTY', 'RATE (MRP)', 'DISCOUNT', 'AMOUNT'].forEach((h, i) => text(ctx, h, cols[i], y + 27, 13, 'bold', C.white, i > 1 ? 'right' : 'left')); y += 43;
  const row = (item: { descriptionText: string; detailsText?: string; qty?: number; rateText?: string; discountText?: string; amountText: string }, index: number, green = false) => { const color = green ? C.green : C.black, bg = green ? C.greenBg : C.white; ctx.fillStyle = bg; ctx.fillRect(M, y, W - M * 2, 72); text(ctx, String(index), cols[0], y + 30, 14, 'normal', color); text(ctx, item.descriptionText || 'Item', cols[1], y + 26, 15, 'bold', color); if (item.detailsText) text(ctx, item.detailsText, cols[1], y + 49, 12, 'normal', green ? '#4B8B55' : C.muted); text(ctx, String(item.qty || 1), cols[2], y + 30, 14, 'normal', color, 'right'); if (item.rateText) text(ctx, item.rateText, cols[3], y + 30, 14, 'normal', color, 'right'); if (item.discountText) text(ctx, item.discountText, cols[4], y + 30, 14, 'normal', color, 'right'); text(ctx, item.amountText, cols[5], y + 30, 14, 'normal', color, 'right'); ctx.strokeStyle = green ? C.greenBorder : C.border; ctx.beginPath(); ctx.moveTo(M, y + 72); ctx.lineTo(W - M, y + 72); ctx.stroke(); y += 72; };
  vm.items.forEach((item, index) => row(item, index + 1));
  if (vm.trade_ins.length) { y += 32; text(ctx, 'TRADE-IN', M, y, 16, 'bold', C.green); y += 20; ctx.fillStyle = C.greenBg; ctx.fillRect(M, y, W - M * 2, 39); ['#', 'DESCRIPTION', 'QTY', '', '', 'AMOUNT'].forEach((h, i) => text(ctx, h, cols[i], y + 25, 13, 'bold', C.green, i > 1 ? 'right' : 'left')); y += 39; vm.trade_ins.forEach((item, index) => row({ ...item, detailsText: item.imei ? `IMEI: ${item.imei}` : '', }, index + 1, true)); }
  y += 50; ctx.strokeStyle = C.border; ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); y += 42;
  text(ctx, 'AMOUNT IN WORDS', M, y, 15, 'bold', C.faint); lines(ctx, vm.amountWords, M, y + 28, 590, 23, 15, 'italic'); text(ctx, 'TERMS & CONDITIONS', M, y + 115, 15, 'bold', C.faint); ['1. Goods once sold will not be taken back or exchanged.', '2. Warranty as per manufacturer terms.', '3. Thank you for doing business with us.'].forEach((line, i) => text(ctx, line, M, y + 143 + i * 23, 13, 'normal', C.muted));
  const tx = 1020; let ty = y; const total = (label: string, value: string, bold = false) => { text(ctx, label, tx, ty, 15, bold ? 'bold' : 'normal', bold ? C.black : C.muted); text(ctx, value, W - M, ty, 15, bold ? 'bold' : 'normal', C.black, 'right'); ty += 31; }; total('Subtotal', formatCurrency(vm.subtotal)); if (vm.additional_discount && vm.item_discount) total('Product Discount', `− ${formatCurrency(vm.item_discount)}`); if (vm.additional_discount) total('Additional Discount', `− ${formatCurrency(vm.additional_discount)}`); if (vm.discount) total('Total Discount', `− ${formatCurrency(vm.discount)}`, true); if (vm.trade_in_credit) total('Trade-In Deduction', `− ${formatCurrency(vm.trade_in_credit)}`); ctx.fillStyle = C.black; ctx.fillRect(tx - 18, ty + 3, W - M - tx + 18, 58); text(ctx, 'GRAND TOTAL', tx, ty + 39, 16, 'bold', C.white); text(ctx, formatCurrency(vm.final_total), W - M - 15, ty + 39, 21, 'bold', C.gold, 'right'); ty += 94; if (vm.type !== 'proforma') { total('Amount Received', formatCurrency(vm.paid)); total('Balance Due', formatCurrency(vm.due), true); }
  const footerY = height - 52; if (signature) ctx.drawImage(signature, W - M - 200, footerY - 112, 130, 52); ctx.strokeStyle = C.black; ctx.beginPath(); ctx.moveTo(W - M - 250, footerY - 45); ctx.lineTo(W - M, footerY - 45); ctx.stroke(); text(ctx, vm.store?.name || 'Fusion Gadgets', W - M - 125, footerY - 25, 12, 'bold', C.black, 'center'); text(ctx, 'Authorized Signatory', W - M - 125, footerY - 8, 11, 'normal', C.muted, 'center'); ctx.fillStyle = C.black; ctx.fillRect(0, height - 32, W, 32); text(ctx, vm.store?.name || 'Fusion Gadgets', M, height - 11, 12, 'bold', C.gold); text(ctx, 'This is a computer-generated invoice.', W - M, height - 11, 11, 'normal', C.muted, 'right');
  return canvas.toBuffer('image/png');
}
