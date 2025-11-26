'use client';

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { getProject, createProject, updateProject, saveCanvas } from '@/app/lib/services/projects.service';
import { uploadDataURL } from '@/app/lib/services/storage.service';
import { ProjectColorsProvider } from '@/app/contexts/ProjectColorsContext';
import PromptSidebar from "@/app/components/PromptSidebar";
import Canvas from "@/app/components/Canvas";
import ColorSelector from "@/app/components/ColorSelector";
import { Button } from "@/app/components/ui/button";
import { Share, ArrowLeft, PenTool, Image as ImageIcon, Layout } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { ProfileDropdown } from "@/app/components/ProfileDropdown";
import { toast } from 'sonner';
import Link from 'next/link';

function EditorContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isImagePending, setIsImagePending] = useState(false);
  const [pendingRatio, setPendingRatio] = useState<string | null>(null);
  const canvasCommandRef = useRef<((command: string) => Promise<string>) | null>(null);
  const canvasHistoryRef = useRef<{ undo: () => void; redo: () => void } | null>(null);
  const canvasExportRef = useRef<(() => void) | null>(null);
  const canvasSaveRef = useRef<(() => any) | null>(null);
  const canvasColorRef = useRef<((color: string) => void) | null>(null);
  const canvasInstanceRef = useRef<(() => string | null) | null>(null);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [canvasColor, setCanvasColor] = useState("#F4F4F6");
  const [canvasData, setCanvasData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMode, setActiveMode] = useState<'vector' | 'pixel' | 'layout'>('vector');

  // Load or create project - optimized for instant loading
  // Allow unsigned users to use canvas without saving
  useEffect(() => {
    async function initProject() {
      if (authLoading) return;

      // Set loading to false immediately to show UI (for both signed in and out users)
      setIsLoading(false);

      // If user is not signed in, allow them to use canvas without saving
      if (!user) {
        // Just show the canvas with default settings
        return;
      }

      // User is signed in - load or create project
      try {
        if (projectId) {
          // Load existing - fetch in background, update state when ready
          getProject(projectId).then((project) => {
            if (project) {
              setProjectName(project.name);
              setCanvasColor(project.canvas_color || '#F4F4F6');
              if (project.canvas_data) {
                setCanvasData(project.canvas_data);
              }
            } else {
              toast.error('Project not found');
              // Don't redirect - allow user to continue working
            }
          }).catch((error) => {
            console.error('Error loading project:', error);
            toast.error('Failed to load project');
          });
        } else {
          // Create new project only if user is signed in
          const newProject = await createProject(user.id, 'Untitled Project');
          router.replace(`/editor?project=${newProject.id}`);
        }
      } catch (error) {
        console.error('Error initializing project:', error);
        toast.error('Failed to load project');
        // Don't redirect - allow user to continue working
      }
    }

    initProject();
  }, [projectId, user, authLoading, router]);

  const handleImageGenerated = (imageUrl: string) => {
    setGeneratedImageUrl(imageUrl);
  };

  const handleClear = () => {
    setGeneratedImageUrl(null);
  };

  const handleCanvasCommand = async (command: string): Promise<string> => {
    if (canvasCommandRef.current) {
      return await canvasCommandRef.current(command);
    }
    return "Canvas not ready";
  };

  const handleProjectNameUpdate = async (name: string) => {
    setProjectName(name);
    // Only save if user is signed in and has a project
    if (projectId && user) {
      try {
        await updateProject(projectId, { name });
      } catch (error) {
        console.error('Failed to update project name:', error);
        toast.error('Failed to save project name');
      }
    }
    // For unsigned users, just update the local state (no saving)
  };

  const handleCanvasColorChange = (color: string) => {
    setCanvasColor(color);
    if (canvasColorRef.current) {
      canvasColorRef.current(color);
    }
  };

  const handleBack = () => {
    // Navigate immediately for instant feel
    router.push('/');

    // Save in background (fire-and-forget)
    if (projectId && user) {
      (async () => {
        try {
          const currentCanvasData = canvasSaveRef.current?.();

          // Generate thumbnail if canvas is available
          let thumbnailUrl: string | undefined = undefined;
          if (canvasInstanceRef.current) {
            const thumbnailDataURL = canvasInstanceRef.current();
            if (thumbnailDataURL && currentCanvasData) {
              try {
                const result = await uploadDataURL(
                  user.id,
                  projectId,
                  thumbnailDataURL,
                  `thumbnail-${Date.now()}.png`,
                  'images'
                );
                thumbnailUrl = result.publicUrl;
              } catch (thumbError: any) {
                // Silently fail if bucket doesn't exist or upload fails
                // This allows the app to work even without storage bucket configured
                if (thumbError?.message?.includes('Bucket not found') ||
                  thumbError?.message?.includes('bucket') ||
                  thumbError?.statusCode === 404) {
                  // Bucket not configured - skip thumbnail silently
                } else {
                  console.error('Failed to upload thumbnail:', thumbError);
                }
                // Continue saving even if thumbnail fails
              }
            }
          }

          // Save everything in a single call: name, canvas data, color, and thumbnail
          await updateProject(projectId, {
            name: projectName,
            canvas_data: currentCanvasData || null,
            canvas_color: canvasColor,
            ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
          });
        } catch (error) {
          console.error('Failed to save project:', error);
          // Silent fail - user already navigated away
        }
      })();
    }
  };

  // Only show loading spinner while auth is loading
  // Once auth state is known, show UI immediately (even for unsigned users)
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-white border-b border-border z-[100] flex items-center px-4">
        {/* Left: Back Button (only for signed-in users) */}
        <div className="flex-1 flex items-center gap-4">
          {user && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}

          {/* Mode Selector */}
          <div className="flex items-center bg-gray-100 p-1 rounded-full">
            <button
              onClick={() => setActiveMode('vector')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeMode === 'vector'
                  ? 'bg-[hsl(var(--sidebar-ring))] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              Vector
            </button>
            <button
              onClick={() => setActiveMode('pixel')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeMode === 'pixel'
                  ? 'bg-[hsl(var(--sidebar-ring))] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Pixel
            </button>
            <button
              onClick={() => setActiveMode('layout')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeMode === 'layout'
                  ? 'bg-[hsl(var(--sidebar-ring))] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Layout className="w-3.5 h-3.5" />
              Layout
            </button>
          </div>
        </div>

        {/* Centered Project Title */}
        <h1 className="text-sm font-medium text-foreground absolute left-1/2 -translate-x-1/2">{projectName}</h1>

        {/* Right side controls */}
        <div className="flex-1 flex justify-end gap-2">
          {/* Canvas Color Selector */}
          <ColorSelector
            canvasColor={canvasColor}
            onColorChange={handleCanvasColorChange}
          />

          {/* Export Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => canvasExportRef.current?.()}
                  className="h-9 px-3 rounded-lg flex items-center gap-2 text-white bg-[hsl(var(--sidebar-ring))] hover:bg-[hsl(var(--sidebar-ring))]/90 transition-colors"
                  aria-label="Export"
                >
                  <Share className="w-4 h-4" />
                  <span className="text-sm font-normal">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Export Canvas</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Profile Dropdown */}
          <ProfileDropdown />
        </div>
      </div>
      {/* Canvas fills the background below header */}
      <div className="absolute top-12 left-0 right-0 bottom-0">
        <Canvas
          generatedImageUrl={generatedImageUrl}
          isImagePending={isImagePending}
          pendingImageRatio={pendingRatio}
          onClear={handleClear}
          onCanvasCommandRef={canvasCommandRef}
          onCanvasHistoryRef={canvasHistoryRef}
          onHistoryAvailableChange={setHistoryAvailable}
          onCanvasExportRef={canvasExportRef}
          onCanvasSaveRef={canvasSaveRef}
          onCanvasColorRef={canvasColorRef}
          onCanvasInstanceRef={canvasInstanceRef}
          initialCanvasColor={canvasColor}
          initialCanvasData={canvasData}
        />
      </div>

      {/* Floating Chat Composer overlay at center-bottom */}
      <div className="pointer-events-none fixed inset-0 z-10 overflow-visible">
        <div className="pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2 w-[40%] max-w-[600px] overflow-visible">
          <PromptSidebar
            onImageGenerated={handleImageGenerated}
            onImageGenerationPending={(pending, options) => {
              setIsImagePending(pending);
              if (pending && options?.ratio) {
                setPendingRatio(options.ratio);
              }
              if (!pending) {
                setPendingRatio(null);
              }
            }}
            currentImageUrl={generatedImageUrl}
            onCanvasCommand={handleCanvasCommand}
            onCanvasUndo={() => canvasHistoryRef.current?.undo()}
            onCanvasRedo={() => canvasHistoryRef.current?.redo()}
            showHistoryControls={historyAvailable}
            onProjectNameUpdate={handleProjectNameUpdate}
          />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <ProjectColorsProvider>
        <EditorContent />
      </ProjectColorsProvider>
    </Suspense>
  );
}
