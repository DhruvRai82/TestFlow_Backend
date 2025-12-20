-- Migration: Automation Runner (True Backend Execution)
-- Description: Adds tables for persistent test run history and detailed logs
-- Date: 2024-12-18

-- 1. Test Runs Table
-- Tracks the high-level status of a script execution
CREATE TABLE IF NOT EXISTS public.test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL, -- Logical link, strictly speaking generic projects might not be in DB, but good for filtering
    script_id TEXT NOT NULL, -- Linking to recorded_scripts.id (which is currently TEXT/String in your setup)
    status TEXT CHECK (status IN ('pending', 'running', 'passed', 'failed', 'error')) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    trigger_source TEXT CHECK (trigger_source IN ('manual', 'scheduler', 'ci')) DEFAULT 'manual',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Test Logs Table
-- Tracks step-by-step execution details for debugging
CREATE TABLE IF NOT EXISTS public.test_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.test_runs(id) ON DELETE CASCADE,
    step_index INTEGER,
    action TEXT, -- e.g., 'click', 'type'
    status TEXT CHECK (status IN ('pass', 'fail', 'info', 'warning')),
    message TEXT,
    screenshot_url TEXT, -- Optional: if we save step-level screenshots later
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies (Open access for now, similar to other tables)
CREATE POLICY "Users can view test runs" ON public.test_runs FOR SELECT USING (true);
CREATE POLICY "Users can insert test runs" ON public.test_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update test runs" ON public.test_runs FOR UPDATE USING (true);
CREATE POLICY "Users can delete test runs" ON public.test_runs FOR DELETE USING (true);

CREATE POLICY "Users can view test logs" ON public.test_logs FOR SELECT USING (true);
CREATE POLICY "Users can insert test logs" ON public.test_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete test logs" ON public.test_logs FOR DELETE USING (true);

-- 5. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_test_runs_project_id ON public.test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_script_id ON public.test_runs(script_id);
CREATE INDEX IF NOT EXISTS idx_test_logs_run_id ON public.test_logs(run_id);
