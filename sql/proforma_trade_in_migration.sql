-- Migration: Add Trade-In Support to Proforma Invoices
-- Run this in your Supabase SQL Editor

-- 1. Add trade_in_credit column to proforma_invoices
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS trade_in_credit NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- 2. Create proforma_trade_ins table (stores estimate trade-in details)
CREATE TABLE IF NOT EXISTS proforma_trade_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_invoice_id UUID REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty INTEGER,
  rate NUMERIC(12, 2) NOT NULL,
  value NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Enable RLS
ALTER TABLE proforma_trade_ins ENABLE ROW LEVEL SECURITY;

-- 4. Enable Owner Access Policy
DROP POLICY IF EXISTS "Owner Access" ON proforma_trade_ins;
CREATE POLICY "Owner Access" ON proforma_trade_ins FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
