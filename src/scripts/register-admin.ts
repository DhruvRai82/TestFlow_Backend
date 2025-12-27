import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function registerAdmin(email: string, pass: string) {
    console.log(`🚀 Registering Admin: ${email}`);

    // 1. Create User in Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: pass,
        email_confirm: true
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            console.log('ℹ️ User already exists in Auth. Checking profile...');
            // Try to find user to get ID
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            const user = existingUsers.users.find(u => u.email === email);
            if (user) {
                await ensureProfile(user.id, email);
            }
            return;
        }
        console.error('❌ Auth Creation Failed:', authError.message);
        return;
    }

    console.log('✅ Auth User Created:', authData.user.id);
    await ensureProfile(authData.user.id, email);
}

async function ensureProfile(userId: string, email: string) {
    // 2. Create/Update Profile in public.users
    const { error: profileError } = await supabase
        .from('users')
        .upsert({
            id: userId,
            email,
            role: 'admin',
            status: 'active',
            username: email.split('@')[0]
        });

    if (profileError) {
        console.error('❌ Profile Creation Failed:', profileError.message);
    } else {
        console.log('✅ Admin Profile Synced in public.users');
    }
}

// Get from CLI or use defaults
const args = process.argv.slice(2);
const email = args[0] || 'admin@test.com';
const pass = args[1] || 'admin12345';

registerAdmin(email, pass);
