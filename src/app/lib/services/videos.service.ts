import { getSupabaseBrowserClient } from '../supabase-client';
import type { Database } from '../database.types';

type GeneratedVideoRow = Database['public']['Tables']['generated_videos']['Row'];
type GeneratedVideoInsert = Database['public']['Tables']['generated_videos']['Insert'];
type GeneratedVideoUpdate = Database['public']['Tables']['generated_videos']['Update'];

export type GeneratedVideo = GeneratedVideoRow;

export async function createGeneratedVideo(payload: GeneratedVideoInsert): Promise<GeneratedVideo> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('generated_videos')
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('Error creating generated video record:', error);
        throw error;
    }

    if (!data) {
        throw new Error('Failed to create generated video record');
    }

    return data as GeneratedVideo;
}

export async function updateGeneratedVideo(
    id: string,
    updates: GeneratedVideoUpdate
): Promise<GeneratedVideo | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('generated_videos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating generated video record:', error);
        throw error;
    }

    return data as GeneratedVideo | null;
}

export async function getVideosForProject(projectId: string): Promise<GeneratedVideo[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('generated_videos')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching videos for project:', error);
        return [];
    }

    return (data || []) as GeneratedVideo[];
}

export async function getVideosForCampaign(campaignId: string): Promise<GeneratedVideo[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('generated_videos')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching videos for campaign:', error);
        return [];
    }

    return (data || []) as GeneratedVideo[];
}

