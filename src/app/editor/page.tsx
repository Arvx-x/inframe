'use client';

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { getProject, createProject, updateProject, saveCanvas } from '@/app/lib/services/projects.service';
import { uploadDataURL } from '@/app/lib/services/storage.service';
import { ProjectColorsProvider } from '@/app/contexts/ProjectColorsContext';
import ChatSidebar from "@/app/components/ChatSidebar";
import PromptSidebar from "@/app/components/PromptSidebar";
import Canvas from "@/app/components/Canvas";
import { InspectorSidebar } from "@/app/components/InspectorSidebar";
import ColorSelector from "@/app/components/ColorSelector";
import { Button } from "@/app/components/ui/button";
import { Share, ArrowLeft, PenTool, Image as ImageIcon, Layout, PanelLeftClose, PanelLeft, Menu, Palette, Monitor, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { ProfileDropdown } from "@/app/components/ProfileDropdown";
import { GlobalSearchBar } from "@/app/components/GlobalSearchBar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { toast } from 'sonner';
import Link from 'next/link';
import { FabricImage } from 'fabric';

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
  
  // Studio management
  type StudioType = 'design' | 'vector' | 'pixel' | 'layout' | 'color' | 'screen';
  const allStudios: { type: StudioType; label: string; icon: any }[] = [
    { type: 'design', label: 'Design', icon: Sparkles },
    { type: 'vector', label: 'Vector', icon: PenTool },
    { type: 'pixel', label: 'Pixel', icon: ImageIcon },
    { type: 'layout', label: 'Layout', icon: Layout },
    { type: 'color', label: 'Color', icon: Palette },
    { type: 'screen', label: 'Screen', icon: Monitor },
  ];
  
  const [visibleStudios, setVisibleStudios] = useState<StudioType[]>(['design', 'vector', 'pixel']);
  const [activeStudio, setActiveStudio] = useState<StudioType>('design');
  const [isStudiosCollapsed, setIsStudiosCollapsed] = useState(true);
  
  // Prompt mode management (design vs chat) - controlled from Studios dropdown
  type PromptMode = 'design' | 'chat';
  const [promptMode, setPromptMode] = useState<PromptMode>('design');
  
  const availableStudios = allStudios.filter(studio => !visibleStudios.includes(studio.type));
  
  const handleStudioSwap = (studioToAdd: StudioType, studioToRemove: StudioType) => {
    setVisibleStudios(prev => {
      const newVisible = prev.filter(s => s !== studioToRemove);
      newVisible.push(studioToAdd);
      return newVisible;
    });
    // If we're removing the active studio, switch to the newly added one
    if (activeStudio === studioToRemove) {
      setActiveStudio(studioToAdd);
    }
  };
  
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

  // Render different layouts based on active studio
  const isScreenMode = activeStudio === 'screen';

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

            {/* Studio Selector - Vertical Dropdown */}
            <div className="relative ml-2">
              {/* Active Studio Button - Always visible */}
              <button
                onClick={() => setIsStudiosCollapsed(!isStudiosCollapsed)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] bg-[hsl(var(--sidebar-ring))] text-white shadow-sm cursor-pointer select-none outline-none"
              >
                {(() => {
                  const activeStudioData = allStudios.find(s => s.type === activeStudio);
                  if (!activeStudioData) return null;
                  const Icon = activeStudioData.icon;
                  return (
                    <>
                      <Icon className="w-3.5 h-3.5" />
                      {activeStudioData.label}
                      <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform duration-300 ${!isStudiosCollapsed ? 'rotate-180' : ''}`} />
                    </>
                  );
                })()}
              </button>

              {/* Vertical Dropdown - expands below */}
              <div 
                className={`absolute left-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-border/60 overflow-hidden z-50 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  isStudiosCollapsed 
                    ? 'opacity-0 translate-y-[-8px] pointer-events-none max-h-0' 
                    : 'opacity-100 translate-y-0 max-h-[400px]'
                }`}
              >
                {/* Mode Toggle Section */}
                <div className="px-3 py-2 border-b border-border/40">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Mode</div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => {
                        setPromptMode('design');
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        promptMode === 'design' 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                      }`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21,15 16,10 5,21" />
                      </svg>
                      <span>Design</span>
                      {promptMode === 'design' && <span className="ml-auto text-blue-600">✓</span>}
                    </button>
                    <button
                      onClick={() => {
                        setPromptMode('chat');
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        promptMode === 'chat' 
                          ? 'bg-green-50 text-green-600' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                      }`}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>Chat</span>
                      {promptMode === 'chat' && <span className="ml-auto text-green-600">✓</span>}
                    </button>
                  </div>
                </div>

                {/* Studios section removed from this dropdown */}
              </div>
            </div>
          </div>

          {/* Centered Global Search Bar (anchored to top so it expands downward only) */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1.5 z-[101]">
            <GlobalSearchBar projectName={projectName} />
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
              isLayersOpen={isLeftPanelOpen}
              onLayersOpenChange={setIsLeftPanelOpen}
              onSelectedObjectChange={setSelectedObject}
              onCanvasInstanceChange={setFabricCanvasInstance}
              toolbarLayout="vertical"
            />
          </div>

          {/* PromptSidebar at bottom center - Old Layout */}
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[560px] px-4 pb-4 z-50 pointer-events-none">
            <div className="pointer-events-auto">
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
              onProjectNameUpdate={handleProjectNameUpdate}
              externalMode={promptMode}
              onExternalModeChange={setPromptMode}
            />
            </div>
          </div>

          {/* Right Sidebar - Properties/Styles (only shows when object is selected) */}
          {selectedObject && fabricCanvasInstance && (
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

          {/* Studio Selector - Vertical Dropdown */}
          <div className="relative ml-2">
            {/* Active Studio Button - Always visible */}
            <button
              onClick={() => setIsStudiosCollapsed(!isStudiosCollapsed)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] bg-[hsl(var(--sidebar-ring))] text-white shadow-sm cursor-pointer select-none outline-none"
            >
              {(() => {
                const activeStudioData = allStudios.find(s => s.type === activeStudio);
                if (!activeStudioData) return null;
                const Icon = activeStudioData.icon;
                return (
                  <>
                    <Icon className="w-3.5 h-3.5" />
                    {activeStudioData.label}
                    <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform duration-300 ${!isStudiosCollapsed ? 'rotate-180' : ''}`} />
                  </>
                );
              })()}
            </button>

            {/* Vertical Dropdown - expands below */}
            <div 
              className={`absolute left-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-border/60 overflow-hidden z-50 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                isStudiosCollapsed 
                  ? 'opacity-0 translate-y-[-8px] pointer-events-none max-h-0' 
                  : 'opacity-100 translate-y-0 max-h-[400px]'
              }`}
            >
              {/* Mode Toggle Section */}
              <div className="px-3 py-2 border-b border-border/40">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Mode</div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setPromptMode('design');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      promptMode === 'design' 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21,15 16,10 5,21" />
                    </svg>
                    <span>Design</span>
                    {promptMode === 'design' && <span className="ml-auto text-blue-600">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setPromptMode('chat');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      promptMode === 'chat' 
                        ? 'bg-green-50 text-green-600' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>Chat</span>
                    {promptMode === 'chat' && <span className="ml-auto text-green-600">✓</span>}
                  </button>
                </div>
              </div>

              {/* Studios Section */}
              <div className="px-3 py-2">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Studios</div>
                <div className="flex flex-col gap-1">
                  {visibleStudios.map((studioType, index) => {
                    const studio = allStudios.find(s => s.type === studioType);
                    if (!studio) return null;
                    const Icon = studio.icon;
                    const isActive = studioType === activeStudio;
                    return (
                      <button
                        key={studioType}
                        onClick={() => {
                          setActiveStudio(studioType);
                          setIsStudiosCollapsed(true);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive 
                            ? 'bg-[hsl(var(--sidebar-ring)/0.1)] text-[hsl(var(--sidebar-ring))]' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                        }`}
                        style={{
                          animationDelay: `${index * 30}ms`
                        }}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{studio.label}</span>
                        {isActive && <span className="ml-auto text-[hsl(var(--sidebar-ring))]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add More Studios */}
              {availableStudios.length > 0 && (
                <div className="px-3 py-2 border-t border-border/40">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Add Studio</div>
                  <div className="flex flex-col gap-1">
                    {availableStudios.map((studio) => {
                      const Icon = studio.icon;
                      return (
                        <button
                          key={studio.type}
                          onClick={() => {
                            const studioToRemove = visibleStudios.find(s => s !== activeStudio) || visibleStudios[0];
                            handleStudioSwap(studio.type, studioToRemove);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gray-50 transition-colors"
                        >
                          <Icon className="w-4 h-4" />
                          <span>{studio.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Centered Global Search Bar (anchored to top so it expands downward only) */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1.5 z-[101]">
          <GlobalSearchBar projectName={projectName} />
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
            isLayersOpen={isLeftPanelOpen}
            onLayersOpenChange={setIsLeftPanelOpen}
            onSelectedObjectChange={setSelectedObject}
            onCanvasInstanceChange={setFabricCanvasInstance}
            toolbarLayout="horizontal"
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
