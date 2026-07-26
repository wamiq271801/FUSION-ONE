-- Migration: Add Proforma Invoices Module
-- Run this in your Supabase SQL Editor

-- 1. Add proforma_counter to financial_years
ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS proforma_counter INTEGER NOT NULL DEFAULT 0;

-- 2. Create proforma_invoices table
CREATE TABLE IF NOT EXISTS proforma_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL,
  party_id UUID NOT NULL REFERENCES parties(id),
  total NUMERIC(12, 2) NOT NULL,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  final_total NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'converted', 'void')) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create proforma_invoice_items table
CREATE TABLE IF NOT EXISTS proforma_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_invoice_id UUID NOT NULL REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  rate NUMERIC(12, 2) NOT NULL,
  value NUMERIC(12, 2) NOT NULL
);

-- 4. Enable Row Level Security
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoice_items ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS Policies
-- Note: relies on the existing is_owner() function
CREATE POLICY "Owner Access" ON proforma_invoices FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "Owner Access" ON proforma_invoice_items FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
