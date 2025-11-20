# Supabase Setup Guide for inFrame

This guide will walk you through setting up your Supabase backend for the inFrame application.

## ✅ What's Been Done

- ✅ Supabase client utilities installed and configured
- ✅ Authentication system fully implemented
- ✅ User profile management setup
- ✅ Project CRUD operations ready
- ✅ Asset storage service implemented
- ✅ Operations log for undo/audit trail
- ✅ Project snapshots with auto-save
- ✅ Auto-snapshot system (saves every 5 minutes)

## 📋 Setup Steps

### 1. Environment Variables

Add these to your `.env.local` file (create it if it doesn't exist):

```env
NEXT_PUBLIC_SUPABASE_URL=https://dhjlqskekmadzgvovzbq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoamxxc2tla21hZHpndm92emJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NTYwNDcsImV4cCI6MjA3OTIzMjA0N30.GLXBvZs1FhjTWAyPtxiZ_nw-7JGCgB5nEv0GVElOZWc
```

### 2. Database Schema

1. Go to your Supabase dashboard: https://dhjlqskekmadzgvovzbq.supabase.co
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the entire contents of `supabase-schema.sql` from the project root
5. Click "Run" or press Ctrl+Enter

This will create:
- **profiles** table (user profiles with email, name, avatar)
- **projects** table (user projects with canvas data)
- **ops_log** table (operation history for undo/audit)
- **project_snapshots** table (version snapshots)
- **assets_metadata** table (file metadata tracking)
- All necessary indexes for performance
- Row Level Security (RLS) policies for data protection
- Triggers for automatic profile creation on signup

### 3. Storage Bucket Setup

1. In Supabase dashboard, go to "Storage" in the left sidebar
2. Click "Create a new bucket"
3. Name it `project-assets`
4. Make it **Public** (we'll use RLS policies for security)
5. Click "Create bucket"

#### Set Storage Policies

After creating the bucket, click on it and go to "Policies":

1. **SELECT policy** (Users can view their own files):
   ```sql
   (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1])
   ```

2. **INSERT policy** (Users can upload to their own folder):
   ```sql
   (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1])
   ```

3. **DELETE policy** (Users can delete their own files):
   ```sql
   (bucket_id = 'project-assets' AND auth.uid()::text = (storage.foldername(name))[1])
   ```

### 4. Email Configuration (Optional but Recommended)

For production use, configure email authentication:

1. Go to "Authentication" → "Providers" in Supabase dashboard
2. Enable "Email" provider
3. Configure SMTP settings or use Supabase's default email service
4. Customize email templates under "Email Templates"

### 5. Google OAuth Setup (Optional but Recommended)

To enable "Continue with Google" button:

1. Go to "Authentication" → "Providers" in Supabase dashboard
2. Enable "Google" provider
3. You'll need to create OAuth credentials in Google Cloud Console:
   - Go to https://console.cloud.google.com
   - Create a new project or select existing
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: Add `https://dhjlqskekmadzgvovzbq.supabase.co/auth/v1/callback`
   - Copy the Client ID and Client Secret
4. Paste Client ID and Client Secret in Supabase Google provider settings
5. Save the configuration

**Note:** Google OAuth is already integrated in the code! Just enable it in Supabase dashboard.

## 🚀 How It Works

### Authentication
- Users can sign up with email/password
- Profile is automatically created on signup via database trigger
- Session persists across page reloads
- Sign in/out available in header via ProfileDropdown

### Projects
- Authenticated users get an auto-created project on first load
- Projects auto-save 2 seconds after any canvas change
- Switch between projects using the dropdown in the header
- Create new projects with the "New Project" button

### Auto-Save
- Canvas changes are automatically debounced and saved every 2 seconds
- Canvas color changes also trigger auto-save
- No manual save button needed!

### Snapshots
- Automatic snapshots created every 5 minutes (configurable)
- Only keeps 10 most recent auto-snapshots per project
- Manual snapshots can be created (UI to be added)

### Operations Log
- Every canvas operation is logged for audit trail
- Can be used for persistent undo/redo across sessions
- Useful for debugging and rollback

## 🔧 File Structure

```
src/app/
├── lib/
│   ├── supabase-client.ts       # Browser-side client
│   ├── supabase-server.ts       # Server-side client
│   ├── database.types.ts        # TypeScript types
│   ├── auth-helpers.ts          # Auth functions
│   └── services/
│       ├── profiles.service.ts   # Profile CRUD
│       ├── projects.service.ts   # Project CRUD
│       ├── storage.service.ts    # Asset upload/delete
│       ├── ops-log.service.ts    # Operation logging
│       └── snapshots.service.ts  # Snapshot management
├── providers/
│   ├── AuthProvider.tsx         # Auth context
│   └── Providers.tsx            # All providers
├── components/
│   ├── AuthModal.tsx            # Sign in/up modal
│   ├── ProfileDropdown.tsx      # User menu
│   └── ProjectSelector.tsx      # Project switcher
├── hooks/
│   ├── useProject.ts            # Project state management
│   └── useAutoSnapshot.ts       # Auto-snapshot logic
└── auth/
    └── callback/
        └── route.ts             # OAuth callback handler
middleware.ts                     # Auth session refresh
supabase-schema.sql              # Database schema
```

## 🎯 Next Steps

1. Run the database migration (copy supabase-schema.sql to SQL Editor)
2. Create the storage bucket with policies
3. Start the dev server: `npm run dev`
4. Sign up for an account
5. Start creating! Your work will auto-save

## 🐛 Troubleshooting

### "Cannot connect to Supabase"
- Check that environment variables are set correctly in `.env.local`
- Restart the dev server after adding environment variables

### "Failed to create profile"
- Make sure you ran the full database schema SQL
- Check that the profile trigger is created in Supabase

### "Storage upload failed"
- Verify the `project-assets` bucket exists
- Check that storage policies are configured correctly

### "Auto-save not working"
- Make sure you're signed in
- Check browser console for errors
- Verify project was created successfully

## 📚 API Reference

All services are located in `src/app/lib/services/` and are fully typed with TypeScript.

Example usage:
```typescript
import { createProject, updateProject } from '@/app/lib/services/projects.service';
import { uploadAsset } from '@/app/lib/services/storage.service';
import { createSnapshot } from '@/app/lib/services/snapshots.service';
```

## 🔐 Security Notes

- All tables have Row Level Security (RLS) enabled
- Users can only access their own data
- Storage policies ensure users can only access their own files
- Auth middleware refreshes sessions automatically
- Passwords are hashed by Supabase Auth

---

**Need help?** Check the Supabase docs at https://supabase.com/docs
