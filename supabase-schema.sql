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

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets_metadata ENABLE ROW LEVEL SECURITY;

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
