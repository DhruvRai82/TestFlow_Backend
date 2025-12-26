import express from 'express';
import { databaseInspectorService } from '../services/DatabaseInspectorService';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// GET /api/admin-inspector/database-dump?source=local|supabase
router.get('/database-dump', async (req, res) => {
    try {
        const source = (req.query.source as string || 'local').toLowerCase();

        console.log(`[DB Inspector] Fetching dump for source: ${source}`);
        const userId = (req as any).user.uid;

        let dump;
        if (source === 'supabase') {
            dump = await databaseInspectorService.getSupabaseData(userId);
        } else {
            dump = await databaseInspectorService.getLocalData(userId);
        }

        res.json(dump);
    } catch (error) {
        console.error("DB Dump Error:", error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export const adminDbRouter = router;
