/**
 * Sales domain types.
 */
import type { Party } from './common';

export interface SaleItem {
  id?: string;
  inventory_item_id?: string;
  sold_price: number;
  inventory_items?: {
    brand?: string;
    model?: string;
    imei?: string;
    ram_rom?: string;
    color?: string;
    base_selling_price?: number;
  };
}

export interface TradeIn {
  id?: string;
  sale_id?: string;
  brand?: string;
  model?: string;
  imei?: string;
  amount?: number;
}

export interface Sale {
  id: string;
  bill_number: string;
  date: string;
  financial_year_id: string;
  party_id: string;
  parties?: Pick<Party, 'name' | 'number'>;
  subtotal: number;
  discount: number;
  trade_in_credit: number;
  final_total: number;
  paid: number;
  due: number;
  status: 'active' | 'cancelled';
  notes?: string;
}

export interface SaleDetail {
  items: SaleItem[];
  tradeIns: TradeIn[];
  store: import('./common').Store | null;
}
