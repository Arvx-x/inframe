// Operations log service for undo/redo persistence and audit trail
import { getSupabaseBrowserClient } from '../supabase-client';
import type { Database } from '../database.types';

type OpsLog = Database['public']['Tables']['ops_log']['Row'];
type OpsLogInsert = Database['public']['Tables']['ops_log']['Insert'];

export interface Operation {
    id: string;
    operationType: string;
    operationData: any;
    sequenceNumber: number;
    createdAt: string;
}

export async function logOperation(
    projectId: string,
    userId: string,
    operationType: string,
    operationData: any
): Promise<OpsLog> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('ops_log')
        .insert({
            project_id: projectId,
            user_id: userId,
            operation_type: operationType,
            operation_data: operationData,
        })
        .select()
        .single();

    if (error) {
        console.error('Error logging operation:', error);
        throw error;
    }

    return data;
}

export async function getProjectOperations(
    projectId: string,
    limit: number = 100
): Promise<OpsLog[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('ops_log')
        .select('*')
        .eq('project_id', projectId)
        .order('sequence_number', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching operations:', error);
        return [];
    }

    return data || [];
}

export async function getOperationsSince(
    projectId: string,
    sequenceNumber: number
): Promise<OpsLog[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('ops_log')
        .select('*')
        .eq('project_id', projectId)
        .gt('sequence_number', sequenceNumber)
        .order('sequence_number', { ascending: true });

    if (error) {
        console.error('Error fetching operations:', error);
        return [];
    }

    return data || [];
}

export async function clearProjectOperations(projectId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase
        .from('ops_log')
        .delete()
        .eq('project_id', projectId);

    if (error) {
        console.error('Error clearing operations:', error);
        throw error;
    }
}
