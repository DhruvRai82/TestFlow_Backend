import { Router } from 'express';
import { schedulerService } from '../services/SchedulerService';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const userId = (req as any).user?.uid; // Assumes auth middleware
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const schedules = await schedulerService.listSchedules(userId);
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/', async (req, res) => {
    try {
        const userId = (req as any).user?.uid;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { scriptId, cronExpression } = req.body;
        if (!scriptId || !cronExpression) return res.status(400).json({ error: 'Missing fields' });

        const schedule = await schedulerService.createSchedule(scriptId, cronExpression, userId);
        res.json(schedule);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await schedulerService.deleteSchedule(req.params.id);
        res.json({ status: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
