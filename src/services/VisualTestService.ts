import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { supabase } from '../lib/supabase';
import { chromium } from 'playwright';

// Keeping file storage for images is good practice (DB is not for large blobs ideally)
const STORAGE_DIR = path.join(__dirname, '../../storage');
const BASELINE_DIR = path.join(STORAGE_DIR, 'baselines');
const LATEST_DIR = path.join(STORAGE_DIR, 'latest');
const DIFF_DIR = path.join(STORAGE_DIR, 'diffs');

// Ensure directories exist
[BASELINE_DIR, LATEST_DIR, DIFF_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

interface VisualMismatch {
    scriptId: string; // This corresponds to visual_test_id in DB
    diffPercentage: number;
    hasBaseline: boolean;
}

export class VisualTestService {

    private getPath(testId: string, type: 'baseline' | 'latest' | 'diff') {
        const dir = type === 'baseline' ? BASELINE_DIR : type === 'latest' ? LATEST_DIR : DIFF_DIR;
        return path.join(dir, `${testId}.png`);
    }

    async getTests(projectId: string = 'default') {
        const { data, error } = await supabase
            .from('visual_tests')
            .select('*')
            .eq('project_id', projectId);

        if (error) throw new Error(error.message);
        return data;
    }

    async createTest(name: string, targetUrl: string, projectId: string = 'default-project') {
        const { data, error } = await supabase
            .from('visual_tests')
            .insert({ name, target_url: targetUrl, project_id: projectId })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    }

    async runTest(testId: string): Promise<VisualMismatch> {
        // 1. Fetch details
        const { data: testData, error } = await supabase
            .from('visual_tests')
            .select('*')
            .eq('id', testId)
            .single();

        if (error || !testData) {
            console.error('[VisualTest] DB Error:', error);
            throw new Error("Visual Test not found");
        }
        console.log(`[VisualTest] Starting test for: ${testData.name} (${testData.target_url})`);

        // 2. Launch Browser
        const browser = await chromium.launch({
            headless: process.env.HEADLESS !== 'false',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const context = await browser.newContext();
            const page = await context.newPage();

            // 3. Navigate
            console.log(`[VisualTest] Visiting ${testData.target_url}`);
            try {
                await page.goto(testData.target_url, { waitUntil: 'load', timeout: 30000 });
            } catch (navError: any) {
                console.error('[VisualTest] Navigation failed:', navError.message);
                throw navError;
            }

            // Optional: wait for a bit
            await page.waitForTimeout(1000);

            // 4. Screenshot
            const screenshotBuffer = await page.screenshot({ fullPage: true });

            // 5. Compare
            return await this.compare(testId, screenshotBuffer);

        } finally {
            await browser.close();
        }
    }

    // Logic: 
    // 1. Snapshot taken by Puppeteer (buffer)
    // 2. Identify Visual Test ID (or Script Name)
    // 3. Save to Disk
    // 4. Update DB record in `visual_snapshots`
    async compare(testId: string, currentImageBuffer: Buffer): Promise<VisualMismatch> {
        const baselinePath = this.getPath(testId, 'baseline');

        // Save current run
        await fs.promises.writeFile(this.getPath(testId, 'latest'), currentImageBuffer);

        const hasBaseline = fs.existsSync(baselinePath);
        let diffPercentage = 0;
        let status = 'new';
        let imagePath = this.getPath(testId, 'latest');

        if (hasBaseline) {
            const baselineImg = PNG.sync.read(fs.readFileSync(baselinePath));
            const currentImg = PNG.sync.read(currentImageBuffer);

            const { width, height } = baselineImg;
            const diff = new PNG({ width, height });

            if (width !== currentImg.width || height !== currentImg.height) {
                diffPercentage = 100; // Size mismatch
                status = 'fail';
            } else {
                const numDiffPixels = pixelmatch(
                    baselineImg.data, currentImg.data, diff.data, width, height, { threshold: 0.1 }
                );
                const totalPixels = width * height;
                diffPercentage = (numDiffPixels / totalPixels) * 100;
                status = diffPercentage > 0 ? 'fail' : 'pass';
            }

            if (diffPercentage > 0) {
                fs.writeFileSync(this.getPath(testId, 'diff'), PNG.sync.write(diff));
                imagePath = this.getPath(testId, 'diff');
            }
        }

        // Record Snapshot in DB
        await supabase.from('visual_snapshots').insert({
            visual_test_id: testId,
            image_path: imagePath, // Storing local path for now (or relative URL)
            is_baseline: hasBaseline,
            diff_percentage: diffPercentage,
            status: status
        });

        return { scriptId: testId, diffPercentage, hasBaseline };
    }

    getImages(testId: string) {
        return {
            baseline: this.getPath(testId, 'baseline'),
            latest: this.getPath(testId, 'latest'),
            diff: this.getPath(testId, 'diff')
        };
    }

    async approveLatest(testId: string): Promise<void> {
        const latestPath = this.getPath(testId, 'latest');
        const baselinePath = this.getPath(testId, 'baseline');

        if (fs.existsSync(latestPath)) {
            await fs.promises.copyFile(latestPath, baselinePath);

            // Clean diff
            const diffPath = this.getPath(testId, 'diff');
            if (fs.existsSync(diffPath)) await fs.promises.unlink(diffPath);

            // Update DB status to 'pass' or mark as baseline
            // Ideally we insert a NEW snapshot record as baseline=true
            await supabase.from('visual_snapshots').insert({
                visual_test_id: testId,
                image_path: baselinePath,
                is_baseline: true,
                diff_percentage: 0,
                status: 'pass'
            });

        } else {
            throw new Error("No latest run to approve");
        }
    }

    async deleteTest(testId: string): Promise<void> {
        // 1. Delete from DB
        const { error } = await supabase
            .from('visual_tests')
            .delete()
            .eq('id', testId);

        if (error) throw new Error(error.message);

        // 2. Delete Clean Artifacts (Baselines, Latest, Diff)
        const paths = [
            this.getPath(testId, 'baseline'),
            this.getPath(testId, 'latest'),
            this.getPath(testId, 'diff')
        ];

        for (const p of paths) {
            if (fs.existsSync(p)) {
                await fs.promises.unlink(p).catch(console.error);
            }
        }
    }
}

export const visualTestService = new VisualTestService();
