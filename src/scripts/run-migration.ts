import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv'; // Load env vars

// Load from backend root .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DB_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DB_URL) {
    console.error('❌ Error: DATABASE_URL not found in environment variables.');
    console.error('Please check your .env file.');
    process.exit(1);
}

const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false } // Required for Supabase usually
});

async function runMigration() {
    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected.');

        const sqlPath = path.join(__dirname, '../migrations/create_admin_tables.sql');
        console.log(`📂 Reading migration file: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('🚀 Executing SQL Migration...');
        await client.query(sql);

        console.log('✅ Migration successful! Tables created.');
    } catch (err) {
        console.error('❌ Migration Failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
