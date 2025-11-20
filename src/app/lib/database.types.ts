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
