-- FULL DATABASE RESET SCRIPT
-- WARNING: This will permanently delete all data and drop the tables.

DROP TABLE IF EXISTS account_transactions CASCADE;
DROP TABLE IF EXISTS payments_out CASCADE;
DROP TABLE IF EXISTS payments_in CASCADE;
DROP TABLE IF EXISTS trade_ins CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS purchase_items CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS parties CASCADE;
DROP TABLE IF EXISTS payment_modes CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS store CASCADE;
DROP TABLE IF EXISTS financial_years CASCADE;

DROP FUNCTION IF EXISTS is_owner() CASCADE;

-- Note: After running this, run phase5_full_schema.sql to recreate tables with RLS.
