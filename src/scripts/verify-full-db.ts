import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from the backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' }
});

async function inspectDatabase() {
    console.log('--- Database Inspection ---');

    // 1. List Tables (using a raw query via a simplified RPC or just checking access)
    // Since we don't have a direct "list tables" RPC, we'll try to select from expected tables.

    console.log('\nChecking Table Existence:');
    const tables = ['users', 'tasks', 'connected_apps', 'chats', 'messages'];

    for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            console.log(`[X] ${table}: Error - ${error.message} (Code: ${error.code})`);
        } else {
            console.log(`[✓] ${table}: Exists (Rows: ${count})`);
        }
    }

    // 2. Check Admin User in public.users
    console.log('\nChecking Admin User (public.users):');
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', 'admin@test.com');

    if (userError) {
        console.error('Error fetching admin:', userError);
    } else if (users && users.length > 0) {
        console.log('[✓] Admin User Found:', users[0]);
    } else {
        console.log('[X] Admin User NOT found in public.users table.');
    }

    // 3. Check Auth Users (Supabase Auth) - Requires service role
    console.log('\nChecking Supabase Auth Users:');
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('Error fetching auth users:', authError);
    } else {
        const adminAuth = authUsers.find(u => u.email === 'admin@test.com');
        if (adminAuth) {
            console.log('[✓] Admin Auth Account Found:', { id: adminAuth.id, email: adminAuth.email });
        } else {
            console.log('[X] Admin Auth Account NOT found.');
        }
    }
}

inspectDatabase();
