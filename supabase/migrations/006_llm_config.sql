-- Add LLM configuration column to profiles (encrypted JSON: { apiKey, model })
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS llm_config TEXT;
