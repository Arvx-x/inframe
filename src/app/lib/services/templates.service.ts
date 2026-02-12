import { getSupabaseBrowserClient } from '../supabase-client';
import type { Database } from '../database.types';

type TemplateRow = Database['public']['Tables']['templates']['Row'];
type TemplateInsert = Database['public']['Tables']['templates']['Insert'];
type TemplateUpdate = Database['public']['Tables']['templates']['Update'];

export type Template = TemplateRow;

export async function createTemplate(payload: TemplateInsert): Promise<Template> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('templates')
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('Error creating template:', error);
        throw error;
    }

    if (!data) {
        throw new Error('Failed to create template');
    }

    return data as Template;
}

export async function getTemplate(id: string): Promise<Template | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching template:', error);
        return null;
    }

    return data as Template | null;
}

export async function getSystemTemplates(): Promise<Template[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('is_system', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching system templates:', error);
        return [];
    }

    return (data || []) as Template[];
}

export async function getUserTemplates(userId: string): Promise<Template[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('templates')
        .select('*')
        .or(`user_id.eq.${userId},is_system.eq.true`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user templates:', error);
        return [];
    }

    return (data || []) as Template[];
}

export async function searchTemplates(query: string): Promise<Template[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('templates')
        .select('*')
        .or(
            `name.ilike.%${query}%,category.ilike.%${query}%,tags::text.ilike.%${query}%`
        );

    if (error) {
        console.error('Error searching templates:', error);
        return [];
    }

    return (data || []) as Template[];
}

export async function updateTemplate(id: string, updates: TemplateUpdate): Promise<Template | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating template:', error);
        throw error;
    }

    return data as Template | null;
}

export async function deleteTemplate(id: string): Promise<boolean> {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting template:', error);
        throw error;
    }

    return true;
}

