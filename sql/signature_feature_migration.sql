-- Migration: Add Signature Upload Feature
-- Run this in your Supabase SQL Editor

ALTER TABLE store ADD COLUMN IF NOT EXISTS signature_url TEXT;
