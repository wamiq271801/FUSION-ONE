/**
 * Sales — business logic helpers.
 *
 * Extracted from app/sales/page.tsx.
 * Converts raw Supabase rows into the InvoiceData shape required by the PDF client.
 */
import type { InvoiceData } from '@/domains/invoice/types';

export function buildSaleInvoiceData(
  sale: any,
  detail: { items: any[]; tradeIns: any[]; store: any },
  template: any,
): InvoiceData {
  const additionalDiscount = Number(sale.discount) || 0;

  const mappedItems = detail.items.map((line: any) => {
    const basePrice  = Number(line.inventory_items?.base_selling_price) || Number(line.sold_price) || 0;
    const soldPrice  = Number(line.sold_price) || 0;
    return {
      ...line.inventory_items,
      qty:      1,
      rate:     basePrice,
      price:    basePrice,
      discount: Math.max(0, basePrice - soldPrice),
      value:    soldPrice,
    };
  });

  const itemDiscountTotal = mappedItems.reduce((s: number, i: any) => s + (i.discount || 0), 0);
  const subtotal          = mappedItems.reduce((s: number, i: any) => s + (i.rate    || 0), 0);

  return {
    type:               'sale',
    template,
    store:              detail.store,
    bill_number:        sale.bill_number,
    date:               sale.date,
    party:              sale.parties,
    items:              mappedItems,
    subtotal,
    item_discount:      itemDiscountTotal,
    additional_discount: additionalDiscount,
    discount:           itemDiscountTotal + additionalDiscount,
    trade_in_credit:    Number(sale.trade_in_credit),
    final_total:        Number(sale.final_total),
    paid:               Number(sale.paid),
    due:                Number(sale.due),
    trade_ins:          detail.tradeIns,
  };
}

/**
 * Validate receive-payment form fields.
 * Returns an error message string, or null if valid.
 */
export function validateReceivePayment(opts: {
  date:           string;
  fyStart:        string;
  fyEnd:          string;
  bankAccountId:  string;
  isCash:         boolean;
  paymentModeId:  string;
  amount:         number;
  due:            number;
}): string | null {
  const { date, fyStart, fyEnd, bankAccountId, isCash, paymentModeId, amount, due } = opts;
  if (!date)                                    return 'Date is required';
  if (date < fyStart || date > fyEnd)           return 'Date must be within FY';
  if (!bankAccountId)                           return 'Account is required';
  if (!isCash && !paymentModeId)                return 'Payment mode required for non-cash accounts';
  if (isNaN(amount) || amount <= 0)             return 'Amount must be greater than zero';
  if (amount > due)                             return 'Cannot exceed due amount';
  return null;
}
