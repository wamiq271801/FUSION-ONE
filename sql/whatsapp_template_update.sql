-- ============================================================
-- WhatsApp Template Update — Compact Professional Defaults
-- Run once in Supabase SQL Editor (idempotent).
--
-- Supabase is the single source of truth for invoice WhatsApp message
-- templates. Run whatsapp_settings_production_migration.sql first when the
-- production database does not yet have whatsapp_settings.
-- ============================================================

-- ─── 1. Update column DEFAULTs (for fresh rows / brand-new users) ──

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

-- ─── 2. Replace existing stored template values ─────────────────
-- (Applies the same compact templates to every existing whatsapp_settings row.)

-- Seed one default configuration for every existing store owner that does
-- not have one yet. The table defaults provide all three message templates
-- and leave all three auto-send settings disabled.
INSERT INTO whatsapp_settings (owner_user_id)
SELECT DISTINCT owner_user_id
FROM store
WHERE owner_user_id IS NOT NULL
ON CONFLICT (owner_user_id) DO NOTHING;

-- Replace existing stored template values.
UPDATE whatsapp_settings SET
  sale_message_template = 'Hello {{customer_name}},

Please find your invoice {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}

Thank you for your business.',
  purchase_message_template = 'Hello {{customer_name}},

Please find your purchase bill {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}',
  proforma_message_template = 'Hello {{customer_name}},

Please find your quotation {{invoice_number}} from {{company_name}} attached.

Estimated Total: ₹{{grand_total}}';

-- ─── Done ──────────────────────────────────────────────────────
