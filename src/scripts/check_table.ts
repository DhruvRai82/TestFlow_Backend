import { supabase } from '../lib/supabase';

async function checkQuery() {
    console.log('Testing fs_nodes query...');
    const projectId = 'e8477172-087a-4d72-a309-60871b372ddd';
    const userId = 'test-user-id'; // Or whatever generic ID

    console.log(`Querying for Project: ${projectId}, User: ${userId}`);

    const { data, error } = await supabase
        .from('fs_nodes')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('type', { ascending: false })
        .order('name', { ascending: true });

    if (error) {
        console.error('FULL ERROR OBJECT:', JSON.stringify(error, null, 2));
    } else {
        console.log('SUCCESS. Rows found:', data?.length);
    }
}

checkQuery();
