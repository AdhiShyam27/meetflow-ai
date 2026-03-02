-- ─── Google OAuth Token Storage ────────────────────────────────────────────
-- Run this in Supabase SQL Editor after 001_initial.sql

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expiry  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_email         TEXT,
  ADD COLUMN IF NOT EXISTS google_connected_at  TIMESTAMPTZ;
