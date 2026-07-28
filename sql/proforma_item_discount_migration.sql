-- Migration: Add Discount Column to Proforma Invoice Items
-- Run this in your Supabase SQL Editor

ALTER TABLE proforma_invoice_items ADD COLUMN IF NOT EXISTS discount NUMERIC(12, 2) NOT NULL DEFAULT 0;
