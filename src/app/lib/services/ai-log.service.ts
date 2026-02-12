import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../database.types';

type AIGenerationLogRow = Database['public']['Tables']['ai_generation_log']['Row'];
type AIGenerationLogInsert = Database['public']['Tables']['ai_generation_log']['Insert'];

export type AIGenerationLog = AIGenerationLogRow;

export interface LogAIInteractionPayload {
    userId: string;
    campaignId?: string | null;
    projectId?: string | null;
    brandKitId?: string | null;
    actionType: string;
    inputPrompt: string;
    inputContext?: Json | null;
    outputSummary?: string | null;
    outputData?: Json | null;
    rating?: number | null;
}

export async function logAIInteraction(
    supabase: SupabaseClient<Database>,
    payload: LogAIInteractionPayload
): Promise<AIGenerationLog> {
    const insertPayload: AIGenerationLogInsert = {
        user_id: payload.userId,
        campaign_id: payload.campaignId ?? null,
        project_id: payload.projectId ?? null,
        brand_kit_id: payload.brandKitId ?? null,
        action_type: payload.actionType,
        input_prompt: payload.inputPrompt,
        input_context: payload.inputContext ?? null,
        output_summary: payload.outputSummary ?? null,
        output_data: payload.outputData ?? null,
        rating: payload.rating ?? null,
    };

    const { data, error } = await supabase
        .from('ai_generation_log')
        .insert(insertPayload)
        .select()
        .single();

    if (error) {
        console.error('Error logging AI interaction:', error);
        throw error;
    }

    if (!data) {
        throw new Error('Failed to create AI generation log entry');
    }

    return data as AIGenerationLog;
}

export async function getRecentAIInteractions(
    supabase: SupabaseClient<Database>,
    userId: string,
    limit: number = 20
): Promise<AIGenerationLog[]> {
    const { data, error } = await supabase
        .from('ai_generation_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching AI generation log:', error);
        return [];
    }

    return (data || []) as AIGenerationLog[];
}

