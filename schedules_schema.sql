-- Create schedules table
CREATE TABLE IF NOT EXISTS public.schedules (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS Policies
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own schedules"
    ON public.schedules FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own schedules"
    ON public.schedules FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own schedules"
    ON public.schedules FOR UPDATE
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own schedules"
    ON public.schedules FOR DELETE
    USING (auth.uid()::text = user_id);
