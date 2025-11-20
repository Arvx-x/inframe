// Asset storage service layer
import { getSupabaseBrowserClient } from '../supabase-client';

export interface UploadAssetResult {
    path: string;
    publicUrl: string;
}

export async function uploadAsset(
    userId: string,
    projectId: string,
    file: File,
    folder: 'images' | 'exports' = 'images'
): Promise<UploadAssetResult> {
    const supabase = getSupabaseBrowserClient();

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${projectId}/${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (uploadError) {
        console.error('Error uploading asset:', uploadError);
        throw uploadError;
    }

    const { data } = supabase.storage
        .from('project-assets')
        .getPublicUrl(filePath);

    return {
        path: filePath,
        publicUrl: data.publicUrl,
    };
}

export async function deleteAsset(filePath: string): Promise<boolean> {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase.storage
        .from('project-assets')
        .remove([filePath]);

    if (error) {
        console.error('Error deleting asset:', error);
        throw error;
    }

    return true;
}

export async function getAssetUrl(filePath: string): Promise<string> {
    const supabase = getSupabaseBrowserClient();

    const { data } = supabase.storage
        .from('project-assets')
        .getPublicUrl(filePath);

    return data.publicUrl;
}

export async function uploadDataURL(
    userId: string,
    projectId: string,
    dataUrl: string,
    fileName: string,
    folder: 'images' | 'exports' = 'exports'
): Promise<UploadAssetResult> {
    const supabase = getSupabaseBrowserClient();

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const filePath = `${userId}/${projectId}/${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('project-assets')
        .upload(filePath, blob, {
            cacheControl: '3600',
            upsert: true,
            contentType: blob.type,
        });

    if (uploadError) {
        // Check if bucket doesn't exist
        const errorMessage = uploadError.message || '';
        const statusCode = (uploadError as any).statusCode;
        if (errorMessage.includes('Bucket not found') || 
            errorMessage.includes('bucket') ||
            statusCode === 404) {
            const error = new Error('Storage bucket "project-assets" not found. Please create it in Supabase dashboard.');
            (error as any).statusCode = 404;
            throw error;
        }
        console.error('Error uploading data URL:', uploadError);
        throw uploadError;
    }

    const { data } = supabase.storage
        .from('project-assets')
        .getPublicUrl(filePath);

    return {
        path: filePath,
        publicUrl: data.publicUrl,
    };
}
