-- Add notes column to meetings table for persisting user-added notes
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;
