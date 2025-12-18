import { Router } from 'express';
import { visualTestService } from '../services/VisualTestService';
import path from 'path';
import fs from 'fs';

const router = Router();


// Create Test
router.post('/', async (req, res) => {
    try {
        const { name, targetUrl, projectId } = req.body;
        const test = await visualTestService.createTest(name, targetUrl, projectId);
        res.json(test);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// List Tests
router.get('/', async (req, res) => {
    try {
        const tests = await visualTestService.getTests();
        res.json(tests);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Run Test
router.post('/:testId/run', async (req, res) => {
    try {
        const result = await visualTestService.runTest(req.params.testId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get Status (Diff %)
router.get('/:scriptId/status', async (req, res) => {
    // ... existing code

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
            // Return transparent 1x1 pixel instead of 404 to avoid console errors
            // especially for 'diff' which is expected to be missing on pass
            const transparentPixelInfo = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
                'base64'
            );
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': transparentPixelInfo.length
            });
            res.end(transparentPixelInfo);
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
