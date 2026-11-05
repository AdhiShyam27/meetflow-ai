-- ─── MeetFlow AI — Stars (junction table) ─────────────────────────────────────
-- Run this in your Supabase SQL Editor at https://supabase.com/dashboard
-- One row = "this user starred this meeting". One table for everyone.

CREATE TABLE IF NOT EXISTS stars (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_id  UUID NOT NULL REFERENCES meetings(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, meeting_id)
);

-- ─── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE stars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own stars"
  ON stars FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own stars"
  ON stars FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own stars"
  ON stars FOR DELETE USING (auth.uid() = user_id);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS stars_user_id_idx    ON stars (user_id);
CREATE INDEX IF NOT EXISTS stars_meeting_id_idx ON stars (meeting_id);
