import { supabase } from '../lib/supabase';

async function testApiLogic() {
    console.log('Testing Admin API Logic (Tasks)...');
    try {
        const { data: tasks, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });

        if (taskError) {
            console.error('❌ Tasks Query Failed:', taskError.message);
        } else {
            console.log(`✅ Tasks Found: ${tasks.length}`);
            if (tasks.length > 0) console.log('First Task:', tasks[0].title);
        }

        console.log('\nTesting Admin API Logic (Users)...');
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (userError) {
            console.error('❌ Users Query Failed:', userError.message);
        } else {
            console.log(`✅ Users Found: ${users.length}`);
        }

    } catch (err) {
        console.error('❌ Unexpected Error:', err);
    }
}

testApiLogic();
