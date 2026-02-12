import { getSupabaseBrowserClient } from '../supabase-client';
import type { Database } from '../database.types';

type CampaignRow = Database['public']['Tables']['campaigns']['Row'];
type CampaignInsert = Database['public']['Tables']['campaigns']['Insert'];
type CampaignUpdate = Database['public']['Tables']['campaigns']['Update'];

type CampaignDesignRow = Database['public']['Tables']['campaign_designs']['Row'];
type CampaignDesignInsert = Database['public']['Tables']['campaign_designs']['Insert'];

export type Campaign = CampaignRow;
export type CampaignDesign = CampaignDesignRow;

function normalizeCampaignError(error: any): never {
    const rawMessage =
        error?.message ||
        error?.details ||
        error?.hint ||
        'Campaign operation failed';

    const message = String(rawMessage);
    const isMissingTable =
        message.includes("Could not find the table 'public.campaigns'") ||
        message.toLowerCase().includes("relation \"campaigns\" does not exist");

    if (isMissingTable) {
        throw new Error(
            "Supabase table 'public.campaigns' is missing in this project. Run the schema SQL in Supabase Dashboard -> SQL Editor, then run: NOTIFY pgrst, 'reload schema';"
        );
    }

    throw error;
}

export async function createCampaign(payload: CampaignInsert): Promise<Campaign> {
    const supabase = getSupabaseBrowserClient();

    // Ensure profile exists for the authenticated user before inserting campaign.
    // Some existing users may predate the auth trigger that auto-creates profiles.
    const { data: existingProfile, error: profileReadError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', payload.user_id)
        .maybeSingle();

    if (profileReadError) {
        console.error('Error checking profile before campaign creation:', profileReadError);
    }

    if (!existingProfile) {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
            throw new Error('Unable to verify signed-in user for campaign creation');
        }

        const fallbackEmail = authData.user.email;
        if (!fallbackEmail) {
            throw new Error('Signed-in user is missing email, cannot create profile');
        }

        const { error: profileInsertError } = await supabase
            .from('profiles')
            .insert({
                id: payload.user_id,
                email: fallbackEmail,
                full_name: (authData.user.user_metadata?.full_name as string | undefined) ?? null,
                avatar_url: (authData.user.user_metadata?.avatar_url as string | undefined) ?? null,
            });

        if (profileInsertError) {
            console.error('Error auto-creating profile before campaign creation:', profileInsertError);
            throw profileInsertError;
        }
    }

    const { data, error } = await supabase
        .from('campaigns')
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('Error creating campaign:', error);
        normalizeCampaignError(error);
    }

    if (!data) {
        throw new Error('Failed to create campaign');
    }

    return data as Campaign;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching campaign:', error);
        try {
            normalizeCampaignError(error);
        } catch {
            // keep previous behavior for read operations
        }
        return null;
    }

    return data as Campaign | null;
}

export async function getUserCampaigns(userId: string): Promise<Campaign[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching campaigns:', error);
        try {
            normalizeCampaignError(error);
        } catch {
            // keep previous behavior for list operations
        }
        return [];
    }

    return (data || []) as Campaign[];
}

export async function updateCampaign(id: string, updates: CampaignUpdate): Promise<Campaign | null> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating campaign:', error);
        throw error;
    }

    return data as Campaign | null;
}

export async function deleteCampaign(id: string): Promise<boolean> {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting campaign:', error);
        throw error;
    }

    return true;
}

export async function linkProjectToCampaign(payload: CampaignDesignInsert): Promise<CampaignDesign> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('campaign_designs')
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('Error linking project to campaign:', error);
        throw error;
    }

    if (!data) {
        throw new Error('Failed to create campaign design link');
    }

    return data as CampaignDesign;
}

export async function getCampaignDesigns(campaignId: string): Promise<CampaignDesign[]> {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
        .from('campaign_designs')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error fetching campaign designs:', error);
        return [];
    }

    return (data || []) as CampaignDesign[];
}

