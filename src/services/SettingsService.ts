import { supabase } from '../lib/supabase';

export interface UserAIKey {
    id: string;
    user_id: string;
    name: string;
    provider: string;
    api_key: string;
    model: string;
    is_active: boolean;
    created_at: string;
}

export const settingsService = {

    async getAIKeys(userId: string): Promise<UserAIKey[]> {
        const { data, error } = await supabase
            .from('user_ai_keys')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching AI keys:', error);
            throw error;
        }

        // Mask keys for security
        return data.map(key => ({
            ...key,
            api_key: `${key.api_key.substring(0, 4)}...${key.api_key.slice(-4)}`
        }));
    },

    async addAIKey(userId: string, keyData: { name: string, apiKey: string, model: string }): Promise<UserAIKey> {
        // If this is the first key, make it active by default
        const { count } = await supabase
            .from('user_ai_keys')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const isActive = count === 0;

        const { data, error } = await supabase
            .from('user_ai_keys')
            .insert({
                user_id: userId,
                name: keyData.name,
                api_key: keyData.apiKey,
                model: keyData.model,
                provider: 'gemini',
                is_active: isActive
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteAIKey(userId: string, keyId: string): Promise<void> {
        const { error } = await supabase
            .from('user_ai_keys')
            .delete()
            .eq('id', keyId)
            .eq('user_id', userId);

        if (error) throw error;
    },

    async activateAIKey(userId: string, keyId: string): Promise<void> {
        // 1. Deactivate all for user
        await supabase
            .from('user_ai_keys')
            .update({ is_active: false })
            .eq('user_id', userId);

        // 2. Activate specific key
        const { error } = await supabase
            .from('user_ai_keys')
            .update({ is_active: true })
            .eq('id', keyId)
            .eq('user_id', userId);

        if (error) throw error;
    }
};
