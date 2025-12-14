import { Router } from 'express';
import { genAIService } from '../services/GenAIService';

const router = Router();

// Helper to extract AI config from headers
const getAIConfig = (req: any) => {
    return {
        apiKey: req.headers['x-ai-custom-key'] as string | undefined,
        model: req.headers['x-ai-custom-model'] as string | undefined
    };
};

// Generate Test Cases
router.post('/generate-tests', async (req, res) => {
    try {
        const { requirements } = req.body;
        if (!requirements) {
            return res.status(400).json({ error: 'Requirements text is required' });
        }

        const result = await genAIService.generateTestCases(requirements, getAIConfig(req));
        res.json({ result });
    } catch (error) {
        console.error('Error generating tests:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Summarize Bug
router.post('/summarize-bug', async (req, res) => {
    try {
        console.log("--> BACKEND ROUTE: POST /summarize-bug body:", req.body);
        const { description } = req.body;
        if (!description) {
            return res.status(400).json({ error: 'Bug description is required' });
        }

        const result = await genAIService.summarizeBug(description, getAIConfig(req));
        res.json(result);
    } catch (error) {
        console.error('Error summarizing bug:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Generate Structured Single Test Case
router.post('/generate-test-case', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await genAIService.generateStructuredTestCase(prompt, getAIConfig(req));
        res.json(result);
    } catch (error) {
        console.error('Error generating structured test case:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Generate Bulk Test Cases
router.post('/generate-bulk-test-cases', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await genAIService.generateBulkTestCases(prompt, getAIConfig(req));
        res.json(result);
    } catch (error) {
        console.error('Error generating bulk test cases:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export { router as aiRouter };
