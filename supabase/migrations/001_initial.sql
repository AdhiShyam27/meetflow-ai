-- ─── MeetFlow AI — Initial Schema ─────────────────────────────────────────────
-- Run this in your Supabase SQL Editor at https://supabase.com/dashboard

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Meetings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled Meeting',
  platform    TEXT NOT NULL DEFAULT 'other'
                CHECK (platform IN ('google_meet','zoom','teams','other')),
  language    TEXT NOT NULL DEFAULT 'en-US',
  duration    INTEGER,                          -- seconds
  transcript  TEXT,
  word_count  INTEGER GENERATED ALWAYS AS (
                array_length(string_to_array(trim(transcript), ' '), 1)
              ) STORED,
  summary     JSONB,                            -- structured AI output
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('recording','processing','done','error')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own meetings"
  ON meetings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own meetings"
  ON meetings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own meetings"
  ON meetings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own meetings"
  ON meetings FOR DELETE USING (auth.uid() = user_id);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX meetings_user_id_idx ON meetings (user_id);
CREATE INDEX meetings_created_at_idx ON meetings (created_at DESC);
CREATE INDEX meetings_status_idx ON meetings (status);

-- ─── User Profiles (extends auth.users) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  avatar_url    TEXT,
  plan          TEXT NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free','pro','team')),
  meetings_used INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
