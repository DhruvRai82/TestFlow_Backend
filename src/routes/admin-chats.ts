import express from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// GET /api/admin/chats - Fetch all conversations
router.get('/', async (req, res) => {
    try {
        console.log('[Admin API] Fetching chats...');
        // Assuming 'conversations' table exists, or we mock it for now if it doesn't
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Admin API] Chats DB Error:', error.message);
            // If table doesn't exist, generic 500
            throw error;
        }
        res.json(data);
    } catch (error) {
        console.error('[Admin API] Fetch Chats Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export const adminChatsRouter = router;
