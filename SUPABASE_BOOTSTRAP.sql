-- ============================================================
-- FUSION-ONE — Complete Supabase Bootstrap SQL
-- ============================================================
-- This script creates the ENTIRE database schema from scratch
-- on a completely empty Supabase project.
--
-- Usage:
--   1. Create a new Supabase project (or reset an existing one).
--   2. Run this script in the Supabase SQL Editor.
--   3. Run SUPABASE_SEED.sql to insert test data.
--
-- This bootstrap consolidates all incremental migrations:
--   - phase5_full_schema.sql (base schema)
--   - proforma_module_migration.sql
--   - proforma_trade_in_migration.sql
--   - proforma_item_discount_migration.sql
--   - signature_feature_migration.sql
--   - void_migration.sql (cancelled status)
--   - accounts_enhancement_migration.sql
--   - whatsapp_migration.sql
--   - whatsapp_purchase_migration.sql
--   - whatsapp_template_update.sql
--   - invoice_templates column (used in code, missing from SQL)
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── 1. Tables ──────────────────────────────────────────────

-- Financial years (one active at a time)
CREATE TABLE financial_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
  sale_counter INTEGER NOT NULL DEFAULT 0,
  purchase_counter INTEGER NOT NULL DEFAULT 0,
  proforma_counter INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fy_date_check CHECK (start_date < end_date),
  CONSTRAINT fy_no_overlap EXCLUDE USING gist (
    daterange(start_date, end_date, '[]') WITH &&
  )
);

-- Store profile (one per user)
CREATE TABLE store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  website TEXT,
  gstin TEXT,
  logo_url TEXT,
  signature_url TEXT,
  onboarding_complete BOOLEAN DEFAULT false,
  active_financial_year_id UUID REFERENCES financial_years(id),
  invoice_templates JSONB DEFAULT '{"sale":"prestige","purchase":"prestige","proforma":"prestige"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bank accounts (cash + bank)
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_cash BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payment modes per bank account
CREATE TABLE payment_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

-- Parties (customers + suppliers)
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  number TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory items (IMEI-tracked)
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  imei TEXT NOT NULL,
  ram_rom TEXT,
  color TEXT,
  purchase_price NUMERIC(12, 2) NOT NULL,
  base_selling_price NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_stock', 'sold')),
  source TEXT NOT NULL CHECK (source IN ('purchase', 'trade_in')),
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  origin_inventory_item_id UUID,
  opening_entry_type TEXT CHECK (opening_entry_type IN ('direct', 'carried_forward'))
);

-- Unique: only one in_stock item per IMEI
CREATE UNIQUE INDEX idx_unique_imei_in_stock ON inventory_items(imei) WHERE status = 'in_stock';
ALTER TABLE inventory_items ADD CONSTRAINT fk_origin_item
  FOREIGN KEY (origin_inventory_item_id) REFERENCES inventory_items(id);

-- Purchases
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL,
  party_id UUID NOT NULL REFERENCES parties(id),
  total NUMERIC(12, 2) NOT NULL,
  paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  payment_mode_id UUID REFERENCES payment_modes(id),
  date DATE NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase items (purchase ↔ inventory_item mapping)
CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id)
);

-- Sales
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL,
  party_id UUID NOT NULL REFERENCES parties(id),
  total NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  trade_in_credit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  final_total NUMERIC(12, 2) NOT NULL,
  paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  payment_mode_id UUID REFERENCES payment_modes(id),
  date DATE NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sale items (sale ↔ inventory_item mapping)
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  sold_price NUMERIC(12, 2) NOT NULL
);

-- Trade-ins (device received in exchange for a sale)
CREATE TABLE trade_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  imei TEXT NOT NULL,
  ram_rom TEXT,
  color TEXT,
  credit_value NUMERIC(12, 2) NOT NULL,
  mrp NUMERIC(12, 2),
  document_url TEXT,
  new_inventory_item_id UUID REFERENCES inventory_items(id)
);

-- Payments in (customer payments)
CREATE TABLE payments_in (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id),
  party_id UUID NOT NULL REFERENCES parties(id),
  amount NUMERIC(12, 2) NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  payment_mode_id UUID REFERENCES payment_modes(id),
  date DATE NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments out (supplier payments)
CREATE TABLE payments_out (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES purchases(id),
  party_id UUID NOT NULL REFERENCES parties(id),
  amount NUMERIC(12, 2) NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  payment_mode_id UUID REFERENCES payment_modes(id),
  date DATE NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Account transactions (ledger entries)
CREATE TABLE account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  payment_mode_id UUID REFERENCES payment_modes(id),
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN (
    'sale', 'purchase', 'payment_in', 'payment_out',
    'add_funds', 'transfer', 'opening_balance', 'sale_cancelled'
  )),
  reference_id UUID NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  notes TEXT,
  transfer_group_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Account fund entries (manual fund additions to bank accounts)
CREATE TABLE account_fund_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  notes TEXT,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Account transfers (between bank accounts)
CREATE TABLE account_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  to_bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  notes TEXT,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT transfer_different_accounts CHECK (from_bank_account_id != to_bank_account_id)
);

-- Proforma invoices (quotations)
CREATE TABLE proforma_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL,
  party_id UUID NOT NULL REFERENCES parties(id),
  total NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  trade_in_credit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  final_total NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'converted', 'void')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Proforma invoice items
CREATE TABLE proforma_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_invoice_id UUID NOT NULL REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  rate NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  value NUMERIC(12, 2) NOT NULL
);

-- Proforma trade-ins (estimated trade-in details on a quotation)
CREATE TABLE proforma_trade_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_invoice_id UUID REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty INTEGER,
  rate NUMERIC(12, 2) NOT NULL,
  value NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- WhatsApp settings (per-user delivery configuration — loaded/saved by the
-- WhatsApp Delivery settings panel; runtime engine state stays separate)
CREATE TABLE whatsapp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  auto_send_sale BOOLEAN NOT NULL DEFAULT false,
  auto_send_purchase BOOLEAN NOT NULL DEFAULT false,
  auto_send_proforma BOOLEAN NOT NULL DEFAULT false,
  sale_message_template TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your invoice {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}

Thank you for your business.',
  purchase_message_template TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your purchase bill {{invoice_number}} from {{company_name}} attached.

Total: ₹{{grand_total}}',
  proforma_message_template TEXT NOT NULL DEFAULT
    'Hello {{customer_name}},

Please find your quotation {{invoice_number}} from {{company_name}} attached.

Estimated Total: ₹{{grand_total}}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. Row Level Security ───────────────────────────────────

ALTER TABLE financial_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE store ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_in ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_fund_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_trade_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- ─── 3. Security Functions ───────────────────────────────────

-- is_owner(): returns true if the authenticated user owns the store
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM store WHERE owner_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 4. RLS Policies ────────────────────────────────────────

-- Store: owner check via auth.uid() directly
CREATE POLICY "Store Owner Access" ON store
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- All business tables: owner check via is_owner()
CREATE POLICY "Owner Access" ON financial_years
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON bank_accounts
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON payment_modes
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON parties
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON inventory_items
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON purchases
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON purchase_items
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON sales
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON sale_items
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON trade_ins
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON payments_in
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON payments_out
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON account_transactions
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON account_fund_entries
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON account_transfers
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON proforma_invoices
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON proforma_invoice_items
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON proforma_trade_ins
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());

-- WhatsApp settings: owner check via auth.uid() directly
CREATE POLICY "whatsapp_settings_owner" ON whatsapp_settings
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE whatsapp_settings TO authenticated;

-- ─── 5. Storage Buckets ─────────────────────────────────────

-- store_assets: logos and signature images (public read, auth write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('store_assets', 'store_assets', true)
ON CONFLICT (id) DO NOTHING;

-- documents: trade-in documents and other files (public read, auth write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- ─── 6. Storage Policies ────────────────────────────────────

-- store_assets: authenticated users can read + write
CREATE POLICY "store_assets_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'store_assets');

CREATE POLICY "store_assets_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store_assets');

CREATE POLICY "store_assets_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'store_assets');

CREATE POLICY "store_assets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'store_assets');

-- documents: authenticated users can read + write
CREATE POLICY "documents_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "documents_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "documents_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents');

-- ─── 7. Indexes ─────────────────────────────────────────────

CREATE INDEX idx_sales_party_id ON sales(party_id);
CREATE INDEX idx_sales_date ON sales(date);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_purchases_party_id ON purchases(party_id);
CREATE INDEX idx_purchases_date ON purchases(date);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_inventory_status ON inventory_items(status);
CREATE INDEX idx_inventory_fy ON inventory_items(financial_year_id);
CREATE INDEX idx_payments_in_sale ON payments_in(sale_id);
CREATE INDEX idx_payments_out_purchase ON payments_out(purchase_id);
CREATE INDEX idx_account_tx_date ON account_transactions(date);
CREATE INDEX idx_account_tx_ref ON account_transactions(reference_type, reference_id);
CREATE INDEX idx_proforma_status ON proforma_invoices(status);
CREATE INDEX idx_proforma_date ON proforma_invoices(date);

-- ─── Done ───────────────────────────────────────────────────
-- Now run SUPABASE_SEED.sql to insert test data.
