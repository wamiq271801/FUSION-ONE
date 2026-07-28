-- ============================================================
-- Cancel Migration (replaces void_migration.sql)
-- Run in Supabase SQL Editor. Safe to run multiple times.
--
-- Changes:
--   1. sales.status: replaces 'void' with 'cancelled'
--   2. purchases.status: replaces 'void' with 'cancelled'
--   3. account_transactions.reference_type: replaces 'sale_void' with 'sale_cancelled'
--   4. Updates any existing rows that still carry the old 'void' value
-- ============================================================

-- 1. Update sales status constraint
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN ('active', 'cancelled'));

-- Migrate any existing 'void' rows
UPDATE sales SET status = 'cancelled' WHERE status = 'void';

-- 2. Update purchases status constraint
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('active', 'cancelled'));

-- Migrate any existing 'void' rows
UPDATE purchases SET status = 'cancelled' WHERE status = 'void';

-- 3. Update account_transactions reference_type constraint
ALTER TABLE account_transactions
  DROP CONSTRAINT IF EXISTS account_transactions_reference_type_check;

ALTER TABLE account_transactions
  ADD CONSTRAINT account_transactions_reference_type_check
  CHECK (reference_type IN (
    'sale',
    'purchase',
    'payment_in',
    'payment_out',
    'add_funds',
    'transfer',
    'opening_balance',
    'sale_cancelled'
  ));

-- Migrate any existing 'sale_void' rows
UPDATE account_transactions SET reference_type = 'sale_cancelled' WHERE reference_type = 'sale_void';
