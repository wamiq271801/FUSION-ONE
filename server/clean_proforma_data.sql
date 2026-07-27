-- Script: Clean All Proforma Invoice Data
-- Run this in your Supabase SQL Editor to wipe out all quotations/estimates

-- 1. Wipe all proforma invoices
-- (This will cascade delete all entries in proforma_invoice_items and proforma_trade_ins due to ON DELETE CASCADE)
DELETE FROM proforma_invoices;

-- 2. Reset the proforma counter in financial years
UPDATE financial_years SET proforma_counter = 0;
