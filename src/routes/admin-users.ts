import express from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// GET /api/admin/users - Fetch all users
router.get('/', async (req, res) => {
    try {
        console.log('[Admin API] Fetching users (public.users)...');
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Admin API] Users DB Error:', error.message, error.details);
            throw error;
        }
        console.log(`[Admin API] Found ${data?.length || 0} users`);
        res.json(data);
    } catch (error) {
        console.error('[Admin API] Fetch Users Catastrophic Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// PATCH /api/admin/users/:id - Update a user (role/status)
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Update User Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// POST /api/admin/users/invite - Invite (Create) a user
router.post('/invite', async (req, res) => {
    try {
        const { email, role, status } = req.body;
        // For now, we just insert into public.users. 
        // In a real app, you'd use supabase.auth.admin.inviteUserByEmail(email)
        const { data, error } = await supabase
            .from('users')
            .insert([{
                email,
                role,
                status: status || 'invited',
                username: email.split('@')[0], // Default username
                first_name: '',
                last_name: ''
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Invite User Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// DELETE /api/admin/users/:id - Delete a user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export const adminUsersRouter = router;
