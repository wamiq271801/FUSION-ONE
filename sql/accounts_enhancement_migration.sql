-- ============================================================
-- Accounts Enhancement Migration
-- Run this in your Supabase SQL Editor.
-- This is additive — no existing data is modified or dropped.
-- ============================================================

-- 1. Add new columns to account_transactions
ALTER TABLE account_transactions
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS transfer_group_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 2. Expand reference_type CHECK constraint
-- Drop the old constraint and recreate with new values
ALTER TABLE account_transactions DROP CONSTRAINT IF EXISTS account_transactions_reference_type_check;
ALTER TABLE account_transactions ADD CONSTRAINT account_transactions_reference_type_check
  CHECK (reference_type IN ('sale', 'purchase', 'payment_in', 'payment_out', 'add_funds', 'transfer', 'opening_balance'));

-- 3. Create account_fund_entries table
CREATE TABLE IF NOT EXISTS account_fund_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  notes TEXT,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create account_transfers table
CREATE TABLE IF NOT EXISTS account_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  to_bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  notes TEXT,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT transfer_different_accounts CHECK (from_bank_account_id != to_bank_account_id)
);

-- 5. Enable RLS on new tables
ALTER TABLE account_fund_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies (drop first to make idempotent)
DROP POLICY IF EXISTS "Owner Access" ON account_fund_entries;
CREATE POLICY "Owner Access" ON account_fund_entries FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
DROP POLICY IF EXISTS "Owner Access" ON account_transfers;
CREATE POLICY "Owner Access" ON account_transfers FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());
