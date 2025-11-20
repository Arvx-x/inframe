// Project management service layer
import { getSupabaseBrowserClient } from '../supabase-client';
import type { Database } from '../database.types';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export interface ProjectData {
    id: string;
    name: string;
    canvasData: any;
    canvasColor: string;
    thumbnailUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

export async function createProject(userId: string, name: string = 'Untitled Project'): Promise<Project> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('projects')
        .insert({
            user_id: userId,
            name,
            canvas_data: null,
            canvas_color: '#F4F4F6',
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating project:', error);
        throw error;
    }

    if (!data) {
        throw new Error('Failed to create project');
    }

    return data as Project;
}

export async function getProject(projectId: string): Promise<Project | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

    if (error) {
        console.error('Error fetching project:', error);
        return null;
    }

    return data as Project | null;
}

export async function getUserProjects(userId: string): Promise<Project[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching projects:', error);
        return [];
    }

    return (data || []) as Project[];
}

export async function updateProject(
    projectId: string,
    updates: Partial<{
        name: string;
        canvas_data: any;
        canvas_color: string;
        thumbnail_url: string;
    }>
): Promise<Project | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

    if (error) {
        console.error('Error updating project:', error);
        throw error;
    }

    return data as Project | null;
}

export async function deleteProject(projectId: string): Promise<boolean> {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

    if (error) {
        console.error('Error deleting project:', error);
        throw error;
    }

    return true;
}

export async function saveCanvas(projectId: string, canvasData: any, canvasColor: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase
        .from('projects')
        .update({
            canvas_data: canvasData,
            canvas_color: canvasColor,
        })
        .eq('id', projectId);

    if (error) {
        console.error('Error saving canvas:', error);
        throw error;
    }
}

export async function saveThumbnail(projectId: string, thumbnailUrl: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase
        .from('projects')
        .update({ thumbnail_url: thumbnailUrl })
        .eq('id', projectId);

    if (error) {
        console.error('Error saving thumbnail:', error);
        throw error;
    }
}
