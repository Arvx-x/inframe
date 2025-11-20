// Project snapshots service for version history
import { getSupabaseBrowserClient } from '../supabase-client';
import type { Database } from '../database.types';

type Snapshot = Database['public']['Tables']['project_snapshots']['Row'];
type SnapshotInsert = Database['public']['Tables']['project_snapshots']['Insert'];

export interface SnapshotData {
    id: string;
    projectId: string;
    snapshotName: string | null;
    isAuto: boolean;
    createdAt: string;
}

export async function createSnapshot(
    projectId: string,
    userId: string,
    snapshotData: any,
    snapshotName: string | null = null,
    isAuto: boolean = false
): Promise<Snapshot> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('project_snapshots')
        .insert({
            project_id: projectId,
            user_id: userId,
            snapshot_data: snapshotData,
            snapshot_name: snapshotName,
            is_auto: isAuto,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating snapshot:', error);
        throw error;
    }

    return data;
}

export async function getProjectSnapshots(
    projectId: string,
    limit: number = 50
): Promise<Snapshot[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('project_snapshots')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching snapshots:', error);
        return [];
    }

    return data || [];
}

export async function getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('project_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();

    if (error) {
        console.error('Error fetching snapshot:', error);
        return null;
    }

    return data;
}

export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase
        .from('project_snapshots')
        .delete()
        .eq('id', snapshotId);

    if (error) {
        console.error('Error deleting snapshot:', error);
        throw error;
    }

    return true;
}

export async function deleteOldAutoSnapshots(
    projectId: string,
    keepCount: number = 10
): Promise<void> {
    const supabase = getSupabaseBrowserClient();

    // Get all auto snapshots
    const { data: snapshots } = await supabase
        .from('project_snapshots')
        .select('id')
        .eq('project_id', projectId)
        .eq('is_auto', true)
        .order('created_at', { ascending: false });

    if (!snapshots || snapshots.length <= keepCount) {
        return;
    }

    // Delete old ones
    const toDelete = snapshots.slice(keepCount);
    const ids = toDelete.map((s) => s.id);

    const { error } = await supabase
        .from('project_snapshots')
        .delete()
        .in('id', ids);

    if (error) {
        console.error('Error deleting old snapshots:', error);
    }
}
