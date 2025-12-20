-- Create table for storing multiple AI keys per user
CREATE TABLE IF NOT EXISTS public.user_ai_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,         -- Friendly name e.g. "Personal Key 1"
    provider TEXT DEFAULT 'gemini',
    api_key TEXT NOT NULL,      -- The actual key
    model TEXT DEFAULT 'gemini-1.5-flash',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_ai_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see only their own keys
CREATE POLICY "Users can view own keys" ON public.user_ai_keys
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own keys
CREATE POLICY "Users can insert own keys" ON public.user_ai_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own keys
CREATE POLICY "Users can update own keys" ON public.user_ai_keys
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own keys
CREATE POLICY "Users can delete own keys" ON public.user_ai_keys
    FOR DELETE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_ai_keys_user_id ON public.user_ai_keys(user_id);
