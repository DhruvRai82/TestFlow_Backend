import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

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
    scriptId: string;
    diffPercentage: number;
    hasBaseline: boolean;
}

export class VisualTestService {

    private getPath(scriptId: string, type: 'baseline' | 'latest' | 'diff') {
        const dir = type === 'baseline' ? BASELINE_DIR : type === 'latest' ? LATEST_DIR : DIFF_DIR;
        return path.join(dir, `${scriptId}.png`);
    }

    async saveBaseline(scriptId: string, imageBuffer: Buffer): Promise<void> {
        return fs.promises.writeFile(this.getPath(scriptId, 'baseline'), imageBuffer);
    }

    async saveLatest(scriptId: string, imageBuffer: Buffer): Promise<void> {
        return fs.promises.writeFile(this.getPath(scriptId, 'latest'), imageBuffer);
    }

    async getBaseline(scriptId: string): Promise<Buffer | null> {
        try {
            return await fs.promises.readFile(this.getPath(scriptId, 'baseline'));
        } catch {
            return null;
        }
    }

    async compare(scriptId: string, currentImageBuffer: Buffer): Promise<VisualMismatch> {
        const baselinePath = this.getPath(scriptId, 'baseline');

        // Save current run always
        await this.saveLatest(scriptId, currentImageBuffer);

        if (!fs.existsSync(baselinePath)) {
            // First run, no baseline. Auto-approve? Or wait for manual approval?
            // Usually valid to wait.
            return { scriptId, diffPercentage: 0, hasBaseline: false };
        }

        const baselineImg = PNG.sync.read(fs.readFileSync(baselinePath));
        const currentImg = PNG.sync.read(currentImageBuffer);

        const { width, height } = baselineImg;
        const diff = new PNG({ width, height });

        // Resize current if dimensions don't match (simple approach: fail if mismatch, but for now just handle same size)
        if (width !== currentImg.width || height !== currentImg.height) {
            // Dimension mismatch is a bug in itself
            return { scriptId, diffPercentage: 100, hasBaseline: true };
        }

        const numDiffPixels = pixelmatch(
            baselineImg.data,
            currentImg.data,
            diff.data,
            width,
            height,
            { threshold: 0.1 }
        );

        const totalPixels = width * height;
        const diffPercentage = (numDiffPixels / totalPixels) * 100;

        if (diffPercentage > 0) {
            fs.writeFileSync(this.getPath(scriptId, 'diff'), PNG.sync.write(diff));
        }

        return { scriptId, diffPercentage, hasBaseline: true };
    }

    getImages(scriptId: string) {
        return {
            baseline: this.getPath(scriptId, 'baseline'),
            latest: this.getPath(scriptId, 'latest'),
            diff: this.getPath(scriptId, 'diff')
        };
    }

    async approveLatest(scriptId: string): Promise<void> {
        const latestPath = this.getPath(scriptId, 'latest');
        const baselinePath = this.getPath(scriptId, 'baseline');

        if (fs.existsSync(latestPath)) {
            await fs.promises.copyFile(latestPath, baselinePath);
            // Clear diff if exists
            const diffPath = this.getPath(scriptId, 'diff');
            if (fs.existsSync(diffPath)) {
                await fs.promises.unlink(diffPath);
            }
        } else {
            throw new Error("No latest run to approve");
        }
    }
}

export const visualTestService = new VisualTestService();
