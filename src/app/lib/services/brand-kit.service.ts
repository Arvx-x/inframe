import { getSupabaseBrowserClient } from '../supabase-client';
import type { Database } from '../database.types';

type BrandKitRow = Database['public']['Tables']['brand_kits']['Row'];
type BrandKitInsert = Database['public']['Tables']['brand_kits']['Insert'];
type BrandKitUpdate = Database['public']['Tables']['brand_kits']['Update'];

export type BrandKit = BrandKitRow;

export async function createBrandKit(payload: BrandKitInsert): Promise<BrandKit> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('brand_kits')
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('Error creating brand kit:', error);
        throw error;
    }

    if (!data) {
        throw new Error('Failed to create brand kit');
    }

    return data as BrandKit;
}

export async function getBrandKit(id: string): Promise<BrandKit | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('brand_kits')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching brand kit:', error);
        return null;
    }

    return data as BrandKit | null;
}

export async function getUserBrandKits(userId: string): Promise<BrandKit[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('brand_kits')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching brand kits:', error);
        return [];
    }

    return (data || []) as BrandKit[];
}

export async function updateBrandKit(id: string, updates: BrandKitUpdate): Promise<BrandKit | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('brand_kits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating brand kit:', error);
        throw error;
    }

    return data as BrandKit | null;
}

export async function deleteBrandKit(id: string): Promise<boolean> {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase
        .from('brand_kits')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting brand kit:', error);
        throw error;
    }

    return true;
}

