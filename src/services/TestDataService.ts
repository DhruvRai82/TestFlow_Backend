import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const DATASETS_DIR = path.join(__dirname, '../../storage/datasets');

if (!fs.existsSync(DATASETS_DIR)) {
    fs.mkdirSync(DATASETS_DIR, { recursive: true });
}

export interface Dataset {
    id: string;
    name: string;
    type: 'csv' | 'json';
    rowCount: number;
    headers: string[];
    createdAt: string;
}

export class TestDataService {

    async listDatasets(): Promise<Dataset[]> {
        const files = await fs.promises.readdir(DATASETS_DIR);
        const datasets: Dataset[] = [];

        for (const file of files) {
            try {
                // We'll store metadata in a separate .meta.json file or just infer from file
                // For simplicity, let's infer and maybe cache later.
                // Actually, reading every file stats might be slow. 
                // Let's assume filename format: {timestamp}_{name}.{ext}
                // Or just use a simple map json. 

                // Better approach for MVP: Read file content on demand, list files simply.
                const filePath = path.join(DATASETS_DIR, file);
                const stats = await fs.promises.stat(filePath);

                // Only process actual data files
                if (file.endsWith('.csv') || file.endsWith('.json')) {
                    const content = await fs.promises.readFile(filePath, 'utf8');
                    let rowCount = 0;
                    let headers: string[] = [];

                    if (file.endsWith('.csv')) {
                        const records = parse(content, { columns: true, skip_empty_lines: true }) as any[];
                        rowCount = records.length;
                        headers = records.length > 0 ? Object.keys(records[0]) : [];
                    } else if (file.endsWith('.json')) {
                        const json = JSON.parse(content);
                        if (Array.isArray(json)) {
                            rowCount = json.length;
                            headers = json.length > 0 ? Object.keys(json[0]) : [];
                        }
                    }

                    datasets.push({
                        id: file,
                        name: file,
                        type: file.endsWith('.csv') ? 'csv' : 'json',
                        rowCount,
                        headers,
                        createdAt: stats.birthtime.toISOString()
                    });
                }
            } catch (e) {
                console.error(`Error reading dataset ${file}:`, e);
            }
        }
        return datasets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    async saveDataset(name: string, content: string, type: 'csv' | 'json'): Promise<Dataset> {
        // Sanitize name
        const safeName = name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const filename = `${Date.now()}_${safeName}`;
        const filePath = path.join(DATASETS_DIR, filename);

        await fs.promises.writeFile(filePath, content);

        // Return details
        const savedStats = await this.listDatasets(); // Inefficient but simple
        return savedStats.find(d => d.id === filename)!;
    }

    async getData(id: string): Promise<any[]> {
        const filePath = path.join(DATASETS_DIR, id);
        if (!fs.existsSync(filePath)) throw new Error("Dataset not found");

        const content = await fs.promises.readFile(filePath, 'utf8');

        if (id.endsWith('.csv')) {
            return parse(content, { columns: true, skip_empty_lines: true });
        } else if (id.endsWith('.json')) {
            return JSON.parse(content);
        }
        return [];
    }

    async deleteDataset(id: string): Promise<void> {
        const filePath = path.join(DATASETS_DIR, id);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }
}

export const testDataService = new TestDataService();
