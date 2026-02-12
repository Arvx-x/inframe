-- Supabase Database Schema for inFrame
-- Run this in your Supabase SQL Editor

-- ============================================
-- TABLES
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  canvas_data JSONB,
  canvas_color TEXT NOT NULL DEFAULT '#F4F4F6',
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operations log table (for undo/redo and audit)
CREATE TABLE IF NOT EXISTS public.ops_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  operation_type TEXT NOT NULL, -- 'add', 'delete', 'modify', 'move', etc.
  operation_data JSONB NOT NULL,
  sequence_number BIGSERIAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project snapshots table
CREATE TABLE IF NOT EXISTS public.project_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  snapshot_data JSONB NOT NULL,
  snapshot_name TEXT,
  is_auto BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assets metadata table
CREATE TABLE IF NOT EXISTS public.assets_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Brand kits table (brand identity storage)
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  colors JSONB, -- array of HEX strings or color tokens
  fonts JSONB, -- { primary, secondary, body }
  guidelines_text TEXT,
  voice_tone TEXT,
  style_references JSONB, -- uploaded reference images / URLs
  ai_brand_summary TEXT, -- AI-distilled brand essence used for prompt injection
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaigns table (campaign containers)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  brand_kit_id UUID REFERENCES public.brand_kits(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, completed, archived
  brief TEXT, -- AI generation input
  target_audience TEXT,
  tags JSONB,
  ai_strategy JSONB, -- AI-generated strategy, messaging angles, suggested formats
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Design formats table (standard sizes, seeded data)
CREATE TABLE IF NOT EXISTS public.design_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g. "Instagram Post"
  platform TEXT NOT NULL, -- instagram, facebook, twitter, linkedin, youtube, tiktok, print, custom
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'px', -- px, in, cm
  category TEXT NOT NULL, -- social, ad, video, print, web
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Templates table (reusable design templates)
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- social_post, ad, banner, email_header, story, presentation, print
  format_key TEXT NOT NULL, -- logical key that maps to a design format
  canvas_data JSONB,
  thumbnail_url TEXT,
  tags JSONB,
  is_system BOOLEAN NOT NULL DEFAULT false,
  ai_customization_hints TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign designs table (links projects to campaigns + formats)
CREATE TABLE IF NOT EXISTS public.campaign_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  format_id UUID REFERENCES public.design_formats(id) ON DELETE SET NULL,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated videos table (image-to-video outputs)
CREATE TABLE IF NOT EXISTS public.generated_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  source_image_url TEXT,
  video_url TEXT,
  prompt TEXT,
  duration INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, generating, completed, failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI generation log table (AI-native context & memory)
CREATE TABLE IF NOT EXISTS public.ai_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  brand_kit_id UUID REFERENCES public.brand_kits(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- generate_image, generate_video, generate_copy, edit, reformat, suggest
  input_prompt TEXT NOT NULL,
  input_context JSONB,
  output_summary TEXT,
  output_data JSONB,
  rating SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend projects table with campaign/brand/template context
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS brand_kit_id UUID REFERENCES public.brand_kits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS format_id UUID REFERENCES public.design_formats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'design'; -- design or video

-- ============================================
-- INDEXES for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_log_project_id ON public.ops_log(project_id);
CREATE INDEX IF NOT EXISTS idx_ops_log_sequence ON public.ops_log(project_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_snapshots_project_id ON public.project_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON public.project_snapshots(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON public.assets_metadata(project_id);

CREATE INDEX IF NOT EXISTS idx_brand_kits_user_id ON public.brand_kits(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_kit_id ON public.campaigns(brand_kit_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON public.templates(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_designs_campaign_id ON public.campaign_designs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_designs_project_id ON public.campaign_designs(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_videos_project_id ON public.generated_videos(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_videos_campaign_id ON public.generated_videos(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_log_user_id ON public.ai_generation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_log_campaign_id ON public.ai_generation_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_log_project_id ON public.ai_generation_log(project_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Operations log policies
CREATE POLICY "Users can view ops for their projects"
  ON public.ops_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create ops for their projects"
  ON public.ops_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Snapshots policies
CREATE POLICY "Users can view snapshots for their projects"
  ON public.project_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create snapshots for their projects"
  ON public.project_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their snapshots"
  ON public.project_snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- Assets metadata policies
CREATE POLICY "Users can view assets for their projects"
  ON public.assets_metadata FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create assets for their projects"
  ON public.assets_metadata FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their assets"
  ON public.assets_metadata FOR DELETE
  USING (auth.uid() = user_id);

-- Brand kits policies
CREATE POLICY "Users can view their own brand kits"
  ON public.brand_kits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own brand kits"
  ON public.brand_kits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brand kits"
  ON public.brand_kits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brand kits"
  ON public.brand_kits FOR DELETE
  USING (auth.uid() = user_id);

-- Campaigns policies
CREATE POLICY "Users can view their own campaigns"
  ON public.campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON public.campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
  ON public.campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Templates policies
CREATE POLICY "Users can view public and their own templates"
  ON public.templates FOR SELECT
  USING (is_system = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
  ON public.templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON public.templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON public.templates FOR DELETE
  USING (auth.uid() = user_id);

-- Design formats policies (read-only for all authenticated users)
CREATE POLICY "Users can view design formats"
  ON public.design_formats FOR SELECT
  USING (true);

-- Campaign designs policies
CREATE POLICY "Users can view campaign designs for their campaigns"
  ON public.campaign_designs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create campaign designs for their campaigns"
  ON public.campaign_designs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete campaign designs for their campaigns"
  ON public.campaign_designs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND c.user_id = auth.uid()
    )
  );

-- Generated videos policies
CREATE POLICY "Users can view generated videos for their projects"
  ON public.generated_videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create generated videos for their projects"
  ON public.generated_videos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- AI generation log policies
CREATE POLICY "Users can view their own AI generation log"
  ON public.ai_generation_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI generation log"
  ON public.ai_generation_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for projects table
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for brand_kits table
DROP TRIGGER IF EXISTS update_brand_kits_updated_at ON public.brand_kits;
CREATE TRIGGER update_brand_kits_updated_at
  BEFORE UPDATE ON public.brand_kits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for campaigns table
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for templates table
DROP TRIGGER IF EXISTS update_templates_updated_at ON public.templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create storage bucket for user assets (run this in Supabase Storage UI or via SQL)
-- Note: Storage buckets are created via Supabase dashboard or API, not SQL
-- Create a bucket named 'project-assets' with the following RLS policies:

-- For reference, these are the policies to set in Storage:
-- Bucket: project-assets
-- Policy 1: "Users can upload to their own folder"
--   Operation: INSERT
--   Policy: (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1])
-- Policy 2: "Users can view their own files"
--   Operation: SELECT
--   Policy: (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1])
-- Policy 3: "Users can delete their own files"
--   Operation: DELETE
--   Policy: (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1])

-- ============================================
-- COMPLETED
-- ============================================
-- Your database schema is now ready!
-- Next steps:
-- 1. Create the 'project-assets' storage bucket in Supabase dashboard
-- 2. Set up the RLS policies for the storage bucket as noted above
