
import { Router } from 'express';
import { testRunnerService } from '../services/TestRunnerService';
import { supabase } from '../lib/supabase';

const router = Router();

// Trigger a Test Run
router.post('/execute', async (req, res) => {
    try {
        const { scriptId, projectId, source } = req.body;

        if (!scriptId || !projectId) {
            return res.status(400).json({ error: 'scriptId and projectId are required' });
        }

        // We run this asynchronously so the HTTP request returns 'started' quickly
        // The client can then poll for status using the runId (optional, or just wait for sockets/refresh)
        // However, for simplicity now, let's await it or return the runId immediately? 
        // Let's await it for this iteration to see results immediately in Postman/Frontend
        const result = await testRunnerService.executeTest(
            scriptId,
            projectId,
            source || 'manual'
        );

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get Runs for a Project (History)
router.get('/history', async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: 'Project ID required' });

        // 1. Fetch Runs
        const { data: runs, error: runError } = await supabase
            .from('test_runs')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (runError) throw runError;

        // 2. Fetch Script Names manually (since no FK)
        const scriptIds = [...new Set(runs.map(r => r.script_id))];
        const { data: scripts, error: scriptError } = await supabase
            .from('recorded_scripts')
            .select('id, name')
            .in('id', scriptIds);

        // 3. Merge data
        const runsWithNames = runs.map(run => {
            const script = scripts?.find(s => s.id === run.script_id);
            return {
                ...run,
                recorded_scripts: { name: script?.name || 'Unknown Script' }
            };
        });

        res.json(runsWithNames);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get Details of a Specific Run
router.get('/run/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch Run Info
        const { data: run, error: runError } = await supabase
            .from('test_runs')
            .select('*')
            .eq('id', id)
            .single();

        if (runError) throw runError;

        // Fetch Logs
        const { data: logs, error: logError } = await supabase
            .from('test_logs')
            .select('*')
            .eq('run_id', id)
            .order('step_index', { ascending: true });

        if (logError) throw logError;

        res.json({ run, logs });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a Run
router.delete('/run/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('test_runs')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ status: 'deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export const runnerRoutes = router;
