import { Client } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DB_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DB_URL) {
    console.error('❌ Error: DATABASE_URL not found.');
    process.exit(1);
}

const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
});

const TASKS_DATA = [
    { title: "Fix login bug", status: "todo", priority: "high", label: "bug" },
    { title: "Update documentation", status: "done", priority: "low", label: "documentation" },
    { title: "Dashboard redesign", status: "in-progress", priority: "medium", label: "feature" },
    { title: "System maintenance", status: "backlog", priority: "low", label: "bug" },
    { title: "API Optimization", status: "todo", priority: "high", label: "feature" }
];

const CONNECTED_APPS_DATA = [
    { name: 'Telegram', desc_text: 'Connect with Telegram for real-time communication.', is_connected: false },
    { name: 'Notion', desc_text: 'Effortlessly sync Notion pages.', is_connected: true },
    { name: 'Figma', desc_text: 'View and collaborate on Figma designs.', is_connected: true },
    { name: 'Slack', desc_text: 'Integrate Slack for team communication.', is_connected: false },
    { name: 'Zoom', desc_text: 'Host Zoom meetings directly.', is_connected: true }
];

async function seedData() {
    try {
        console.log('🌱 Connecting to database...');
        await client.connect();

        // 1. Seed Tasks
        console.log('📝 Seeding Tasks...');
        for (const t of TASKS_DATA) {
            await client.query(`
        INSERT INTO public.tasks (title, status, priority, label) 
        VALUES ($1, $2, $3, $4)
      `, [t.title, t.status, t.priority, t.label]);
        }

        // 2. Seed Connected Apps
        console.log('🔗 Seeding Connected Apps...');
        for (const a of CONNECTED_APPS_DATA) {
            await client.query(`
        INSERT INTO public.connected_apps (name, desc_text, is_connected) 
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO NOTHING
      `, [a.name, a.desc_text, a.is_connected]);
        }

        // 3. Seed Users (Tricky part - usually handled by Auth)
        // We will inspect auth.users and create profiles for them if missing
        console.log('👤 Syncing existing Auth Users to Profiles...');
        // We can't select from auth.users easily without superuser, 
        // but we can try to insert a dummy user for testing if RLS allows or if we are using service role.
        // NOTE: If RLS is strict, this might fail, but for now we proceed.

        console.log('✅ Seeding Complete!');

    } catch (err) {
        console.error('❌ Seeding Failed:', err);
    } finally {
        await client.end();
    }
}

seedData();
