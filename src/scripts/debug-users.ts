
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugUsers() {
    console.log('--- DEBUGGING USERS ---');

    // 1. Fetch Auth Users (System level)
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('Error fetching Auth Users:', authError);
        return;
    }
    console.log(`\n[Auth Users] Found: ${authUsers.length}`);
    authUsers.forEach(u => console.log(` - ${u.email} (ID: ${u.id})`));

    // 2. Fetch Public Users (App level)
    const { data: publicUsers, error: publicError } = await supabase
        .from('users')
        .select('*');

    if (publicError) {
        console.error('Error fetching Public Users:', publicError);
        return;
    }

    console.log(`\n[Public Users] Found: ${publicUsers?.length}`);
    publicUsers?.forEach(u => console.log(` - ${u.email} (ID: ${u.id})`));

    // 3. Compare
    const missingInPublic = authUsers.filter(au => !publicUsers?.find(pu => pu.id === au.id));
    if (missingInPublic.length > 0) {
        console.log(`\n[DISCREPANCY] ${missingInPublic.length} users are in Auth but MISSING in Public DB:`);
        missingInPublic.forEach(u => console.log(` - ${u.email}`));
        console.log('\nSOLUTION: Run the "setup_users_trigger.sql" script to sync them.');
    } else {
        console.log('\n[OK] All Auth users are present in Public DB.');
    }
}

debugUsers();
