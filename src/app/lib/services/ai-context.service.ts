import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../database.types';

type BrandKitRow = Database['public']['Tables']['brand_kits']['Row'];
type CampaignRow = Database['public']['Tables']['campaigns']['Row'];
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type AIGenerationLogRow = Database['public']['Tables']['ai_generation_log']['Row'];

export interface BrandKitContext {
    id: string;
    name: string;
    logoUrl: string | null;
    colors: string[] | null;
    fonts: Json | null;
    guidelinesText: string | null;
    voiceTone: string | null;
    styleReferences: Json | null;
    aiBrandSummary: string | null;
}

export interface CampaignContext {
    id: string;
    name: string;
    description: string | null;
    status: string;
    brief: string | null;
    targetAudience: string | null;
    tags: Json | null;
    aiStrategy: Json | null;
}

export interface FormatContext {
    id: string | null;
    name: string | null;
    platform: string | null;
    width: number | null;
    height: number | null;
    unit: string | null;
    category: string | null;
}

export interface CanvasStateSummary {
    projectId: string;
    projectName: string;
    projectType: string;
    hasCanvasData: boolean;
}

export interface HistoryContextEntry {
    id: string;
    actionType: string;
    inputPrompt: string;
    outputSummary: string | null;
    createdAt: string;
}

export interface AIContext {
    brandKit?: BrandKitContext;
    campaign?: CampaignContext;
    format?: FormatContext;
    canvasState?: CanvasStateSummary;
    history?: {
        recentGenerations: HistoryContextEntry[];
    };
}

export interface BuildAIContextParams {
    userId: string;
    campaignId?: string | null;
    projectId?: string | null;
    brandKitId?: string | null;
    historyLimit?: number;
}

export async function buildAIContext(
    supabase: SupabaseClient<Database>,
    params: BuildAIContextParams
): Promise<AIContext> {
    const { userId, campaignId, projectId, brandKitId, historyLimit = 10 } = params;

    const context: AIContext = {};

    let campaign: CampaignRow | null = null;
    let project: ProjectRow | null = null;
    let brandKit: BrandKitRow | null = null;

    // Fetch campaign if specified
    if (campaignId) {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (!error && data) {
            campaign = data as CampaignRow;
        }
    }

    // Fetch project if specified
    if (projectId) {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (!error && data) {
            project = data as ProjectRow;
        }
    }

    // Determine brand kit: explicit param, campaign.brand_kit_id, or project.brand_kit_id
    const effectiveBrandKitId =
        brandKitId ??
        campaign?.brand_kit_id ??
        project?.brand_kit_id ??
        null;

    if (effectiveBrandKitId) {
        const { data, error } = await supabase
            .from('brand_kits')
            .select('*')
            .eq('id', effectiveBrandKitId)
            .single();

        if (!error && data) {
            brandKit = data as BrandKitRow;
        }
    }

    // Map brand kit context
    if (brandKit) {
        context.brandKit = {
            id: brandKit.id,
            name: brandKit.name,
            logoUrl: brandKit.logo_url,
            colors: (brandKit.colors as string[] | null) ?? null,
            fonts: brandKit.fonts,
            guidelinesText: brandKit.guidelines_text,
            voiceTone: brandKit.voice_tone,
            styleReferences: brandKit.style_references,
            aiBrandSummary: brandKit.ai_brand_summary,
        };
    }

    // Map campaign context
    if (campaign) {
        context.campaign = {
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            status: campaign.status,
            brief: campaign.brief,
            targetAudience: campaign.target_audience,
            tags: campaign.tags,
            aiStrategy: campaign.ai_strategy,
        };
    }

    // Map format context (if project linked to a format)
    if (project?.format_id) {
        const { data: formatData, error } = await supabase
            .from('design_formats')
            .select('*')
            .eq('id', project.format_id)
            .single();

        if (!error && formatData) {
            const format = formatData as Database['public']['Tables']['design_formats']['Row'];
            context.format = {
                id: format.id,
                name: format.name,
                platform: format.platform,
                width: format.width,
                height: format.height,
                unit: format.unit,
                category: format.category,
            };
        }
    }

    // Canvas state summary (we intentionally don't pull full canvas_data here to keep prompts small)
    if (project) {
        context.canvasState = {
            projectId: project.id,
            projectName: project.name,
            projectType: project.project_type,
            hasCanvasData: project.canvas_data != null,
        };
    }

    // Recent AI history for this user (optionally scoped to campaign/project)
    const historyQuery = supabase
        .from('ai_generation_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(historyLimit);

    const { data: historyRows, error: historyError } =
        await historyQuery;

    if (!historyError && historyRows) {
        const mappedHistory: HistoryContextEntry[] = (historyRows as AIGenerationLogRow[]).map(
            (row) => ({
                id: row.id,
                actionType: row.action_type,
                inputPrompt: row.input_prompt,
                outputSummary: row.output_summary,
                createdAt: row.created_at,
            })
        );

        context.history = {
            recentGenerations: mappedHistory,
        };
    }

    return context;
}

