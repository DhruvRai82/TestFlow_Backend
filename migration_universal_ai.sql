-- Migration: Add base_url to user_ai_keys for Universal AI Support
-- Date: 2025-12-19

ALTER TABLE public.user_ai_keys ADD COLUMN IF NOT EXISTS base_url TEXT;

-- Optional: Update existing rows to have null base_url (default behavior)
-- We can also add a check constraint if we wanted, but let's keep it flexible.
