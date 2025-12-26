import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';

const DATA_DIR = path.join(__dirname, '../../data');

export interface TableDump {
    tableName: string;
    rows: any[];
}

export interface DatabaseDump {
    source: 'local' | 'supabase';
    tables: TableDump[];
}

export class DatabaseInspectorService {

    // 1. Local JSON Inspector
    async getLocalData(userId: string): Promise<DatabaseDump> {
        const tables: TableDump[] = [];

        // A. Users (roles.json) - Likely global or empty for local, but let's include if exists
        const rolesPath = path.join(DATA_DIR, 'roles.json');
        if (fs.existsSync(rolesPath)) {
            tables.push({
                tableName: 'users (roles.json)',
                rows: JSON.parse(fs.readFileSync(rolesPath, 'utf-8'))
            });
        }

        // B. Projects (projects.json) - FILTERED
        const projectsPath = path.join(DATA_DIR, 'projects.json');
        let projectIds: string[] = [];
        if (fs.existsSync(projectsPath)) {
            const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf-8'));
            const allProjects = projectsData.projects || [];
            // SCOPING HERE
            const userProjects = allProjects.filter((p: any) => p.user_id === userId);

            tables.push({
                tableName: 'projects',
                rows: userProjects
            });
            projectIds = userProjects.map((p: any) => p.id);
        }

        // C. Visual Tests (visual_tests.json) - FILTERED via Project Check (approx)
        const visualTestsPath = path.join(DATA_DIR, 'visual_tests.json');
        if (fs.existsSync(visualTestsPath)) {
            const allTests = JSON.parse(fs.readFileSync(visualTestsPath, 'utf-8'));
            const userTests = allTests.filter((t: any) => projectIds.includes(t.projectId));

            tables.push({
                tableName: 'visual_tests',
                rows: userTests
            });
        }

        // D. Request Lab (requests.json) - Can hold userId
        const requestsPath = path.join(DATA_DIR, 'requests.json');
        if (fs.existsSync(requestsPath)) {
            const allReqs = JSON.parse(fs.readFileSync(requestsPath, 'utf-8'));
            const userReqs = allReqs.filter((r: any) => r.userId === userId || r.user_id === userId);

            tables.push({
                tableName: 'api_requests',
                rows: userReqs
            });
        }


        // E. Project Specific Data (Recursive)
        const allDailyData: any[] = [];
        const allBugs: any[] = [];
        const allTestCases: any[] = [];

        for (const pid of projectIds) {
            const pPath = path.join(DATA_DIR, `project-${pid}-data.json`);
            if (fs.existsSync(pPath)) {
                try {
                    const pData = JSON.parse(fs.readFileSync(pPath, 'utf-8'));

                    // Flatten Daily Data and Extract Bugs/TestCases
                    if (pData.dailyData) {
                        pData.dailyData.forEach((day: any) => {
                            allDailyData.push({
                                projectId: pid,
                                date: day.date,
                                ...day
                            });

                            // Derived Tables
                            if (day.bugs && Array.isArray(day.bugs)) {
                                day.bugs.forEach((b: any) => allBugs.push({ ...b, projectId: pid, date: day.date }));
                            }
                            if (day.testCases && Array.isArray(day.testCases)) {
                                day.testCases.forEach((t: any) => allTestCases.push({ ...t, projectId: pid, date: day.date }));
                            }
                        });
                    }
                } catch (e) {
                    console.error(`Error reading project data for ${pid}`, e);
                }
            }
        }

        tables.push({ tableName: 'daily_data (Aggregated)', rows: allDailyData });
        if (allBugs.length > 0) tables.push({ tableName: 'bugs (derived)', rows: allBugs });
        if (allTestCases.length > 0) tables.push({ tableName: 'test_cases (derived)', rows: allTestCases });

        return { source: 'local', tables };
    }

    // 2. Supabase Inspector
    async getSupabaseData(userId: string): Promise<DatabaseDump> {
        const tables: TableDump[] = [];

        // Helper to fetch scoped table
        const fetchTable = async (name: string) => {
            let query = supabase.from(name).select('*');

            if (name === 'user_roles') {
                query = query.eq('user_id', userId);
            } else {
                query = query.eq('user_id', userId);
            }

            // Limit for safety, but maybe higher for dumps
            const { data, error } = await query.limit(100);

            if (!error && data) {
                tables.push({ tableName: name, rows: data });
            }
        };

        const tableNames = [
            'projects',
            'daily_data',
            'recorded_scripts',
            'visual_tests',
            'bugs',
            'test_cases',
            'schedules',
            'test_suites',
            'test_runs',
            'api_requests',
            'api_collections'
        ];

        for (const name of tableNames) {
            await fetchTable(name);
        }

        return { source: 'supabase', tables };
    }
}

export const databaseInspectorService = new DatabaseInspectorService();
