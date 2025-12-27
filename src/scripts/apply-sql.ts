import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is missing in .env');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Supabase requires SSL, but often rejects self-signed in dev
});

async function applySql(filename: string) {
    const filePath = path.join(__dirname, '../sql', filename);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Applying ${filename}...`);
    try {
        await client.query(sql);
        console.log(`Successfully applied ${filename}`);
    } catch (err) {
        console.error(`Error applying ${filename}:`, err);
    }
}

async function run() {
    try {
        await client.connect();
        console.log('Connected to Postgres.');

        await applySql('setup_chats.sql');
        await applySql('setup_users.sql');
        await applySql('setup_users_trigger.sql');

    } catch (err) {
        console.error('Database connection error:', err);
    } finally {
        await client.end();
    }
}

run();
