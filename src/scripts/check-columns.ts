import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkColumns() {
    console.log('--- TASKS ---');
    const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .limit(1);

    if (taskError) {
        console.log('Error selecting tasks:', taskError.message);
    } else if (taskData && taskData.length > 0) {
        console.log('Keys:', Object.keys(taskData[0]));
    } else {
        console.log('Tasks table accessible but empty.');
    }

    console.log('--- CONVERSATIONS ---');
    const { data: chatData, error: chatError } = await supabase
        .from('conversations')
        .select('*')
        .limit(1);

    if (chatError) {
        console.log('Error selecting conversations:', chatError.message);
    } else if (chatData && chatData.length > 0) {
        console.log('Keys:', Object.keys(chatData[0]));
    } else {
        console.log('Conversations table accessible but empty.');
    }

    console.log('--- USERS ---');
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .limit(1);

    if (userError) {
        console.log('Error selecting users:', userError.message);
    } else if (userData && userData.length > 0) {
        console.log('Keys:', Object.keys(userData[0]));
    } else {
        console.log('Users table accessible but empty.');
    }
}

checkColumns();
