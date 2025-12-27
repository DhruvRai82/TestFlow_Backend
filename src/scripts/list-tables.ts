import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function listAllTables() {
    console.log('Listing all tables in public schema...');

    // Try to query the postgres internal tables
    const { data, error } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');

    if (error) {
        console.log('Error querying pg_tables (expected if no permissions):', error.message);
        // Fallback: Try a raw query if handled by an RPC or just try known tables
        const tablesToTry = ['tasks', 'users', 'connected_apps', 'conversations', 'user_ai_keys', 'projects'];
        for (const t of tablesToTry) {
            const { error: err } = await supabase.from(t).select('id').limit(1);
            if (err) {
                console.log(`❌ Table '${t}':`, err.message);
            } else {
                console.log(`✅ Table '${t}': Found`);
            }
        }
    } else {
        console.log('Tables found:', data.map(t => t.tablename).join(', '));
    }
}

listAllTables();
