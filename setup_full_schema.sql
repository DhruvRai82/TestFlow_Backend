-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Projects Table (Assumed UUID, usually standard)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 2. Project Pages (References Projects -> UUID)
CREATE TABLE IF NOT EXISTS public.project_pages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT,
    description TEXT,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.project_pages ENABLE ROW LEVEL SECURITY;

-- 3. Daily Data (References Projects -> UUID)
CREATE TABLE IF NOT EXISTS public.daily_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    metrics JSONB DEFAULT '{}',
    bugs JSONB DEFAULT '[]',
    testCases JSONB DEFAULT '[]',
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(project_id, date)
);
ALTER TABLE public.daily_data ENABLE ROW LEVEL SECURITY;

-- 4. Recorded Scripts (Could be TEXT or UUID)
-- We use IF NOT EXISTS, so if it exists as TEXT, this block is skipped.
CREATE TABLE IF NOT EXISTS public.recorded_scripts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    script JSONB NOT NULL,
    last_run JSONB,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.recorded_scripts ENABLE ROW LEVEL SECURITY;

-- 5. Execution Reports (References Scripts -> TEXT to match legacy)
CREATE TABLE IF NOT EXISTS public.execution_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    -- script_id is TEXT to allow matching either UUID or legacy TEXT PKs
    script_id TEXT REFERENCES public.recorded_scripts(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    logs TEXT,
    duration_ms INTEGER,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.execution_reports ENABLE ROW LEVEL SECURITY;

-- 6. Schedules (References Scripts -> TEXT to match legacy)
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    -- script_id is TEXT to allow matching either UUID or legacy TEXT PKs
    script_id TEXT REFERENCES public.recorded_scripts(id) ON DELETE CASCADE,
    cron_expression TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- 7. Datasets
CREATE TABLE IF NOT EXISTS public.datasets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;


-- POLICIES (Simple Owner Access)

-- Projects
CREATE POLICY "Owner view projects" ON public.projects FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Owner insert projects" ON public.projects FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Owner update projects" ON public.projects FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Owner delete projects" ON public.projects FOR DELETE USING (auth.uid()::text = user_id);

-- Project Pages
CREATE POLICY "Owner view pages" ON public.project_pages FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Owner insert pages" ON public.project_pages FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Owner update pages" ON public.project_pages FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Owner delete pages" ON public.project_pages FOR DELETE USING (auth.uid()::text = user_id);

-- Daily Data
CREATE POLICY "Owner view data" ON public.daily_data FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Owner insert data" ON public.daily_data FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Owner update data" ON public.daily_data FOR UPDATE USING (auth.uid()::text = user_id);

-- Scripts
CREATE POLICY "Owner view scripts" ON public.recorded_scripts FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Owner insert scripts" ON public.recorded_scripts FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Owner update scripts" ON public.recorded_scripts FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Owner delete scripts" ON public.recorded_scripts FOR DELETE USING (auth.uid()::text = user_id);

-- Reports
CREATE POLICY "Owner view reports" ON public.execution_reports FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Owner insert reports" ON public.execution_reports FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Schedules
CREATE POLICY "Owner view schedules" ON public.schedules FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Owner insert schedules" ON public.schedules FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Owner delete schedules" ON public.schedules FOR DELETE USING (auth.uid()::text = user_id);

-- Datasets
CREATE POLICY "Owner view datasets" ON public.datasets FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Owner insert datasets" ON public.datasets FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Owner delete datasets" ON public.datasets FOR DELETE USING (auth.uid()::text = user_id);
