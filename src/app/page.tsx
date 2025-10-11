// app/page.tsx
'use client';

import { useState, useRef } from "react";
import PromptSidebar from "@/app/components/PromptSidebar";
import Canvas from "@/app/components/Canvas";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/app/components/ui/resizable";

export default function Page() {
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const canvasCommandRef = useRef<((command: string) => Promise<string>) | null>(null);

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
    <div className="w-full h-screen overflow-hidden bg-white">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={28} minSize={20} maxSize={40}>
          <PromptSidebar
            onImageGenerated={handleImageGenerated}
            currentImageUrl={generatedImageUrl}
            onCanvasCommand={handleCanvasCommand}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={72} minSize={60}>
          <Canvas
            generatedImageUrl={generatedImageUrl}
            onClear={handleClear}
            onCanvasCommandRef={canvasCommandRef}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
