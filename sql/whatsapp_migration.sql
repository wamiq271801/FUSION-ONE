-- ============================================================
-- WhatsApp Settings Migration
-- Run once in Supabase SQL Editor.
-- Creates the whatsapp_settings table for per-user WA config.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id              UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  auto_send_sale             BOOLEAN NOT NULL DEFAULT false,
  auto_send_purchase         BOOLEAN NOT NULL DEFAULT false,
  auto_send_proforma         BOOLEAN NOT NULL DEFAULT false,
  sale_message_template      TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your invoice {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}

Thank you for your business.',

  purchase_message_template  TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your purchase bill {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}',

  proforma_message_template  TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your quotation {{invoice_number}} from {{company_name}} attached.

Estimated Total: ₹{{grand_total}}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_settings_owner" ON whatsapp_settings;
CREATE POLICY "whatsapp_settings_owner" ON whatsapp_settings
  FOR ALL TO authenticated
  USING  (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
