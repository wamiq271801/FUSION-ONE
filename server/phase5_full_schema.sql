-- Phase 5 Full Database Schema
-- Run this in your Supabase SQL Editor. 
-- Make sure to run the reset_database.sql first if you want a clean slate.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Tables

CREATE TABLE financial_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
  sale_counter INTEGER NOT NULL DEFAULT 0,
  purchase_counter INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT fy_date_check CHECK (start_date < end_date),
  CONSTRAINT fy_no_overlap EXCLUDE USING gist (
    daterange(start_date, end_date, '[]') WITH &&
  )
);

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
  onboarding_complete BOOLEAN DEFAULT false,
  active_financial_year_id UUID REFERENCES financial_years(id)
);

CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_cash BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  number TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  origin_inventory_item_id UUID, 
  opening_entry_type TEXT CHECK (opening_entry_type IN ('direct', 'carried_forward'))
);

-- Unique constraint: Only one "in_stock" item per IMEI
CREATE UNIQUE INDEX idx_unique_imei_in_stock ON inventory_items(imei) WHERE status = 'in_stock';
ALTER TABLE inventory_items ADD CONSTRAINT fk_origin_item FOREIGN KEY (origin_inventory_item_id) REFERENCES inventory_items(id);

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
  status TEXT NOT NULL CHECK (status IN ('active', 'void'))
);

CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id)
);

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
  status TEXT NOT NULL CHECK (status IN ('active', 'void'))
);

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  sold_price NUMERIC(12, 2) NOT NULL
);

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

CREATE TABLE payments_in (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id),
  party_id UUID NOT NULL REFERENCES parties(id),
  amount NUMERIC(12, 2) NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  payment_mode_id UUID REFERENCES payment_modes(id),
  date DATE NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id)
);

CREATE TABLE payments_out (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES purchases(id),
  party_id UUID NOT NULL REFERENCES parties(id),
  amount NUMERIC(12, 2) NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  payment_mode_id UUID REFERENCES payment_modes(id),
  date DATE NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id)
);

CREATE TABLE account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  payment_mode_id UUID REFERENCES payment_modes(id),
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('sale', 'purchase', 'payment_in', 'payment_out')),
  reference_id UUID NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id)
);

-- 2. Row Level Security Policies

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

-- Helper function to check if user is the owner
CREATE OR REPLACE FUNCTION is_owner() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM store WHERE owner_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Store policy: owner can access, and allow insert during onboarding
CREATE POLICY "Store Owner Access" ON store 
  FOR ALL TO authenticated 
  USING (owner_user_id = auth.uid()) 
  WITH CHECK (owner_user_id = auth.uid());

-- All other tables use is_owner()
CREATE POLICY "Owner Access" ON financial_years FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON bank_accounts FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON payment_modes FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON parties FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON inventory_items FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON purchases FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON purchase_items FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON sales FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON sale_items FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON trade_ins FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON payments_in FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON payments_out FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON account_transactions FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
