-- Migration: Automation Suite
-- Description: Adds tables for Test Data Management and Visual Testing
-- Date: 2024-12-18

-- 1. Test Data Management
CREATE TABLE IF NOT EXISTS public.test_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL, 
    name TEXT NOT NULL,
    data_type TEXT CHECK (data_type IN ('csv', 'json')),
    content TEXT NOT NULL, -- Storing JSON string or CSV content directly for simplicity, or URL if changed later
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for test_datasets
ALTER TABLE public.test_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all datasets" ON public.test_datasets FOR SELECT USING (true);
CREATE POLICY "Users can insert datasets" ON public.test_datasets FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete datasets" ON public.test_datasets FOR DELETE USING (true);


-- 2. Visual Tests Tables
CREATE TABLE IF NOT EXISTS public.visual_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    name TEXT NOT NULL,
    target_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS public.visual_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_test_id UUID REFERENCES visual_tests(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL, -- URLs/Paths to storage
    is_baseline BOOLEAN DEFAULT false,
    diff_percentage FLOAT DEFAULT 0,
    status TEXT CHECK (status IN ('pass', 'fail', 'new')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for visual tables
ALTER TABLE public.visual_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view visual tests" ON public.visual_tests FOR SELECT USING (true);
CREATE POLICY "Users can insert visual tests" ON public.visual_tests FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete visual tests" ON public.visual_tests FOR DELETE USING (true);

CREATE POLICY "Users can view visual snapshots" ON public.visual_snapshots FOR SELECT USING (true);
CREATE POLICY "Users can insert visual snapshots" ON public.visual_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete visual snapshots" ON public.visual_snapshots FOR DELETE USING (true);

-- 3. Verify Schedules (Ensure compatibility)
-- If schedules table exists, we assume it's good based on previous checks.
-- Just adding an index for performance if missing
CREATE INDEX IF NOT EXISTS idx_schedules_script_id ON public.schedules(script_id);
