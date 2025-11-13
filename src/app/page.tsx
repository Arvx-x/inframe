// app/page.tsx
'use client';

import { useState, useRef } from "react";
import PromptSidebar from "@/app/components/PromptSidebar";
import Canvas from "@/app/components/Canvas";
import ColorSelector from "@/app/components/ColorSelector";
import { Button } from "@/app/components/ui/button";
import { Share } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
// Removed resizable panels to allow overlay layout (canvas behind floating sidebar)

export default function Page() {
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isImagePending, setIsImagePending] = useState(false);
  const [pendingRatio, setPendingRatio] = useState<string | null>(null);
  const canvasCommandRef = useRef<((command: string) => Promise<string>) | null>(null);
  const canvasHistoryRef = useRef<{ undo: () => void; redo: () => void } | null>(null);
  const canvasExportRef = useRef<(() => void) | null>(null);
  const canvasColorRef = useRef<((color: string) => void) | null>(null);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [canvasColor, setCanvasColor] = useState("#F4F4F6");

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

  const handleProjectNameUpdate = (name: string) => {
    setProjectName(name);
  };

  const handleCanvasColorChange = (color: string) => {
    setCanvasColor(color);
    if (canvasColorRef.current) {
      canvasColorRef.current(color);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-white border-b border-border z-[100] flex items-center px-4">
        {/* Spacer for centering */}
        <div className="flex-1"></div>
        
        {/* Centered Project Title */}
        <h1 className="text-sm font-medium text-foreground">{projectName}</h1>
        
        {/* Export Button */}
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
          onCanvasColorRef={canvasColorRef}
          initialCanvasColor={canvasColor}
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
