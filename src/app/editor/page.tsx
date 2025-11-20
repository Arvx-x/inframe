'use client';

import { useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { getProject, createProject, updateProject, saveCanvas } from '@/app/lib/services/projects.service';
import PromptSidebar from "@/app/components/PromptSidebar";
import Canvas from "@/app/components/Canvas";
import ColorSelector from "@/app/components/ColorSelector";
import { Button } from "@/app/components/ui/button";
import { Share, ArrowLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { ProfileDropdown } from "@/app/components/ProfileDropdown";
import { toast } from 'sonner';
import Link from 'next/link';

export default function Page() {
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
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [canvasColor, setCanvasColor] = useState("#F4F4F6");
  const [canvasData, setCanvasData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load or create project
  useEffect(() => {
    async function initProject() {
      if (authLoading) return;

      if (!user) {
        // Redirect to login if not authenticated (handled by AuthProvider usually, but safe to check)
        return;
      }

      try {
        if (projectId) {
          // Load existing
          const project = await getProject(projectId);
          if (project) {
            setProjectName(project.name);
            setCanvasColor(project.canvas_color || '#F4F4F6');
            if (project.canvas_data) {
              setCanvasData(project.canvas_data);
            }
          } else {
            toast.error('Project not found');
            router.push('/');
          }
        } else {
          // Create new
          const newProject = await createProject(user.id, 'Untitled Project');
          router.replace(`/editor?project=${newProject.id}`);
          // Defaults are already set
        }
      } catch (error) {
        console.error('Error initializing project:', error);
        toast.error('Failed to load project');
        router.push('/');
      } finally {
        setIsLoading(false);
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
    if (projectId) {
      try {
        await updateProject(projectId, { name });
      } catch (error) {
        console.error('Failed to update project name:', error);
        toast.error('Failed to save project name');
      }
    }
  };

  const handleCanvasColorChange = (color: string) => {
    setCanvasColor(color);
    if (canvasColorRef.current) {
      canvasColorRef.current(color);
    }
  };

  const handleBack = async () => {
    if (projectId && canvasSaveRef.current) {
      try {
        const currentCanvasData = canvasSaveRef.current();
        if (currentCanvasData) {
          await saveCanvas(projectId, currentCanvasData, canvasColor);
          toast.success('Project saved');
        }
      } catch (error) {
        console.error('Failed to save project:', error);
        // Don't block navigation on error, but show toast
        toast.error('Failed to save project');
      }
    }
    router.push('/');
  };

  if (authLoading || isLoading) {
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
        {/* Left: Back Button */}
        <div className="flex-1 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Centered Project Title */}
        <h1 className="text-sm font-medium text-foreground">{projectName}</h1>

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
