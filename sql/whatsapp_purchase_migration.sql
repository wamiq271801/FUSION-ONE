-- ============================================================
-- WhatsApp Settings — Purchase Columns & Aligned Template Defaults
-- Run once in Supabase SQL Editor (idempotent).
--
-- The whatsapp_settings table (created by whatsapp_migration.sql /
-- SUPABASE_BOOTSTRAP.sql) previously only stored sale + proforma
-- delivery configuration. Purchase invoices are now deliverable too,
-- so this adds the matching purchase columns.
--
-- It also aligns the message-template column DEFAULTs to the
-- application's {{placeholder}} syntax so that values loaded straight
-- from Supabase resolve correctly through resolveDeliveryMessage().
-- ============================================================

-- ─── 1. Add purchase columns (idempotent) ──────────────────────

ALTER TABLE whatsapp_settings
  ADD COLUMN IF NOT EXISTS auto_send_purchase BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE whatsapp_settings
  ADD COLUMN IF NOT EXISTS purchase_message_template TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your purchase bill {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}';

-- ─── 2. Set compact professional template defaults ────────────
-- (The application reads templates exclusively from Supabase; these are the
--  DB-layer defaults used for fresh rows.)

ALTER TABLE whatsapp_settings ALTER COLUMN sale_message_template SET DEFAULT
    'Hello {{customer_name}},

Please find your invoice {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}

Thank you for your business.';

ALTER TABLE whatsapp_settings ALTER COLUMN purchase_message_template SET DEFAULT
    'Hello {{customer_name}},

Please find your purchase bill {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}';

ALTER TABLE whatsapp_settings ALTER COLUMN proforma_message_template SET DEFAULT
    'Hello {{customer_name}},

Please find your quotation {{invoice_number}} from {{company_name}} attached.

Estimated Total: ₹{{grand_total}}';

-- ─── Done ──────────────────────────────────────────────────────
