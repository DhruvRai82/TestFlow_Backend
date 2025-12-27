import express from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// GET /api/admin/tasks - Fetch all tasks
router.get('/', async (req, res) => {
    try {
        console.log('[Admin API] Fetching tasks via RPC...');
        // Use RPC to bypass potential PostgREST schema cache issues on the table
        const { data, error } = await supabase.rpc('get_admin_tasks');

        if (error) {
            console.error('[Admin API] Tasks RPC Error:', error.message, error.details);
            // Fallback to direct select if RPC fails (or not created yet)
            console.log('[Admin API] RPC failed, trying direct select fallback...');
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (fallbackError) throw fallbackError;
            res.json(fallbackData);
            return;
        }
        console.log(`[Admin API] Found ${data?.length || 0} tasks`);
        res.json(data);
    } catch (error) {
        console.error('[Admin API] Fetch Tasks Catastrophic Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// POST /api/admin/tasks - Create a task
router.post('/', async (req, res) => {
    try {
        const { title, label, status, priority } = req.body;
        const { data, error } = await supabase
            .from('tasks')
            .insert([{ title, label, status, priority }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Create Task Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// PATCH /api/admin/tasks/:id - Update a task
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const { data, error } = await supabase
            .from('tasks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Update Task Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// DELETE /api/admin/tasks/:id - Delete a task
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Delete Task Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export const adminTasksRouter = router;
