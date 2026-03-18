-- Add workflow configuration to user profiles (encrypted JSON string)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workflow_config TEXT;

-- Add workflow run results to meetings (stores last run status per workflow)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS workflow_runs JSONB DEFAULT '{}'::jsonb;
