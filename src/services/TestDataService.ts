import { supabase } from '../lib/supabase';

export interface Dataset {
    id: string;
    project_id: string;
    name: string;
    data_type: 'csv' | 'json';
    content: string;
    created_at: string;
    // Helper fields for UI (not in DB directly but derived)
    rowCount?: number;
    headers?: string[];
}

export class TestDataService {

    async listDatasets(projectId: string): Promise<Dataset[]> {
        const { data, error } = await supabase
            .from('test_datasets')
            // Don't fetch 'content' to avoid OOM crash on list view
            .select('id, project_id, name, data_type, created_at')
            .eq('project_id', projectId) // Filter by project
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        // Enrichment will use empty row counts since content is missing
        return data.map(d => this.enrichMetadata(d));
    }

    async saveDataset(name: string, content: string, type: 'csv' | 'json', projectId: string = 'default-project'): Promise<Dataset> {
        // Basic validation
        if (type === 'json') {
            try { JSON.parse(content); } catch (e) { throw new Error("Invalid JSON content"); }
        }

        const { data, error } = await supabase
            .from('test_datasets')
            .insert({
                name,
                content,
                data_type: type,
                project_id: projectId
            })
            .select()
            .single();

        if (error) throw new Error(error.message);

        return this.enrichMetadata(data);
    }

    async getData(id: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('test_datasets')
            .select('content, data_type')
            .eq('id', id)
            .single();

        if (error) throw new Error(error.message);

        if (data.data_type === 'json') {
            return JSON.parse(data.content);
        } else {
            // Lazy import csv-parse to avoid top-level dependency if possible, but standard import is fine
            const { parse } = require('csv-parse/sync');
            return parse(data.content, { columns: true, skip_empty_lines: true });
        }
    }

    async deleteDataset(id: string): Promise<void> {
        const { error } = await supabase
            .from('test_datasets')
            .delete()
            .eq('id', id);

        if (error) throw new Error(error.message);
    }

    // Helper to add row count/headers for UI preview without saving them to DB redundant
    private enrichMetadata(dataset: any): Dataset {
        let rowCount = 0;
        let headers: string[] = [];

        try {
            if (!dataset.content) {
                // Content not valid or not fetched
                return {
                    ...dataset,
                    rowCount: 0,
                    headers: []
                };
            }

            if (dataset.data_type === 'json') {
                const json = JSON.parse(dataset.content);
                if (Array.isArray(json)) {
                    rowCount = json.length;
                    headers = json.length > 0 ? Object.keys(json[0]) : [];
                }
            } else {
                // Simple estimation for CSV to avoid full parsing on list
                const lines = dataset.content.split('\n').filter((l: string) => l.trim().length > 0);
                rowCount = Math.max(0, lines.length - 1);
                headers = lines.length > 0 ? lines[0].split(',') : [];
            }
        } catch (e) {
            console.warn(`Failed to parse metadata for dataset ${dataset.id}`);
        }

        return {
            ...dataset,
            rowCount,
            headers,
            // Don't send full content in list view if it's huge? 
            // For now, we are sending it. If huge, we should strip it in 'listDatasets' select.
        };
    }
}

export const testDataService = new TestDataService();
