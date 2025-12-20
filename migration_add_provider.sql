-- Migration: Add provider column to user_ai_keys (Robust)
-- Date: 2025-12-20

-- 1. Add column if it doesn't exist
ALTER TABLE public.user_ai_keys 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'google';

-- 2. Backfill existing rows (Critical fix for "check constraint violated")
-- Ensure all rows have a valid provider before applying the constraint.
UPDATE public.user_ai_keys 
SET provider = 'google' 
WHERE provider IS NULL OR provider NOT IN ('google', 'openai', 'anthropic', 'custom');

-- 3. Add check constraint safely
-- Drop it first if it exists to avoid errors on retry
ALTER TABLE public.user_ai_keys DROP CONSTRAINT IF EXISTS user_ai_keys_provider_check;

ALTER TABLE public.user_ai_keys 
ADD CONSTRAINT user_ai_keys_provider_check 
CHECK (provider IN ('google', 'openai', 'anthropic', 'custom'));

-- 4. Comment
COMMENT ON COLUMN public.user_ai_keys.provider IS 'AI Provider: google, openai, etc.';
