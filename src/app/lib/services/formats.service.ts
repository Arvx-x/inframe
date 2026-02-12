import { getSupabaseBrowserClient } from '../supabase-client';
import type { Database } from '../database.types';

type DesignFormatRow = Database['public']['Tables']['design_formats']['Row'];

export type DesignFormat = DesignFormatRow;

export async function getDesignFormats(): Promise<DesignFormat[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('design_formats')
        .select('*')
        .order('platform', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching design formats:', error);
        return [];
    }

    return (data || []) as DesignFormat[];
}

export async function getFormatsByPlatform(platform: string): Promise<DesignFormat[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('design_formats')
        .select('*')
        .eq('platform', platform)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching formats by platform:', error);
        return [];
    }

    return (data || []) as DesignFormat[];
}

