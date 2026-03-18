-- User-uploaded markdown notes with full-text search
CREATE TABLE IF NOT EXISTS user_notes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL,
  content    TEXT NOT NULL,
  tsv        TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notes"   ON user_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notes" ON user_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notes" ON user_notes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_notes_user_id_idx ON user_notes (user_id);
CREATE INDEX IF NOT EXISTS user_notes_tsv_idx     ON user_notes USING GIN (tsv);
