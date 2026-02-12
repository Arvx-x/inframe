'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { getProject, createProject, updateProject } from '@/app/lib/services/projects.service';
import { uploadDataURL } from '@/app/lib/services/storage.service';
import { ProjectColorsProvider } from '@/app/contexts/ProjectColorsContext';
import ChatSidebar from "@/app/components/ChatSidebar";
import Canvas from "@/app/components/Canvas";
import { InspectorSidebar } from "@/app/components/InspectorSidebar";
import ColorSelector from "@/app/components/ColorSelector";
import { Button } from "@/app/components/ui/button";
import { Share, ArrowLeft, PanelLeftClose, PanelLeft, Sparkles, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { ProfileDropdown } from "@/app/components/ProfileDropdown";
import { AIPanel } from "@/app/components/AIPanel";
import { FormatBar } from "@/app/components/FormatBar";
import { getCampaign } from "@/app/lib/services/campaigns.service";
import { getBrandKit } from "@/app/lib/services/brand-kit.service";
import type { Campaign } from "@/app/lib/services/campaigns.service";
import type { BrandKit } from "@/app/lib/services/brand-kit.service";
import type { DesignFormat } from "@/app/lib/services/formats.service";
import { toast } from 'sonner';
import { FabricImage } from 'fabric';

function EditorContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  const campaignIdParam = searchParams.get('campaign');
  const templateIdParam = searchParams.get('template');
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Campaign & brand context for AI
  const [campaignContext, setCampaignContext] = useState<Campaign | null>(null);
  const [brandKitContext, setBrandKitContext] = useState<BrandKit | null>(null);
  const [activeFormat, setActiveFormat] = useState<DesignFormat | null>(null);

  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isImagePending, setIsImagePending] = useState(false);
  const [pendingRatio, setPendingRatio] = useState<string | null>(null);
  type CanvasNodesApi = {
    addInputNode: () => void;
    addImageInputNode: () => void;
    addTextImageInputNode: () => void;
    addToolNode: (kind: string) => void;
    connectSelectedNodes: () => void;
    runSelectedTools: () => void;
  };
  const canvasCommandRef = useRef<((command: string) => Promise<string>) | null>(null);
  const canvasHistoryRef = useRef<{ undo: () => void; redo: () => void } | null>(null);
  const canvasExportRef = useRef<(() => void) | null>(null);
  const canvasSaveRef = useRef<(() => any) | null>(null);
  const canvasColorRef = useRef<((color: string) => void) | null>(null);
  const canvasInstanceRef = useRef<(() => string | null) | null>(null);
  const canvasNodesRef = useRef<CanvasNodesApi | null>(null);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [canvasColor, setCanvasColor] = useState("#F4F4F6");
  const [designCanvasData, setDesignCanvasData] = useState<any>(null);
  const [planCanvasData, setPlanCanvasData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Studio management
  type StudioType = 'design' | 'plan' | 'screen';
  const [activeStudio, setActiveStudio] = useState<StudioType>('design');
  
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [fabricCanvasInstance, setFabricCanvasInstance] = useState<any>(null);

  // New layout state - layers panel closed by default for non-screen modes
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  
  // Update layers panel state when studio changes
  useEffect(() => {
    if (activeStudio === 'screen') {
      setIsLeftPanelOpen(true);
    } else {
      setIsLeftPanelOpen(false);
    }
  }, [activeStudio]);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(300);

  const switchStudio = (nextStudio: StudioType) => {
    if (canvasSaveRef.current) {
      const currentData = canvasSaveRef.current();
      if (activeStudio === 'plan') {
        setPlanCanvasData(currentData);
      } else {
        setDesignCanvasData(currentData);
      }
    }
    // Clear selection and Design-only AI outputs so they don't leak into the other mode
    setSelectedObject(null);
    setGeneratedImageUrl(null);
    setGeneratedVideoUrl(null);
    setActiveStudio(nextStudio);
  };

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
                setDesignCanvasData(project.canvas_data);
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

  // Load campaign and brand kit context when campaign param is present
  useEffect(() => {
    async function loadCampaignContext() {
      if (!campaignIdParam) return;
      try {
        const campaign = await getCampaign(campaignIdParam);
        if (campaign) {
          setCampaignContext(campaign);
          if (campaign.brand_kit_id) {
            const kit = await getBrandKit(campaign.brand_kit_id);
            if (kit) setBrandKitContext(kit);
          }
        }
      } catch {
        // silent - context is optional enhancement
      }
    }
    loadCampaignContext();
  }, [campaignIdParam]);

  const handleImageGenerated = (imageUrl: string) => {
    setGeneratedImageUrl(imageUrl);
  };

  const handleVideoGenerated = (videoUrl: string) => {
    setGeneratedVideoUrl(videoUrl);
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

  const getSelectedImageSnapshot = useCallback(() => {
    if (!fabricCanvasInstance || !selectedObject || !(selectedObject instanceof FabricImage)) return null;
    const image = selectedObject as FabricImage;
    const bounds = image.getBoundingRect();
    return fabricCanvasInstance.toDataURL({
      format: 'png',
      quality: 1,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });
  }, [fabricCanvasInstance, selectedObject]);

  const handleImageEdit = (newImageUrl: string) => {
    if (!fabricCanvasInstance || !selectedObject) return;

    // Only handle image editing if the selected object is an image
    if (!(selectedObject instanceof FabricImage)) return;

    const originalImage = selectedObject as FabricImage;

    FabricImage.fromURL(newImageUrl, {
      crossOrigin: 'anonymous'
    }).then((img) => {
      // Preserve position, scale, and other properties from the original image
      img.set({
        left: originalImage.left,
        top: originalImage.top,
        scaleX: originalImage.scaleX,
        scaleY: originalImage.scaleY,
        angle: originalImage.angle,
        opacity: originalImage.opacity,
        selectable: true,
      });

      // Remove old image and add new one
      fabricCanvasInstance.remove(originalImage);
      fabricCanvasInstance.add(img);
      fabricCanvasInstance.setActiveObject(img);
      fabricCanvasInstance.renderAll();

      // Update selected object so sidebar stays open
      setSelectedObject(img);
    }).catch((error) => {
      console.error("Error loading edited image:", error);
      toast.error("Failed to load edited image");
    });
  };

  const handleBack = () => {
    // Navigate immediately for instant feel
    router.push('/');

    // Save in background (fire-and-forget)
    if (projectId && user) {
      (async () => {
        try {
          let currentCanvasData: any = null;
          if (activeStudio === 'design') {
            currentCanvasData = canvasSaveRef.current?.() ?? designCanvasData;
          } else {
            currentCanvasData = designCanvasData;
          }

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

  // Render different layouts based on active studio
  const isScreenMode = activeStudio === 'screen';
  const isPlanMode = activeStudio === 'plan';

  // Old layout for non-screen studios
  if (!isScreenMode) {
    return (
      <div className="relative w-full h-screen overflow-hidden bg-white">
        {/* Header - Old Layout (with studio selector) */}
        <div className="fixed top-0 left-0 right-0 h-[52px] bg-white border-b border-border z-[100] flex items-center px-4">
          {/* Left: Back Button and Layers Toggle */}
          <div className="flex-1 flex items-center gap-2">
            {/* Layers Panel Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
              title={isLeftPanelOpen ? "Hide Layers" : "Show Layers"}
            >
              {isLeftPanelOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>

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

            {/* Studio Toggle */}
            <div className="ml-2 inline-flex items-center rounded-full border border-border/60 bg-white p-0.5 shadow-sm">
              <button
                onClick={() => switchStudio('design')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !isPlanMode
                ? 'bg-[hsl(var(--sidebar-ring))] text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Design
              </button>
              <button
                onClick={() => switchStudio('plan')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isPlanMode
                ? 'bg-[hsl(var(--sidebar-ring))] text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Plan
              </button>
            </div>

            {/* Format Bar (design mode only) */}
            {!isPlanMode && (
              <FormatBar
                activeFormat={activeFormat}
                onFormatChange={setActiveFormat}
                className="ml-2"
              />
            )}
          </div>

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

        {/* Main Content Area - below header */}
        <div className="absolute top-[52px] left-0 right-0 bottom-0 flex">
          {/* Canvas Area - takes remaining space */}
          <div className="flex-1 relative">
            <Canvas
              key={`canvas-${activeStudio}`}
              generatedImageUrl={isPlanMode ? null : generatedImageUrl}
              generatedVideoUrl={isPlanMode ? null : generatedVideoUrl}
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
              onCanvasNodesRef={canvasNodesRef}
              initialCanvasColor={canvasColor}
              initialCanvasData={isPlanMode ? planCanvasData : designCanvasData}
              isLayersOpen={isPlanMode ? false : isLeftPanelOpen}
              onLayersOpenChange={isPlanMode ? undefined : setIsLeftPanelOpen}
              onSelectedObjectChange={setSelectedObject}
              onCanvasInstanceChange={setFabricCanvasInstance}
              onCanvasDataChange={(data) => {
                if (isPlanMode) setPlanCanvasData(data);
                else setDesignCanvasData(data);
              }}
              toolbarLayout="vertical"
              toolbarMode={isPlanMode ? 'plan' : 'default'}
              showLayersPanel={!isPlanMode}
              backgroundStyle={isPlanMode ? 'grid' : 'plain'}
            />
          </div>

          {/* AI Panel at bottom center - Design Mode */}
          {!isPlanMode && (
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] px-4 pb-4 z-50 pointer-events-none">
              <div className="pointer-events-auto">
                <AIPanel
                  onCanvasCommand={handleCanvasCommand}
                  onImageGenerated={handleImageGenerated}
                  onVideoGenerated={handleVideoGenerated}
                  onImageGenerationPending={(pending, options) => {
                    setIsImagePending(pending);
                    if (pending && options?.ratio) setPendingRatio(options.ratio);
                    if (!pending) setPendingRatio(null);
                  }}
                  getCanvasSnapshot={() => canvasInstanceRef.current?.() ?? null}
                  getSelectedImageSnapshot={getSelectedImageSnapshot}
                  campaignBrief={campaignContext?.brief}
                  brandSummary={brandKitContext?.ai_brand_summary}
                  formatLabel={activeFormat ? `${activeFormat.name} (${activeFormat.width}x${activeFormat.height})` : null}
                  formatDimensions={activeFormat ? { width: activeFormat.width, height: activeFormat.height } : null}
                />
              </div>
            </div>
          )}

          {/* Right Sidebar - Properties/Styles (only shows when object is selected) */}
          {!isPlanMode && selectedObject && fabricCanvasInstance && (
            <InspectorSidebar
              selectedObject={selectedObject}
              canvas={fabricCanvasInstance}
              onClose={() => {
                if (fabricCanvasInstance) {
                  fabricCanvasInstance.discardActiveObject();
                  fabricCanvasInstance.requestRenderAll();
                }
                setSelectedObject(null);
              }}
              isClosing={false}
              onImageEdit={handleImageEdit}
              onEnterPathEditMode={() => {}}
              onExitPathEditMode={() => {}}
              onCanvasCommand={handleCanvasCommand}
            />
          )}

          {/* Right Sidebar - Chat (Plan mode) */}
          {isPlanMode && (
            <div className="absolute right-0 top-[58px] -bottom-12 flex" style={{ width: rightSidebarWidth }}>
              <ChatSidebar
                width={rightSidebarWidth}
                onWidthChange={setRightSidebarWidth}
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
                onProjectNameUpdate={handleProjectNameUpdate}
                selectedObject={selectedObject}
                fabricCanvas={fabricCanvasInstance}
                onAddInputNode={() => canvasNodesRef.current?.addInputNode()}
                onAddToolNode={(kind) => canvasNodesRef.current?.addToolNode(kind)}
                onConnectNodes={() => canvasNodesRef.current?.connectSelectedNodes()}
                onRunTools={() => canvasNodesRef.current?.runSelectedTools()}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Current layout for screen mode (with studio selector)
  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      {/* Header - Current Layout (with studio selector) */}
      <div className="fixed top-0 left-0 right-0 h-[52px] bg-white border-b border-border z-[100] flex items-center px-4">
        {/* Left: Back Button and Layers Toggle */}
        <div className="flex-1 flex items-center gap-2">
          {/* Layers Panel Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            title={isLeftPanelOpen ? "Hide Layers" : "Show Layers"}
          >
            {isLeftPanelOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </Button>

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

          {/* Studio Toggle */}
          <div className="ml-2 inline-flex items-center rounded-full border border-border/60 bg-white p-0.5 shadow-sm">
            <button
              onClick={() => switchStudio('design')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !isPlanMode
                  ? 'bg-[hsl(var(--sidebar-ring))] text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Design
            </button>
            <button
              onClick={() => switchStudio('plan')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isPlanMode
                  ? 'bg-[hsl(var(--sidebar-ring))] text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Plan
            </button>
          </div>
        </div>

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

      {/* Main Content Area - below header */}
      <div className="absolute top-[52px] left-0 right-0 bottom-0 flex">
        {/* Canvas Area - takes remaining space */}
        <div className="flex-1 relative">
          <Canvas
            key={`canvas-${activeStudio}`}
            generatedImageUrl={isPlanMode ? null : generatedImageUrl}
            generatedVideoUrl={isPlanMode ? null : generatedVideoUrl}
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
            onCanvasNodesRef={canvasNodesRef}
            initialCanvasColor={canvasColor}
            initialCanvasData={isPlanMode ? planCanvasData : designCanvasData}
            isLayersOpen={isPlanMode ? false : isLeftPanelOpen}
            onLayersOpenChange={isPlanMode ? undefined : setIsLeftPanelOpen}
            onSelectedObjectChange={setSelectedObject}
            onCanvasInstanceChange={setFabricCanvasInstance}
            onCanvasDataChange={(data) => {
              if (isPlanMode) setPlanCanvasData(data);
              else setDesignCanvasData(data);
            }}
            toolbarLayout="horizontal"
            toolbarMode={isPlanMode ? 'plan' : 'default'}
            showLayersPanel={!isPlanMode}
            backgroundStyle={isPlanMode ? 'grid' : 'plain'}
          />
        </div>

        {/* Right Sidebar - Chat */}
        <div className="absolute right-0 top-[58px] -bottom-12">
          <ChatSidebar
            width={rightSidebarWidth}
            onWidthChange={setRightSidebarWidth}
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
            onProjectNameUpdate={handleProjectNameUpdate}
            selectedObject={selectedObject}
            fabricCanvas={fabricCanvasInstance}
            onAddInputNode={() => canvasNodesRef.current?.addInputNode()}
            onAddToolNode={(kind) => canvasNodesRef.current?.addToolNode(kind)}
            onConnectNodes={() => canvasNodesRef.current?.connectSelectedNodes()}
            onRunTools={() => canvasNodesRef.current?.runSelectedTools()}
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
