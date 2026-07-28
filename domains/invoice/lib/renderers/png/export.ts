import type { InvoiceData } from '../../types';
import { buildInvoiceViewModel } from '../../view-model';
import { drawPrestigeInvoice } from './layout';

export async function renderInvoicePng(data: InvoiceData): Promise<Buffer> {
  return drawPrestigeInvoice(buildInvoiceViewModel(data));
}
