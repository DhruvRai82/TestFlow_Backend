
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    console.log('--- Inspecting user_ai_keys ---');

    // 1. Check if we can select from it
    const { data, error } = await supabase.from('user_ai_keys').select('*').limit(1);

    if (error) {
        console.log('Error selecting table:', error.code, error.message);
        if (error.code === 'PGRST205') {
            console.log('STATUS: Table not found in API cache. (It might exist in DB but API needs refresh)');
        }
    } else {
        console.log('STATUS: Table exists and is accessible.');
    }

    // 2. Try to insert a text ID to see if type is fixed
    if (!error || error.code !== 'PGRST205') {
        const testId = 'test-string-id';
        const { error: insertError } = await supabase.from('user_ai_keys').insert({
            user_id: testId,
            name: 'Debug Key',
            api_key: 'debug',
            model: 'debug'
        });

        if (insertError) {
            console.log('Insert Test:', insertError.message);
            if (insertError.message.includes('invalid input syntax for type uuid')) {
                console.log('TYPE CHECK: user_id is still UUID. Migration needed.');
            } else {
                console.log('TYPE CHECK: ' + insertError.message);
            }
        } else {
            console.log('TYPE CHECK: Insert successful. user_id accepts TEXT.');
            // clean up
            await supabase.from('user_ai_keys').delete().eq('api_key', 'debug');
        }
    }
}

inspectSchema();
