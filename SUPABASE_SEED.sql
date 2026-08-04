-- ============================================================
-- FUSION-ONE — Seed Data
-- ============================================================
-- Run AFTER SUPABASE_BOOTSTRAP.sql on a fresh Supabase project.
--
-- Mock user:
--   Email: mock@email.com
--   UID:   975839b1-18b7-4339-a9dd-00863521bb29
--
-- This seed must be run AFTER the mock user has been created
-- via Supabase Auth (signup or admin create). If the user does
-- not exist in auth.users, the foreign key on whatsapp_settings
-- will fail.
-- ============================================================

-- ─── 0. Mock User (create if not exists) ────────────────────
-- This INSERT is safe to re-run: it skips if the user already exists.
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
SELECT
  '975839b1-18b7-4339-a9dd-00863521bb29',
  'mock@email.com',
  crypt('mockpassword123', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated'
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = '975839b1-18b7-4339-a9dd-00863521bb29'
);

-- ─── 1. Financial Year ───────────────────────────────────────

INSERT INTO financial_years (id, start_date, end_date, status, sale_counter, purchase_counter, proforma_counter)
VALUES (
  'a1b2c3d4-0001-4000-8000-000000000001',
  '2025-04-01',
  '2026-03-31',
  'active',
  3,  -- already have 3 sales in seed
  2,  -- already have 2 purchases in seed
  1   -- already have 1 proforma in seed
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Store ───────────────────────────────────────────────

INSERT INTO store (id, owner_user_id, name, address, phone, email, website, gstin, onboarding_complete, active_financial_year_id, invoice_templates)
VALUES (
  'a1b2c3d4-0002-4000-8000-000000000002',
  '975839b1-18b7-4339-a9dd-00863521bb29',
  'Fusion Gadgets',
  'Shop No. 12, MG Road, Bengaluru, Karnataka 560001',
  '+91 98765 43210',
  'contact@fusiongadgets.in',
  'https://fusiongadgets.in',
  '29ABCDE1234F1Z5',
  true,
  'a1b2c3d4-0001-4000-8000-000000000001',
  '{"sale":"prestige","purchase":"prestige","proforma":"prestige"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Bank Accounts ───────────────────────────────────────

INSERT INTO bank_accounts (id, name, is_cash) VALUES
  ('a1b2c3d4-0101-4000-8000-000000000001', 'Cash', true),
  ('a1b2c3d4-0101-4000-8000-000000000002', 'HDFC Bank', false),
  ('a1b2c3d4-0101-4000-8000-000000000003', 'ICICI Bank', false)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Payment Modes ──────────────────────────────────────

INSERT INTO payment_modes (id, bank_account_id, name) VALUES
  ('a1b2c3d4-0102-4000-8000-000000000001', 'a1b2c3d4-0101-4000-8000-000000000002', 'UPI'),
  ('a1b2c3d4-0102-4000-8000-000000000002', 'a1b2c3d4-0101-4000-8000-000000000002', 'Card'),
  ('a1b2c3d4-0102-4000-8000-000000000003', 'a1b2c3d4-0101-4000-8000-000000000003', 'NEFT'),
  ('a1b2c3d4-0102-4000-8000-000000000004', 'a1b2c3d4-0101-4000-8000-000000000001', 'Cash')
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Parties (Customers + Suppliers) ─────────────────────

INSERT INTO parties (id, name, number, address) VALUES
  -- Customers
  ('a1b2c3d4-0103-4000-8000-000000000001', 'Rahul Sharma',  '9876543210', '123 Brigade Road, Bengaluru, 560025'),
  ('a1b2c3d4-0103-4000-8000-000000000002', 'Priya Patel',  '9876543211', '456 MG Road, Bengaluru, 560001'),
  ('a1b2c3d4-0103-4000-8000-000000000003', 'Arun Kumar',   '9876543212', '789 Indiranagar, Bengaluru, 560038'),
  ('a1b2c3d4-0103-4000-8000-000000000004', 'Sneha Reddy',  '9876543213', '321 Koramangala, Bengaluru, 560034'),
  ('a1b2c3d4-0103-4000-8000-000000000005', 'Vikram Singh', '9876543214', '654 Jayanagar, Bengaluru, 560011'),
  -- Suppliers
  ('a1b2c3d4-0103-4000-8000-000000000006', 'Samsung Distributor',   '9123456701', 'Whitefield, Bengaluru, 560066'),
  ('a1b2c3d4-0103-4000-8000-000000000007', 'Apple Reseller Hub',    '9123456702', 'Electronic City, Bengaluru, 560100')
ON CONFLICT (id) DO NOTHING;

-- ─── 6. Inventory Items (from purchases) ────────────────────

INSERT INTO inventory_items (id, brand, model, imei, ram_rom, color, purchase_price, base_selling_price, status, source, financial_year_id, opening_entry_type) VALUES
  -- Samsung Galaxy S24 Ultra (in stock)
  ('a1b2c3d4-0104-4000-8000-000000000001', 'Samsung', 'Galaxy S24 Ultra', '352099991100001', '12GB/256GB', 'Titanium Gray',  95000.00, 109999.00, 'in_stock', 'purchase', 'a1b2c3d4-0001-4000-8000-000000000001', 'direct'),
  ('a1b2c3d4-0104-4000-8000-000000000002', 'Samsung', 'Galaxy S24 Ultra', '352099991100002', '12GB/256GB', 'Titanium Black',  95000.00, 109999.00, 'in_stock', 'purchase', 'a1b2c3d4-0001-4000-8000-000000000001', 'direct'),
  -- Samsung Galaxy A55 (in stock)
  ('a1b2c3d4-0104-4000-8000-000000000003', 'Samsung', 'Galaxy A55',       '352099991100003', '8GB/128GB',  'Awesome Iceblue', 38000.00,  42999.00, 'in_stock', 'purchase', 'a1b2c3d4-0001-4000-8000-000000000001', 'direct'),
  ('a1b2c3d4-0104-4000-8000-000000000004', 'Samsung', 'Galaxy A55',       '352099991100004', '8GB/128GB',  'Awesome Lilac',   38000.00,  42999.00, 'in_stock', 'purchase', 'a1b2c3d4-0001-4000-8000-000000000001', 'direct'),
  -- iPhone 15 Pro (sold — part of sale 1)
  ('a1b2c3d4-0104-4000-8000-000000000005', 'Apple',   'iPhone 15 Pro',    '352099991100005', '8GB/256GB',  'Natural Titanium', 115000.00, 134900.00, 'sold', 'purchase', 'a1b2c3d4-0001-4000-8000-000000000001', 'direct'),
  ('a1b2c3d4-0104-4000-8000-000000000006', 'Apple',   'iPhone 15 Pro',    '352099991100006', '8GB/256GB',  'Blue Titanium',    115000.00, 134900.00, 'sold', 'purchase', 'a1b2c3d4-0001-4000-8000-000000000001', 'direct'),
  ('a1b2c3d4-0104-4000-8000-000000000007', 'Apple',   'iPhone 15 Pro',    '352099991100007', '8GB/256GB',  'Natural Titanium', 115000.00, 134900.00, 'in_stock', 'purchase', 'a1b2c3d4-0001-4000-8000-000000000001', 'direct'),
  -- OnePlus 12R (in stock)
  ('a1b2c3d4-0104-4000-8000-000000000008', 'OnePlus', '12R',              '352099991100008', '8GB/128GB',  'Cool Blue',        39000.00,  42999.00, 'in_stock', 'purchase', 'a1b2c3d4-0001-4000-8000-000000000001', 'direct'),
  ('a1b2c3d4-0104-4000-8000-000000000009', 'OnePlus', '12R',              '352099991100009', '8GB/128GB',  'Iron Gray',        39000.00,  42999.00, 'in_stock', 'purchase', 'a1b2c3d4-0001-4000-8000-000000000001', 'direct'),
  -- Trade-in device (in stock, from sale 3)
  ('a1b2c3d4-0104-4000-8000-00000000000a', 'Vivo',    'V27 Pro',          '352099991100010', '12GB/256GB', 'Magic Blue',      18000.00,  22000.00, 'in_stock', 'trade_in', 'a1b2c3d4-0001-4000-8000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;

-- ─── 7. Purchases ───────────────────────────────────────────

-- Purchase 1: Samsung stock from Samsung Distributor
INSERT INTO purchases (id, bill_number, party_id, total, paid, due, bank_account_id, payment_mode_id, date, financial_year_id, status)
VALUES (
  'a1b2c3d4-0105-4000-8000-000000000001',
  'PUR-2025-26-0001',
  'a1b2c3d4-0103-4000-8000-000000000006',
  266000.00,
  266000.00,
  0.00,
  'a1b2c3d4-0101-4000-8000-000000000002',
  'a1b2c3d4-0102-4000-8000-000000000001',
  '2025-04-15',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Purchase items for purchase 1
INSERT INTO purchase_items (id, purchase_id, inventory_item_id) VALUES
  ('a1b2c3d4-0106-4000-8000-000000000001', 'a1b2c3d4-0105-4000-8000-000000000001', 'a1b2c3d4-0104-4000-8000-000000000001'),
  ('a1b2c3d4-0106-4000-8000-000000000002', 'a1b2c3d4-0105-4000-8000-000000000001', 'a1b2c3d4-0104-4000-8000-000000000002'),
  ('a1b2c3d4-0106-4000-8000-000000000003', 'a1b2c3d4-0105-4000-8000-000000000001', 'a1b2c3d4-0104-4000-8000-000000000003'),
  ('a1b2c3d4-0106-4000-8000-000000000004', 'a1b2c3d4-0105-4000-8000-000000000001', 'a1b2c3d4-0104-4000-8000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- Purchase 2: Apple stock from Apple Reseller Hub
INSERT INTO purchases (id, bill_number, party_id, total, paid, due, bank_account_id, payment_mode_id, date, financial_year_id, status)
VALUES (
  'a1b2c3d4-0105-4000-8000-000000000002',
  'PUR-2025-26-0002',
  'a1b2c3d4-0103-4000-8000-000000000007',
  345000.00,
  200000.00,
  145000.00,
  'a1b2c3d4-0101-4000-8000-000000000003',
  'a1b2c3d4-0102-4000-8000-000000000003',
  '2025-04-20',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Purchase items for purchase 2
INSERT INTO purchase_items (id, purchase_id, inventory_item_id) VALUES
  ('a1b2c3d4-0106-4000-8000-000000000005', 'a1b2c3d4-0105-4000-8000-000000000002', 'a1b2c3d4-0104-4000-8000-000000000005'),
  ('a1b2c3d4-0106-4000-8000-000000000006', 'a1b2c3d4-0105-4000-8000-000000000002', 'a1b2c3d4-0104-4000-8000-000000000006'),
  ('a1b2c3d4-0106-4000-8000-000000000007', 'a1b2c3d4-0105-4000-8000-000000000002', 'a1b2c3d4-0104-4000-8000-000000000007')
ON CONFLICT (id) DO NOTHING;

-- ─── 8. Sales ───────────────────────────────────────────────

-- Sale 1: 2x iPhone 15 Pro to Rahul Sharma (fully paid)
INSERT INTO sales (id, bill_number, party_id, total, discount, trade_in_credit, final_total, paid, due, bank_account_id, payment_mode_id, date, financial_year_id, status)
VALUES (
  'a1b2c3d4-0107-4000-8000-000000000001',
  'SAL-2025-26-0001',
  'a1b2c3d4-0103-4000-8000-000000000001',
  269800.00,
  5000.00,
  0.00,
  264800.00,
  264800.00,
  0.00,
  'a1b2c3d4-0101-4000-8000-000000000002',
  'a1b2c3d4-0102-4000-8000-000000000001',
  '2025-05-01',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Sale items for sale 1
INSERT INTO sale_items (id, sale_id, inventory_item_id, sold_price) VALUES
  ('a1b2c3d4-0108-4000-8000-000000000001', 'a1b2c3d4-0107-4000-8000-000000000001', 'a1b2c3d4-0104-4000-8000-000000000005', 129900.00),
  ('a1b2c3d4-0108-4000-8000-000000000002', 'a1b2c3d4-0107-4000-8000-000000000001', 'a1b2c3d4-0104-4000-8000-000000000006', 134900.00)
ON CONFLICT (id) DO NOTHING;

-- Sale 2: 1x OnePlus 12R to Priya Patel (partial payment)
INSERT INTO sales (id, bill_number, party_id, total, discount, trade_in_credit, final_total, paid, due, bank_account_id, payment_mode_id, date, financial_year_id, status)
VALUES (
  'a1b2c3d4-0107-4000-8000-000000000002',
  'SAL-2025-26-0002',
  'a1b2c3d4-0103-4000-8000-000000000002',
  42999.00,
  2000.00,
  0.00,
  40999.00,
  20000.00,
  20999.00,
  'a1b2c3d4-0101-4000-8000-000000000001',
  'a1b2c3d4-0102-4000-8000-000000000004',
  '2025-05-10',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Sale items for sale 2
INSERT INTO sale_items (id, sale_id, inventory_item_id, sold_price) VALUES
  ('a1b2c3d4-0108-4000-8000-000000000003', 'a1b2c3d4-0107-4000-8000-000000000002', 'a1b2c3d4-0104-4000-8000-000000000008', 42999.00)
ON CONFLICT (id) DO NOTHING;

-- Sale 3: 1x OnePlus 12R to Arun Kumar with trade-in (fully paid)
INSERT INTO sales (id, bill_number, party_id, total, discount, trade_in_credit, final_total, paid, due, bank_account_id, payment_mode_id, date, financial_year_id, status)
VALUES (
  'a1b2c3d4-0107-4000-8000-000000000003',
  'SAL-2025-26-0003',
  'a1b2c3d4-0103-4000-8000-000000000003',
  42999.00,
  0.00,
  18000.00,
  24999.00,
  24999.00,
  0.00,
  'a1b2c3d4-0101-4000-8000-000000000001',
  'a1b2c3d4-0102-4000-8000-000000000004',
  '2025-05-15',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Sale items for sale 3
INSERT INTO sale_items (id, sale_id, inventory_item_id, sold_price) VALUES
  ('a1b2c3d4-0108-4000-8000-000000000004', 'a1b2c3d4-0107-4000-8000-000000000003', 'a1b2c3d4-0104-4000-8000-000000000009', 42999.00)
ON CONFLICT (id) DO NOTHING;

-- Trade-in for sale 3 (Vivo V27 Pro)
INSERT INTO trade_ins (id, sale_id, brand, model, imei, ram_rom, color, credit_value, mrp, new_inventory_item_id)
VALUES (
  'a1b2c3d4-0109-4000-8000-000000000001',
  'a1b2c3d4-0107-4000-8000-000000000003',
  'Vivo',
  'V27 Pro',
  '352099991100010',
  '12GB/256GB',
  'Magic Blue',
  18000.00,
  28000.00,
  'a1b2c3d4-0104-4000-8000-00000000000a'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 9. Payments ────────────────────────────────────────────

-- Payment in for sale 1 (full payment via UPI)
INSERT INTO payments_in (id, sale_id, party_id, amount, bank_account_id, payment_mode_id, date, financial_year_id)
VALUES (
  'a1b2c3d4-010a-4000-8000-000000000001',
  'a1b2c3d4-0107-4000-8000-000000000001',
  'a1b2c3d4-0103-4000-8000-000000000001',
  264800.00,
  'a1b2c3d4-0101-4000-8000-000000000002',
  'a1b2c3d4-0102-4000-8000-000000000001',
  '2025-05-01',
  'a1b2c3d4-0001-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Payment in for sale 2 (partial via Cash)
INSERT INTO payments_in (id, sale_id, party_id, amount, bank_account_id, payment_mode_id, date, financial_year_id)
VALUES (
  'a1b2c3d4-010a-4000-8000-000000000002',
  'a1b2c3d4-0107-4000-8000-000000000002',
  'a1b2c3d4-0103-4000-8000-000000000002',
  20000.00,
  'a1b2c3d4-0101-4000-8000-000000000001',
  'a1b2c3d4-0102-4000-8000-000000000004',
  '2025-05-10',
  'a1b2c3d4-0001-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Payment in for sale 3 (full via Cash)
INSERT INTO payments_in (id, sale_id, party_id, amount, bank_account_id, payment_mode_id, date, financial_year_id)
VALUES (
  'a1b2c3d4-010a-4000-8000-000000000003',
  'a1b2c3d4-0107-4000-8000-000000000003',
  'a1b2c3d4-0103-4000-8000-000000000003',
  24999.00,
  'a1b2c3d4-0101-4000-8000-000000000001',
  'a1b2c3d4-0102-4000-8000-000000000004',
  '2025-05-15',
  'a1b2c3d4-0001-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Payment out for purchase 1 (full via UPI)
INSERT INTO payments_out (id, purchase_id, party_id, amount, bank_account_id, payment_mode_id, date, financial_year_id)
VALUES (
  'a1b2c3d4-010b-4000-8000-000000000001',
  'a1b2c3d4-0105-4000-8000-000000000001',
  'a1b2c3d4-0103-4000-8000-000000000006',
  266000.00,
  'a1b2c3d4-0101-4000-8000-000000000002',
  'a1b2c3d4-0102-4000-8000-000000000001',
  '2025-04-15',
  'a1b2c3d4-0001-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Payment out for purchase 2 (partial via NEFT)
INSERT INTO payments_out (id, purchase_id, party_id, amount, bank_account_id, payment_mode_id, date, financial_year_id)
VALUES (
  'a1b2c3d4-010b-4000-8000-000000000002',
  'a1b2c3d4-0105-4000-8000-000000000002',
  'a1b2c3d4-0103-4000-8000-000000000007',
  200000.00,
  'a1b2c3d4-0101-4000-8000-000000000003',
  'a1b2c3d4-0102-4000-8000-000000000003',
  '2025-04-20',
  'a1b2c3d4-0001-4000-8000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 10. Account Transactions (ledger) ─────────────────────

-- Purchase 1 payment (debit)
INSERT INTO account_transactions (bank_account_id, payment_mode_id, type, amount, date, reference_type, reference_id, financial_year_id)
VALUES ('a1b2c3d4-0101-4000-8000-000000000002', 'a1b2c3d4-0102-4000-8000-000000000001', 'debit', 266000.00, '2025-04-15', 'payment_out', 'a1b2c3d4-010b-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001');

-- Purchase 2 payment (debit, partial)
INSERT INTO account_transactions (bank_account_id, payment_mode_id, type, amount, date, reference_type, reference_id, financial_year_id)
VALUES ('a1b2c3d4-0101-4000-8000-000000000003', 'a1b2c3d4-0102-4000-8000-000000000003', 'debit', 200000.00, '2025-04-20', 'payment_out', 'a1b2c3d4-010b-4000-8000-000000000002', 'a1b2c3d4-0001-4000-8000-000000000001');

-- Sale 1 payment (credit)
INSERT INTO account_transactions (bank_account_id, payment_mode_id, type, amount, date, reference_type, reference_id, financial_year_id)
VALUES ('a1b2c3d4-0101-4000-8000-000000000002', 'a1b2c3d4-0102-4000-8000-000000000001', 'credit', 264800.00, '2025-05-01', 'payment_in', 'a1b2c3d4-010a-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001');

-- Sale 2 payment (credit, partial)
INSERT INTO account_transactions (bank_account_id, payment_mode_id, type, amount, date, reference_type, reference_id, financial_year_id)
VALUES ('a1b2c3d4-0101-4000-8000-000000000001', 'a1b2c3d4-0102-4000-8000-000000000004', 'credit', 20000.00, '2025-05-10', 'payment_in', 'a1b2c3d4-010a-4000-8000-000000000002', 'a1b2c3d4-0001-4000-8000-000000000001');

-- Sale 3 payment (credit)
INSERT INTO account_transactions (bank_account_id, payment_mode_id, type, amount, date, reference_type, reference_id, financial_year_id)
VALUES ('a1b2c3d4-0101-4000-8000-000000000001', 'a1b2c3d4-0102-4000-8000-000000000004', 'credit', 24999.00, '2025-05-15', 'payment_in', 'a1b2c3d4-010a-4000-8000-000000000003', 'a1b2c3d4-0001-4000-8000-000000000001');

-- ─── 11. Proforma Invoice ──────────────────────────────────

INSERT INTO proforma_invoices (id, bill_number, party_id, total, discount, trade_in_credit, final_total, date, financial_year_id, status)
VALUES (
  'a1b2c3d4-010c-4000-8000-000000000001',
  'PI-2025-26-0001',
  'a1b2c3d4-0103-4000-8000-000000000004',
  52000.00,
  2000.00,
  0.00,
  50000.00,
  '2025-05-20',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Proforma items
INSERT INTO proforma_invoice_items (id, proforma_invoice_id, description, qty, rate, discount, value) VALUES
  ('a1b2c3d4-010d-4000-8000-000000000001', 'a1b2c3d4-010c-4000-8000-000000000001', 'Samsung Galaxy S24 Ultra (12GB/256GB) Titanium Gray', 1, 109999.00, 0.00, 109999.00),
  ('a1b2c3d4-010d-4000-8000-000000000002', 'a1b2c3d4-010c-4000-8000-000000000001', 'Samsung Galaxy Buds 2 Pro',                          1,  18999.00, 0.00,  18999.00)
ON CONFLICT (id) DO NOTHING;

-- ─── 12. WhatsApp Settings ──────────────────────────────────

INSERT INTO whatsapp_settings (id, owner_user_id, auto_send_sale, auto_send_purchase, auto_send_proforma)
VALUES (
  'a1b2c3d4-010e-4000-8000-000000000001',
  '975839b1-18b7-4339-a9dd-00863521bb29',
  false,
  false,
  false
)
ON CONFLICT (owner_user_id) DO NOTHING;

-- ─── Done ───────────────────────────────────────────────────
-- Summary:
--   1 financial year (FY 2025-26, active)
--   1 store (Fusion Gadgets, owned by mock user)
--   3 bank accounts (Cash, HDFC, ICICI)
--   4 payment modes
--   7 parties (5 customers + 2 suppliers)
--   10 inventory items (7 in stock, 2 sold, 1 trade-in)
--   2 purchases (4 Samsung items + 3 Apple items)
--   3 sales (2 iPhone, 1 OnePlus with trade-in)
--   1 trade-in (Vivo V27 Pro)
--   3 payments in + 2 payments out
--   5 account transactions
--   1 proforma invoice (2 items)
--   1 whatsapp_settings row (auto-send disabled)
-- ============================================================
