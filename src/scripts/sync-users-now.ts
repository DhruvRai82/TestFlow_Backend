
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

async function syncUsers() {
    console.log('--- SYNCING USERS (Auth -> Public) ---');

    // 1. Fetch Auth Users
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('Error fetching Auth Users:', authError);
        return;
    }
    console.log(`Found ${authUsers.length} users in Auth.`);

    // 2. Upsert into Public Users
    for (const user of authUsers) {
        const { id, email, created_at, user_metadata } = user;
        const username = user_metadata?.username || email?.split('@')[0] || 'user';
        const fullName = user_metadata?.full_name || user_metadata?.name || '';
        const avatarUrl = user_metadata?.avatar_url || '';

        console.log(`Syncing user: ${email} (${id})`);

        const { error: upsertError } = await supabase
            .from('users')
            .upsert({
                id,
                email,
                username,
                first_name: fullName.split(' ')[0] || '',
                last_name: fullName.split(' ').slice(1).join(' ') || '',
                avatar_url: avatarUrl,
                created_at,
                role: 'user',
                status: 'active'
            }, { onConflict: 'id' });

        if (upsertError) {
            console.error(`Failed to sync ${email}:`, upsertError.message);
        }
    }

    console.log('\nSync Complete!');
}

syncUsers();
