// User profile service layer
import { getSupabaseBrowserClient } from '../supabase-client';
import type { Database } from '../database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export async function getProfile(userId: string): Promise<Profile | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }

    return data as Profile | null;
}

export async function createProfile(profile: ProfileInsert): Promise<Profile | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('profiles')
        .insert(profile)
        .select()
        .single();

    if (error) {
        console.error('Error creating profile:', error);
        throw error;
    }

    if (!data) {
        throw new Error('Failed to create profile');
    }

    return data as Profile;
}

export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('Error updating profile:', error);
        throw error;
    }

    return data as Profile | null;
}

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
    const supabase = getSupabaseBrowserClient();

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
        });

    if (uploadError) {
        console.error('Error uploading avatar:', uploadError);
        throw uploadError;
    }

    const { data } = supabase.storage
        .from('project-assets')
        .getPublicUrl(filePath);

    return data.publicUrl;
}
