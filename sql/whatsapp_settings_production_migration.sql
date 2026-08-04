-- ============================================================
-- WhatsApp Settings Production Migration
-- ============================================================
-- Apply through the normal production migration process.
--
-- This supersedes the previously manual whatsapp_migration.sql for
-- deployments that never received that script. It is additive and safe to
-- run against databases where the table already exists.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  auto_send_sale BOOLEAN NOT NULL DEFAULT false,
  sale_message_template TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your invoice {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}

Thank you for your business.',
  auto_send_purchase BOOLEAN NOT NULL DEFAULT false,
  purchase_message_template TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your purchase bill {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}',
  auto_send_proforma BOOLEAN NOT NULL DEFAULT false,
  proforma_message_template TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your quotation {{invoice_number}} from {{company_name}} attached.

Estimated Total: ₹{{grand_total}}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bring databases that received only an earlier partial WhatsApp script up
-- to the complete six-setting schema without altering stored user settings.
ALTER TABLE whatsapp_settings
  ADD COLUMN IF NOT EXISTS auto_send_sale BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_message_template TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your invoice {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}

Thank you for your business.',
  ADD COLUMN IF NOT EXISTS auto_send_purchase BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_message_template TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your purchase bill {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}',
  ADD COLUMN IF NOT EXISTS auto_send_proforma BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proforma_message_template TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your quotation {{invoice_number}} from {{company_name}} attached.

Estimated Total: ₹{{grand_total}}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Keep defaults aligned for databases that received an older table version.
-- The UNIQUE owner constraint creates the lookup/upsert index used by the
-- settings page, so no redundant secondary index is required.
ALTER TABLE whatsapp_settings
  ALTER COLUMN sale_message_template SET DEFAULT
    'Hello {{customer_name}},

Please find your invoice {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}

Thank you for your business.',
  ALTER COLUMN purchase_message_template SET DEFAULT
    'Hello {{customer_name}},

Please find your purchase bill {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}',
  ALTER COLUMN proforma_message_template SET DEFAULT
    'Hello {{customer_name}},

Please find your quotation {{invoice_number}} from {{company_name}} attached.

Estimated Total: ₹{{grand_total}}';

ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_settings_owner" ON whatsapp_settings;
CREATE POLICY "whatsapp_settings_owner" ON whatsapp_settings
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE whatsapp_settings TO authenticated;
