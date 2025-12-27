import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkTables() {
    console.log('Checking Supabase tables...');

    // Method 1: Query public tables from pg_catalog (if permissions allow)
    const { data: tables, error } = await supabase.rpc('get_tables_info'); // Might not exist

    // Method 2: Try a simple select to see if it fails
    const checkTable = async (name: string) => {
        const { count, error } = await supabase.from(name).select('*', { count: 'exact', head: true });
        if (error) {
            console.log(`❌ Table '${name}':`, error.message);
        } else {
            console.log(`✅ Table '${name}': Exists (Count: ${count})`);
        }
    };

    await checkTable('tasks');
    await checkTable('users');
    await checkTable('connected_apps');
    await checkTable('conversations');
}

checkTables();
