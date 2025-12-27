import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function reloadSchema() {
    console.log('Connecting to database...');
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected. Reloading schema cache...');

        // This command notifies PostgREST to reload its schema cache
        await client.query("NOTIFY pgrst, 'reload schema'");

        console.log('Successfully sent reload notification.');

        // Wait a bit for the cache to refresh
        console.log('Waiting 5 seconds for cache transition...');
        await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (err) {
        console.error('Error reloading schema:', err);
    } finally {
        await client.end();
        console.log('Disconnected.');
    }
}

reloadSchema();
