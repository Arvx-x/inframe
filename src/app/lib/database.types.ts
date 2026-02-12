// Database types generated from Supabase schema
// These will be automatically updated when you run: npx supabase gen types typescript --project-id dhjlqskekmadzgvovzbq > src/app/lib/database.types.ts

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string;
                    full_name: string | null;
                    avatar_url: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    email?: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            projects: {
                Row: {
                    id: string;
                    user_id: string;
                    name: string;
                    canvas_data: Json | null;
                    canvas_color: string;
                    thumbnail_url: string | null;
                    brand_kit_id: string | null;
                    format_id: string | null;
                    template_id: string | null;
                    project_type: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    name: string;
                    canvas_data?: Json | null;
                    canvas_color?: string;
                    thumbnail_url?: string | null;
                    brand_kit_id?: string | null;
                    format_id?: string | null;
                    template_id?: string | null;
                    project_type?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    name?: string;
                    canvas_data?: Json | null;
                    canvas_color?: string;
                    thumbnail_url?: string | null;
                    brand_kit_id?: string | null;
                    format_id?: string | null;
                    template_id?: string | null;
                    project_type?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'projects_user_id_fkey';
                        columns: ['user_id'];
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    }
                ];
            };
            brand_kits: {
                Row: {
                    id: string;
                    user_id: string;
                    name: string;
                    logo_url: string | null;
                    colors: Json | null;
                    fonts: Json | null;
                    guidelines_text: string | null;
                    voice_tone: string | null;
                    style_references: Json | null;
                    ai_brand_summary: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    name: string;
                    logo_url?: string | null;
                    colors?: Json | null;
                    fonts?: Json | null;
                    guidelines_text?: string | null;
                    voice_tone?: string | null;
                    style_references?: Json | null;
                    ai_brand_summary?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    name?: string;
                    logo_url?: string | null;
                    colors?: Json | null;
                    fonts?: Json | null;
                    guidelines_text?: string | null;
                    voice_tone?: string | null;
                    style_references?: Json | null;
                    ai_brand_summary?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'brand_kits_user_id_fkey';
                        columns: ['user_id'];
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    }
                ];
            };
            campaigns: {
                Row: {
                    id: string;
                    user_id: string;
                    brand_kit_id: string | null;
                    name: string;
                    description: string | null;
                    status: string;
                    brief: string | null;
                    target_audience: string | null;
                    tags: Json | null;
                    ai_strategy: Json | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    brand_kit_id?: string | null;
                    name: string;
                    description?: string | null;
                    status?: string;
                    brief?: string | null;
                    target_audience?: string | null;
                    tags?: Json | null;
                    ai_strategy?: Json | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    brand_kit_id?: string | null;
                    name?: string;
                    description?: string | null;
                    status?: string;
                    brief?: string | null;
                    target_audience?: string | null;
                    tags?: Json | null;
                    ai_strategy?: Json | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'campaigns_user_id_fkey';
                        columns: ['user_id'];
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'campaigns_brand_kit_id_fkey';
                        columns: ['brand_kit_id'];
                        referencedRelation: 'brand_kits';
                        referencedColumns: ['id'];
                    }
                ];
            };
            design_formats: {
                Row: {
                    id: string;
                    name: string;
                    platform: string;
                    width: number;
                    height: number;
                    unit: string;
                    category: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    platform: string;
                    width: number;
                    height: number;
                    unit?: string;
                    category: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    platform?: string;
                    width?: number;
                    height?: number;
                    unit?: string;
                    category?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            templates: {
                Row: {
                    id: string;
                    user_id: string | null;
                    name: string;
                    category: string;
                    format_key: string;
                    canvas_data: Json | null;
                    thumbnail_url: string | null;
                    tags: Json | null;
                    is_system: boolean;
                    ai_customization_hints: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string | null;
                    name: string;
                    category: string;
                    format_key: string;
                    canvas_data?: Json | null;
                    thumbnail_url?: string | null;
                    tags?: Json | null;
                    is_system?: boolean;
                    ai_customization_hints?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string | null;
                    name?: string;
                    category?: string;
                    format_key?: string;
                    canvas_data?: Json | null;
                    thumbnail_url?: string | null;
                    tags?: Json | null;
                    is_system?: boolean;
                    ai_customization_hints?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'templates_user_id_fkey';
                        columns: ['user_id'];
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    }
                ];
            };
            campaign_designs: {
                Row: {
                    id: string;
                    campaign_id: string;
                    project_id: string;
                    format_id: string | null;
                    sort_order: number | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    campaign_id: string;
                    project_id: string;
                    format_id?: string | null;
                    sort_order?: number | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    campaign_id?: string;
                    project_id?: string;
                    format_id?: string | null;
                    sort_order?: number | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'campaign_designs_campaign_id_fkey';
                        columns: ['campaign_id'];
                        referencedRelation: 'campaigns';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'campaign_designs_project_id_fkey';
                        columns: ['project_id'];
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'campaign_designs_format_id_fkey';
                        columns: ['format_id'];
                        referencedRelation: 'design_formats';
                        referencedColumns: ['id'];
                    }
                ];
            };
            generated_videos: {
                Row: {
                    id: string;
                    project_id: string;
                    campaign_id: string | null;
                    source_image_url: string | null;
                    video_url: string | null;
                    prompt: string | null;
                    duration: number | null;
                    status: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    campaign_id?: string | null;
                    source_image_url?: string | null;
                    video_url?: string | null;
                    prompt?: string | null;
                    duration?: number | null;
                    status?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    campaign_id?: string | null;
                    source_image_url?: string | null;
                    video_url?: string | null;
                    prompt?: string | null;
                    duration?: number | null;
                    status?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'generated_videos_project_id_fkey';
                        columns: ['project_id'];
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'generated_videos_campaign_id_fkey';
                        columns: ['campaign_id'];
                        referencedRelation: 'campaigns';
                        referencedColumns: ['id'];
                    }
                ];
            };
            ai_generation_log: {
                Row: {
                    id: string;
                    user_id: string;
                    campaign_id: string | null;
                    project_id: string | null;
                    brand_kit_id: string | null;
                    action_type: string;
                    input_prompt: string;
                    input_context: Json | null;
                    output_summary: string | null;
                    output_data: Json | null;
                    rating: number | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    campaign_id?: string | null;
                    project_id?: string | null;
                    brand_kit_id?: string | null;
                    action_type: string;
                    input_prompt: string;
                    input_context?: Json | null;
                    output_summary?: string | null;
                    output_data?: Json | null;
                    rating?: number | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    campaign_id?: string | null;
                    project_id?: string | null;
                    brand_kit_id?: string | null;
                    action_type?: string;
                    input_prompt?: string;
                    input_context?: Json | null;
                    output_summary?: string | null;
                    output_data?: Json | null;
                    rating?: number | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'ai_generation_log_user_id_fkey';
                        columns: ['user_id'];
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'ai_generation_log_campaign_id_fkey';
                        columns: ['campaign_id'];
                        referencedRelation: 'campaigns';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'ai_generation_log_project_id_fkey';
                        columns: ['project_id'];
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'ai_generation_log_brand_kit_id_fkey';
                        columns: ['brand_kit_id'];
                        referencedRelation: 'brand_kits';
                        referencedColumns: ['id'];
                    }
                ];
            };
            ops_log: {
                Row: {
                    id: string;
                    project_id: string;
                    user_id: string;
                    operation_type: string;
                    operation_data: Json;
                    sequence_number: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    user_id: string;
                    operation_type: string;
                    operation_data: Json;
                    sequence_number?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    user_id?: string;
                    operation_type?: string;
                    operation_data?: Json;
                    sequence_number?: number;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'ops_log_project_id_fkey';
                        columns: ['project_id'];
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'ops_log_user_id_fkey';
                        columns: ['user_id'];
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    }
                ];
            };
            project_snapshots: {
                Row: {
                    id: string;
                    project_id: string;
                    user_id: string;
                    snapshot_data: Json;
                    snapshot_name: string | null;
                    is_auto: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    user_id: string;
                    snapshot_data: Json;
                    snapshot_name?: string | null;
                    is_auto?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    user_id?: string;
                    snapshot_data?: Json;
                    snapshot_name?: string | null;
                    is_auto?: boolean;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'project_snapshots_project_id_fkey';
                        columns: ['project_id'];
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'project_snapshots_user_id_fkey';
                        columns: ['user_id'];
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    }
                ];
            };
            assets_metadata: {
                Row: {
                    id: string;
                    project_id: string;
                    user_id: string;
                    file_name: string;
                    file_path: string;
                    file_size: number;
                    file_type: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    project_id: string;
                    user_id: string;
                    file_name: string;
                    file_path: string;
                    file_size: number;
                    file_type: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    project_id?: string;
                    user_id?: string;
                    file_name?: string;
                    file_path?: string;
                    file_size?: number;
                    file_type?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'assets_metadata_project_id_fkey';
                        columns: ['project_id'];
                        referencedRelation: 'projects';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'assets_metadata_user_id_fkey';
                        columns: ['user_id'];
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    }
                ];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
    };
}
