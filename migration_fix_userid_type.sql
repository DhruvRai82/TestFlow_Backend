-- Migration: Fix user_id type to support Firebase UIDs (TEXT)
-- Date: 2025-12-19
-- CORRECTED VERSION: Drops policies first to avoid dependency errors.

-- 1. Drop Policies First (Dependent objects)
DROP POLICY IF EXISTS "Users can view own keys" ON public.user_ai_keys;
DROP POLICY IF EXISTS "Users can insert own keys" ON public.user_ai_keys;
DROP POLICY IF EXISTS "Users can update own keys" ON public.user_ai_keys;
DROP POLICY IF EXISTS "Users can delete own keys" ON public.user_ai_keys;

-- 2. Drop Foreign Key Constraint
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_ai_keys_user_id_fkey') THEN
    ALTER TABLE public.user_ai_keys DROP CONSTRAINT user_ai_keys_user_id_fkey;
  END IF;
END $$;

-- 3. Change Column Type from UUID to TEXT
-- Using ::text casting to ensure data conversion if there is existing data
ALTER TABLE public.user_ai_keys ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- 4. Recreate Policies
CREATE POLICY "Users can view own keys" ON public.user_ai_keys FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own keys" ON public.user_ai_keys FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own keys" ON public.user_ai_keys FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own keys" ON public.user_ai_keys FOR DELETE USING (auth.uid()::text = user_id);
