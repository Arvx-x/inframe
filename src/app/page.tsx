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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      {/* Canvas fills the background */}
      <Canvas
        generatedImageUrl={generatedImageUrl}
        onClear={handleClear}
        onCanvasCommandRef={canvasCommandRef}
        onCanvasHistoryRef={canvasHistoryRef}
        onHistoryAvailableChange={setHistoryAvailable}
      />

      {/* Floating Prompt Sidebar overlay */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute left-4 top-4 bottom-4 w-[28%] max-w-full">
          <PromptSidebar
            onImageGenerated={handleImageGenerated}
            currentImageUrl={generatedImageUrl}
            onCanvasCommand={handleCanvasCommand}
            onCanvasUndo={() => canvasHistoryRef.current?.undo()}
            onCanvasRedo={() => canvasHistoryRef.current?.redo()}
            showHistoryControls={historyAvailable}
          />
        </div>
      </div>
    </div>
  );
}
