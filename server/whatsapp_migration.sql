-- ============================================================
-- WhatsApp Settings Migration
-- Run once in Supabase SQL Editor.
-- Creates the whatsapp_settings table for per-user WA config.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id              UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  auto_send_sale             BOOLEAN NOT NULL DEFAULT false,
  auto_send_proforma         BOOLEAN NOT NULL DEFAULT false,
  sale_message_template      TEXT NOT NULL DEFAULT
    '*Invoice: {bill_number}*
Dear {customer_name},

Thank you for shopping at *{store_name}*! 🙏

📱 *Items Purchased:*
{item_list}

💰 *Bill Summary:*
Total: ₹{final_total}
Paid: ₹{paid}
Due: ₹{due}

📅 Date: {date}

_For any queries, please contact us._',

  proforma_message_template  TEXT NOT NULL DEFAULT
    '*Quotation: {bill_number}*
Dear {customer_name},

Here is your quotation from *{store_name}*.

📋 *Items:*
{item_list}

💰 Total: ₹{final_total}
📅 Date: {date}

_Reply to confirm your order. Valid for 7 days._',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_settings_owner" ON whatsapp_settings;
CREATE POLICY "whatsapp_settings_owner" ON whatsapp_settings
  FOR ALL TO authenticated
  USING  (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
