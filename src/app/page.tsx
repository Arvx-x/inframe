// app/page.tsx
'use client';

import { useState, useRef } from "react";
import PromptSidebar from "@/app/components/PromptSidebar";
import Canvas from "@/app/components/Canvas";
// Removed resizable panels to allow overlay layout (canvas behind floating sidebar)

export default function Page() {
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const canvasCommandRef = useRef<((command: string) => Promise<string>) | null>(null);
  const canvasHistoryRef = useRef<{ undo: () => void; redo: () => void } | null>(null);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");

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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-white border-b border-border z-[100] flex items-center justify-center">
        <h1 className="text-sm font-medium text-foreground">{projectName}</h1>
      </div>
      {/* Canvas fills the background below header */}
      <div className="absolute top-12 left-0 right-0 bottom-0">
        <Canvas
          generatedImageUrl={generatedImageUrl}
          onClear={handleClear}
          onCanvasCommandRef={canvasCommandRef}
          onCanvasHistoryRef={canvasHistoryRef}
          onHistoryAvailableChange={setHistoryAvailable}
        />
      </div>

      {/* Floating Chat Composer overlay at center-bottom */}
      <div className="pointer-events-none fixed inset-0 z-10 overflow-visible">
        <div className="pointer-events-auto fixed bottom-6 left-1/2 -translate-x-1/2 w-[40%] max-w-[600px] overflow-visible">
          <PromptSidebar
            onImageGenerated={handleImageGenerated}
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
