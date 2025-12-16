import { Router } from 'express';
import { visualTestService } from '../services/VisualTestService';
import path from 'path';
import fs from 'fs';

const router = Router();

// Get Status (Diff %)
router.get('/:scriptId/status', async (req, res) => {
    try {
        // This is a bit tricky, usually status is result of a run. 
        // For now, checks if diff exists.
        const { diff } = visualTestService.getImages(req.params.scriptId);
        if (fs.existsSync(diff)) {
            res.json({ status: 'mismatch', diff: true });
        } else {
            res.json({ status: 'match', diff: false });
        }
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get Images (Baseline, Latest, Diff)
router.get('/:scriptId/:type', async (req, res) => {
    try {
        const { scriptId, type } = req.params;
        const images = visualTestService.getImages(scriptId);

        let imagePath = '';
        if (type === 'baseline') imagePath = images.baseline;
        else if (type === 'latest') imagePath = images.latest;
        else if (type === 'diff') imagePath = images.diff;
        else return res.status(400).json({ error: 'Invalid type' });

        if (fs.existsSync(imagePath)) {
            res.sendFile(imagePath);
        } else {
            res.status(404).json({ error: 'Image not found' });
        }
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Approve Latest
router.post('/:scriptId/approve', async (req, res) => {
    try {
        await visualTestService.approveLatest(req.params.scriptId);
        res.json({ status: 'approved' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export const visualTestRouter = router;
