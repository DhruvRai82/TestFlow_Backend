import { supabase } from '../lib/supabase';

export interface FSNode {
    id: string;
    project_id: string;
    parent_id: string | null;
    user_id: string;
    name: string;
    type: 'file' | 'folder';
    language?: 'typescript' | 'python' | 'java';
    content?: string;
    created_at: string;
}

export class FileSystemService {

    // Get all nodes for a project (Flat list, frontend builds tree)
    async getNodes(projectId: string, userId: string): Promise<FSNode[]> {
        const { data, error } = await supabase
            .from('fs_nodes')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .order('type', { ascending: false }) // Folders first usually
            .order('name', { ascending: true });

        if (error) throw new Error(error.message);
        return data as FSNode[];
    }

    async createNode(params: {
        projectId: string;
        userId: string;
        parentId: string | null;
        name: string;
        type: 'file' | 'folder';
        language?: string;
        content?: string;
    }): Promise<FSNode> {
        const { data, error } = await supabase
            .from('fs_nodes')
            .insert({
                project_id: params.projectId,
                user_id: params.userId,
                parent_id: params.parentId,
                name: params.name,
                type: params.type,
                language: params.language || null,
                content: params.content || ''
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as FSNode;
    }

    async updateContent(id: string, content: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('fs_nodes')
            .update({ content, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
    }

    async renameNode(id: string, name: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('fs_nodes')
            .update({ name, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
    }

    async deleteNode(id: string, userId: string): Promise<void> {
        // Cascade delete should handle children if configured in DB
        // But RLS might block if not careful. Assuming DB Cascade is set.
        const { error } = await supabase
            .from('fs_nodes')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
    }

    // Check if file exists in folder
    async checkExists(projectId: string, parentId: string | null, name: string): Promise<boolean> {
        const query = supabase
            .from('fs_nodes')
            .select('id')
            .eq('project_id', projectId)
            .eq('name', name);

        if (parentId) {
            query.eq('parent_id', parentId);
        } else {
            query.is('parent_id', null);
        }

        const { data } = await query;
        return (data && data.length > 0) || false;
    }
}

export const fileSystemService = new FileSystemService();
