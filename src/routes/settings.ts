import { Router } from 'express';
import { settingsService } from '../services/SettingsService';

const router = Router();

// Get AI Keys
router.get('/keys', async (req, res) => {
    try {
        const userId = (req as any).user?.uid;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const keys = await settingsService.getAIKeys(userId);
        res.json(keys);
    } catch (error) {
        console.error('Error fetching AI keys:', error);
        res.status(500).json({ error: 'Failed to fetch keys' });
    }
});

// Add AI Key
router.post('/keys', async (req, res) => {
    try {
        const userId = (req as any).user?.uid;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { name, apiKey, model } = req.body;
        if (!name || !apiKey || !model) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newKey = await settingsService.addAIKey(userId, { name, apiKey, model });
        res.status(201).json(newKey);
    } catch (error) {
        console.error('Error adding AI key:', error);
        res.status(500).json({ error: 'Failed to add key' });
    }
});

// Activate Key
router.put('/keys/:id/activate', async (req, res) => {
    try {
        const userId = (req as any).user?.uid;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;
        await settingsService.activateAIKey(userId, id);
        res.json({ status: 'success' });
    } catch (error) {
        console.error('Error activating key:', error);
        res.status(500).json({ error: 'Failed to activate key' });
    }
});

// Delete Key
router.delete('/keys/:id', async (req, res) => {
    try {
        const userId = (req as any).user?.uid;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;
        await settingsService.deleteAIKey(userId, id);
        res.json({ status: 'success' });
    } catch (error) {
        console.error('Error deleting key:', error);
        res.status(500).json({ error: 'Failed to delete key' });
    }
});

export { router as settingsRoutes };
