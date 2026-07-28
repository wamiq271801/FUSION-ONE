-- ============================================================
-- Backfill Missing Payment Records
-- Run this ONCE in Supabase SQL Editor.
-- 
-- This creates payments_out rows for purchases that were saved
-- with paid > 0 but have no corresponding payments_out record,
-- and payments_in rows for sales with the same issue.
--
-- Safe to re-run: uses NOT EXISTS to skip already-backfilled rows.
-- ============================================================

-- 1. Backfill payments_out for purchases with paid > 0
INSERT INTO payments_out (purchase_id, party_id, amount, bank_account_id, payment_mode_id, date, financial_year_id)
SELECT
  p.id,
  p.party_id,
  p.paid,
  p.bank_account_id,
  p.payment_mode_id,
  p.date,
  p.financial_year_id
FROM purchases p
WHERE p.paid > 0
  AND p.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM payments_out po WHERE po.purchase_id = p.id
  );

-- 2. Backfill payments_in for sales with paid > 0
INSERT INTO payments_in (sale_id, party_id, amount, bank_account_id, payment_mode_id, date, financial_year_id)
SELECT
  s.id,
  s.party_id,
  s.paid,
  s.bank_account_id,
  s.payment_mode_id,
  s.date,
  s.financial_year_id
FROM sales s
WHERE s.paid > 0
  AND s.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM payments_in pi WHERE pi.sale_id = s.id
  );
