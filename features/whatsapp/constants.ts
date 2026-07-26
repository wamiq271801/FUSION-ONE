/**
 * WhatsApp feature — constants.
 * Single canonical source for query keys and default templates.
 */

// ── TanStack Query keys ───────────────────────────────────────────────────────

export const waKeys = {
  status:   () => ['whatsapp-status']   as const,
  settings: () => ['whatsapp-settings'] as const,
};

// ── Default message templates ─────────────────────────────────────────────────

export const WA_DEFAULT_SALE_TEMPLATE = `*Invoice: {bill_number}*
Dear {customer_name},

Thank you for shopping at *{store_name}*! 🙏

📱 *Items Purchased:*
{item_list}

💰 *Bill Summary:*
Total: ₹{final_total}
Paid: ₹{paid}
Due: ₹{due}

📅 Date: {date}

_For any queries, please contact us._`;

export const WA_DEFAULT_PROFORMA_TEMPLATE = `*Quotation: {bill_number}*
Dear {customer_name},

Here is your quotation from *{store_name}*.

📋 *Items:*
{item_list}

💰 Total: ₹{final_total}
📅 Date: {date}

_Reply to confirm your order. Valid for 7 days._`;

// ── Supported template variables ──────────────────────────────────────────────

export const WA_TEMPLATE_VARS = [
  '{bill_number}',
  '{customer_name}',
  '{customer_phone}',
  '{store_name}',
  '{item_list}',
  '{final_total}',
  '{paid}',
  '{due}',
  '{date}',
  '{trade_in_credit}',
  '{discount}',
] as const;

export type WaTemplateVar = (typeof WA_TEMPLATE_VARS)[number];
