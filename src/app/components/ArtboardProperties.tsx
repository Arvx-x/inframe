import { useState, useEffect } from "react";
import { 
  Sparkles, Loader2, Wand2, Brain, ChevronDown, ChevronUp, 
  Move, Maximize, RotateCw, Eye, EyeOff, Layers, Grid3x3, X, Plus, Link, Box, Minus
} from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { FabricObject, Rect as FabricRect, Pattern } from "fabric";
import { toast } from "sonner";
import { ArtboardEditSpace } from "@/app/components/ArtboardEditSpace";

interface ArtboardPropertiesData {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
}

interface ArtboardPropertiesProps {
  selectedObject: FabricObject | null;
  canvas: any;
  properties: ArtboardPropertiesData;
  updateObject: (updates: Partial<ArtboardPropertiesData>) => void;
  activeTab: "tools" | "transform" | "color";
  onDelete?: () => void;
  onCanvasCommand?: (command: string) => Promise<string>;
}

export const ArtboardProperties = ({ 
  selectedObject, 
  canvas, 
  properties, 
  updateObject,
  activeTab,
  onDelete,
  onCanvasCommand
}: ArtboardPropertiesProps) => {
  const [activeTool, setActiveTool] = useState<"backgroundGenerator" | "layoutAssistant" | null>(null);
  const [backgroundPrompt, setBackgroundPrompt] = useState("");
  const [layoutPrompt, setLayoutPrompt] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [generatedBackgroundUrl, setGeneratedBackgroundUrl] = useState<string | null>(null);

  const isArtboard = selectedObject instanceof FabricRect && (selectedObject as any).isArtboard;

  // Handle background generation
  const handleGenerateBackground = async () => {
    if (!backgroundPrompt.trim()) {
      toast.error("Please enter a background description");
      return;
    }

    if (!selectedObject || !isArtboard) {
      toast.error("No artboard selected");
      return;
    }

    setIsAiProcessing(true);
    try {
      const artboard = selectedObject as FabricRect;
      const width = Math.round(artboard.getScaledWidth());
      const height = Math.round(artboard.getScaledHeight());

      // Generate background image
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: `${backgroundPrompt}. Create a seamless, tileable background pattern. High quality, professional background.`
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to generate background");
      }

      const data = await res.json();
      if (data?.imageUrl) {
        // Ensure the generated image matches the artboard dimensions exactly
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            try {
              // Create a canvas to resize/crop the image to exact artboard dimensions
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                // Draw the image, scaling to cover the artboard area
                // This ensures the aspect ratio is maintained while filling the space
                const imgAspect = img.width / img.height;
                const artboardAspect = width / height;
                
                let drawWidth = width;
                let drawHeight = height;
                let drawX = 0;
                let drawY = 0;
                
                if (imgAspect > artboardAspect) {
                  // Image is wider - fit to height and crop width
                  drawHeight = height;
                  drawWidth = height * imgAspect;
                  drawX = (width - drawWidth) / 2;
                } else {
                  // Image is taller - fit to width and crop height
                  drawWidth = width;
                  drawHeight = width / imgAspect;
                  drawY = (height - drawHeight) / 2;
                }
                
                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                const resizedUrl = canvas.toDataURL('image/png');
                setGeneratedBackgroundUrl(resizedUrl);
                toast.success("Background generated! Click Apply to use it.");
              } else {
                // Fallback to original if canvas resize fails
                setGeneratedBackgroundUrl(data.imageUrl);
                toast.success("Background generated! Click Apply to use it.");
              }
              resolve();
            } catch (error) {
              console.error('Error resizing background:', error);
              // Fallback to original image
              setGeneratedBackgroundUrl(data.imageUrl);
              toast.success("Background generated! Click Apply to use it.");
              resolve();
            }
          };
          img.onerror = () => {
            reject(new Error('Failed to load generated image'));
          };
          img.src = data.imageUrl;
        });
      } else {
        throw new Error("No image URL returned");
      }
    } catch (error) {
      console.error('Background generation error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to generate background");
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Apply generated background
  const handleApplyBackground = async () => {
    if (!generatedBackgroundUrl || !selectedObject || !canvas) return;

    try {
      const artboard = selectedObject as FabricRect;
      
      // Load the image first
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = generatedBackgroundUrl;
      });

      // Create a pattern from the loaded image using Fabric.js Pattern
      const pattern = new Pattern({
        source: img,
        repeat: 'repeat'
      });

      // Set the pattern as the fill
      artboard.set({ fill: pattern });
      canvas.renderAll();
      
      toast.success("Background applied!");
      setGeneratedBackgroundUrl(null);
      setBackgroundPrompt("");
    } catch (error) {
      console.error('Error applying background:', error);
      toast.error("Failed to apply background");
    }
  };

  // Handle layout suggestions
  const handleLayoutSuggestion = async () => {
    if (!layoutPrompt.trim()) {
      toast.error("Please enter a layout description");
      return;
    }

    if (!onCanvasCommand) {
      toast.error("Canvas command handler not available");
      return;
    }

    setIsAiProcessing(true);
    try {
      // Use canvas command API to suggest layout
      const command = `[target=selection] ${layoutPrompt}`;
      const result = await onCanvasCommand(command);
      toast.success(result || "Layout suggestion applied");
      setLayoutPrompt("");
    } catch (error) {
      console.error('Layout suggestion error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to apply layout suggestion");
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {activeTab === "tools" ? (
        <>
          {/* Fixed EditSpace at Top */}
          <ArtboardEditSpace
            tool={activeTool}
            selectedObject={selectedObject}
            canvas={canvas}
            onBackgroundGenerated={handleApplyBackground}
            generatedBackgroundUrl={generatedBackgroundUrl}
          />
          {/* Scrollable Tools Section Below */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-track]:hidden [&::-webkit-scrollbar-thumb]:hidden">
            <div className="space-y-2.5">
              {/* AI Background Generator */}
              <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                <button
                  onClick={() => setActiveTool(activeTool === 'backgroundGenerator' ? null : 'backgroundGenerator')}
                  className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#3B82F6]" />
                    <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">AI Background Generator</span>
                  </div>
                  {activeTool === 'backgroundGenerator' ? (
                    <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                  )}
                </button>
                <div
                  className={`overflow-hidden transition-all ${activeTool === 'backgroundGenerator' ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                  style={{ transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 250ms cubic-bezier(0.4,0,0.2,1)' }}
                >
                  <div className="pt-2 px-3 pb-3 space-y-2">
                    <div>
                      <p className="text-[11px] text-[#6E6E6E] mb-1.5">Describe the background you want</p>
                      <Textarea
                        value={backgroundPrompt}
                        onChange={(e) => setBackgroundPrompt(e.target.value)}
                        placeholder="e.g., gradient blue sky, abstract geometric pattern, wood texture..."
                        className="min-h-[60px] resize-none text-[11px] border border-[#E5E5E5] bg-white"
                        disabled={isAiProcessing}
                      />
                    </div>
                    {generatedBackgroundUrl ? (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-[#E5E5E5] overflow-hidden bg-[#F5F5F5]">
                          <img
                            src={generatedBackgroundUrl}
                            alt="Generated background"
                            className="w-full h-24 object-cover"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            onClick={handleApplyBackground}
                            className="flex-1 h-8 text-[11px] rounded-lg"
                            size="sm"
                          >
                            Apply Background
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setGeneratedBackgroundUrl(null);
                              setBackgroundPrompt("");
                            }}
                            className="h-8 text-[11px] rounded-lg"
                            size="sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={handleGenerateBackground}
                        disabled={isAiProcessing || !backgroundPrompt.trim()}
                        className="w-full h-8 text-[11px] rounded-lg gap-1.5"
                        size="sm"
                      >
                        {isAiProcessing ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            Generate Background
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Layout Assistant */}
              <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                <button
                  onClick={() => setActiveTool(activeTool === 'layoutAssistant' ? null : 'layoutAssistant')}
                  className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                >
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[#3B82F6]" />
                    <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">AI Layout Assistant</span>
                  </div>
                  {activeTool === 'layoutAssistant' ? (
                    <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                  )}
                </button>
                <div
                  className={`overflow-hidden transition-all ${activeTool === 'layoutAssistant' ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                  style={{ transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 250ms cubic-bezier(0.4,0,0.2,1)' }}
                >
                  <div className="pt-2 px-3 pb-3 space-y-2">
                    <div>
                      <p className="text-[11px] text-[#6E6E6E] mb-1.5">Describe how to arrange selected objects</p>
                      <Textarea
                        value={layoutPrompt}
                        onChange={(e) => setLayoutPrompt(e.target.value)}
                        placeholder="e.g., center everything, arrange horizontally, create grid layout..."
                        className="min-h-[60px] resize-none text-[11px] border border-[#E5E5E5] bg-white"
                        disabled={isAiProcessing}
                      />
                    </div>
                    <Button
                      onClick={handleLayoutSuggestion}
                      disabled={isAiProcessing || !layoutPrompt.trim()}
                      className="w-full h-8 text-[11px] rounded-lg gap-1.5"
                      size="sm"
                    >
                      {isAiProcessing ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <Brain className="w-3 h-3" />
                          Apply Layout
                        </>
                      )}
                    </Button>
                    <div className="text-[10px] text-[#9E9E9E]">Tip: Select objects in the artboard first, then describe the layout.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Transform Tab Content - Reuse from Shapes */
        <div className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-track]:hidden [&::-webkit-scrollbar-thumb]:hidden">
          <div className="space-y-2.5">
            {/* Position Section */}
            <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl px-3 py-2.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Move className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Position</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white">
                  <span className="text-[11px] text-[#6E6E6E] px-2 py-1 font-medium">X</span>
                  <Input
                    type="number"
                    value={Math.round(properties.x)}
                    onChange={(e) => updateObject({ x: Number(e.target.value) })}
                    className="h-7 w-16 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                    style={{ fontSize: '13px' }}
                  />
                </div>
                <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white">
                  <span className="text-[11px] text-[#6E6E6E] px-2 py-1 font-medium">Y</span>
                  <Input
                    type="number"
                    value={Math.round(properties.y)}
                    onChange={(e) => updateObject({ y: Number(e.target.value) })}
                    className="h-7 w-16 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            {/* Layout Section */}
            <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Maximize className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Layout</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white">
                  <span className="text-[11px] text-[#6E6E6E] px-2 py-1 font-medium">W</span>
                  <Input
                    type="number"
                    value={Math.round(properties.width)}
                    onChange={(e) => updateObject({ width: Number(e.target.value) })}
                    className="h-7 w-16 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                    style={{ fontSize: '13px' }}
                  />
                </div>
                <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white">
                  <span className="text-[11px] text-[#6E6E6E] px-2 py-1 font-medium">H</span>
                  <Input
                    type="number"
                    value={Math.round(properties.height)}
                    onChange={(e) => updateObject({ height: Number(e.target.value) })}
                    className="h-7 w-16 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            {/* Rotation Section */}
            <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <RotateCw className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Rotation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white flex-1">
                  <span className="text-[11px] text-[#6E6E6E] px-2 py-1 font-medium">°</span>
                  <Input
                    type="number"
                    value={Math.round(properties.rotation)}
                    onChange={(e) => updateObject({ rotation: Number(e.target.value) })}
                    className="h-7 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            {/* Opacity Section */}
            <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Opacity</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white flex-1">
                  <span className="text-[11px] text-[#6E6E6E] px-2 py-1 font-medium">%</span>
                  <Input
                    type="number"
                    value={Math.round(properties.opacity)}
                    onChange={(e) => updateObject({ opacity: Number(e.target.value) })}
                    className="h-7 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                    min={0}
                    max={100}
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

