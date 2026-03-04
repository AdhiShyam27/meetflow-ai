-- ─── Language Tracking ──────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor after 002_google_tokens.sql

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS detected_languages TEXT[]     DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS primary_language   TEXT       DEFAULT 'English';
