import { useState, useEffect } from "react";
import {
  Sparkles, Loader2, Wand2, Brain, ChevronDown, ChevronUp,
  Move, Maximize, RotateCw, Eye, EyeOff, Layers, Grid3x3, X, Plus, Link, Box, Minus, Dna
} from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { FabricObject, Rect as FabricRect, Pattern } from "fabric";
import { toast } from "sonner";
import { ArtboardEditSpace } from "@/app/components/ArtboardEditSpace";
import { createFabricObjects } from "@/app/utils/createFabricObject";
import { useProjectColors } from "@/app/contexts/ProjectColorsContext";

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
  const { addColors } = useProjectColors();
  const [activeTool, setActiveTool] = useState<"backgroundGenerator" | "layoutAssistant" | "designDna" | null>(null);
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

  // Handle Design DNA
  type ArtboardWithDesignDna = FabricRect & {
    isArtboard?: boolean;
    designDnaImage?: string | null;
    designDnaResult?: any;
  };

  const getCurrentArtboard = (): ArtboardWithDesignDna | null => {
    if (selectedObject instanceof FabricRect && (selectedObject as any).isArtboard) {
      return selectedObject as ArtboardWithDesignDna;
    }
    return null;
  };

  const currentArtboard = getCurrentArtboard();

  const persistDesignDnaState = (image: string | null, result: any) => {
    if (currentArtboard) {
      currentArtboard.designDnaImage = image;
      currentArtboard.designDnaResult = result;
    }
  };

  const [designImage, setDesignImage] = useState<string | null>(null);
  const [designDnaResult, setDesignDnaResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!currentArtboard) {
      setDesignImage(null);
      setDesignDnaResult(null);
      return;
    }

    setDesignImage(currentArtboard.designDnaImage || null);
    setDesignDnaResult(currentArtboard.designDnaResult || null);
  }, [currentArtboard]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const uploadedImage = e.target?.result as string;
        setDesignImage(uploadedImage);
        persistDesignDnaState(uploadedImage, designDnaResult);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeDesign = async () => {
    if (!designImage || !selectedObject || !canvas) return;

    setIsAnalyzing(true);
    try {
      const artboard = selectedObject as FabricRect;
      const artboardBounds = artboard.getBoundingRect();
      const allObjects = canvas.getObjects();

      // Get objects inside artboard
      const containedObjects = allObjects.filter((obj: FabricObject) => {
        if (obj === artboard) return false;
        if ((obj as any).isArtboard) return false;

        const objBounds = obj.getBoundingRect();
        const centerX = objBounds.left + objBounds.width / 2;
        const centerY = objBounds.top + objBounds.height / 2;

        return (
          centerX >= artboardBounds.left &&
          centerX <= artboardBounds.left + artboardBounds.width &&
          centerY >= artboardBounds.top &&
          centerY <= artboardBounds.top + artboardBounds.height
        );
      }).map((obj: any) => {
        // Ensure the actual Fabric object has an ID
        if (!obj.id) {
          obj.set('id', Math.random().toString(36).substr(2, 9));
        }

        return {
          id: obj.id,
          type: obj.type,
          left: obj.left,
          top: obj.top,
          width: obj.width,
          height: obj.height,
          fill: obj.fill,
          stroke: obj.stroke,
          text: obj.text,
          fontSize: obj.fontSize,
          fontFamily: obj.fontFamily,
          opacity: obj.opacity
        };
      });

      const res = await fetch('/api/design-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: designImage,
          artboardObjects: containedObjects,
          artboardDimensions: {
            width: Math.round(artboard.getScaledWidth()),
            height: Math.round(artboard.getScaledHeight()),
            left: artboardBounds.left,
            top: artboardBounds.top
          }
        })
      });

      if (!res.ok) {
        throw new Error("Failed to analyze design");
      }

      const data = await res.json();
      if (data.success) {
        setDesignDnaResult(data.data);
        persistDesignDnaState(designImage, data.data);
        toast.success("Design DNA extracted! Previewing changes...");
      } else {
        throw new Error(data.error || "Failed to analyze");
      }
    } catch (error) {
      console.error('Design DNA error:', error);
      toast.error("Failed to analyze design");
    } finally {
      setIsAnalyzing(false);
    }
  };



  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {
        activeTab === "tools" ? (
          <>
            {/* Fixed EditSpace at Top */}
            <ArtboardEditSpace
              tool={activeTool}
              selectedObject={selectedObject}
              canvas={canvas}
              generatedBackgroundUrl={generatedBackgroundUrl}
              designDnaResult={designDnaResult}
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
                      <Grid3x3 className="w-4 h-4 text-[#3B82F6]" />
                      <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Background Generator</span>
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

                {/* Design DNA Tool */}
                <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                  <button
                    onClick={() => setActiveTool(activeTool === 'designDna' ? null : 'designDna')}
                    className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Dna className="w-4 h-4 text-[#3B82F6]" />
                      <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Design DNA</span>
                    </div>
                    {activeTool === 'designDna' ? (
                      <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                    )}
                  </button>
                  <div
                    className={`overflow-hidden transition-all ${activeTool === 'designDna' ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                    style={{ transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 250ms cubic-bezier(0.4,0,0.2,1)' }}
                  >
                    <div className="pt-2 px-3 pb-3 space-y-2">
                      {!designImage ? (
                        <div className="border-2 border-dashed border-[#E5E5E5] rounded-lg p-4 text-center hover:bg-[#F5F5F5] transition-colors cursor-pointer relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                              <Plus className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="text-[11px] text-[#6E6E6E]">
                              <span className="font-medium text-blue-500">Upload image</span> to extract style
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative rounded-lg border border-[#E5E5E5] overflow-hidden bg-[#F5F5F5] group">
                            <img
                              src={designImage}
                              alt="Design reference"
                              className="w-full h-32 object-cover"
                            />
                            <button
                              onClick={() => {
                                setDesignImage(null);
                                setDesignDnaResult(null);
                                persistDesignDnaState(null, null);
                              }}
                              className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          {designDnaResult ? (
                            <div className="space-y-3">
                              {/* Color Palette Section */}
                              {designDnaResult.colors && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#161616]">Color Palette</span>
                                    <Button
                                      onClick={() => {
                                        if (designDnaResult.colors?.palette) {
                                          addColors(designDnaResult.colors.palette);
                                          toast.success(`Added ${designDnaResult.colors.palette.length} colors to project palette!`);
                                        }
                                      }}
                                      size="sm"
                                      className="h-6 text-[10px] px-2"
                                    >
                                      Apply
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-4 gap-1.5">
                                    {designDnaResult.colors.palette?.slice(0, 8).map((color: string, index: number) => (
                                      <div key={index} className="flex flex-col items-center gap-1">
                                        <div
                                          className="w-full aspect-square rounded border border-[#E5E5E5]"
                                          style={{ backgroundColor: color }}
                                          title={color}
                                        />
                                        <span className="text-[9px] text-[#6E6E6E] font-mono">{color}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {designDnaResult.colors.primary && (
                                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-4 h-4 rounded border border-[#E5E5E5]" style={{ backgroundColor: designDnaResult.colors.primary }} />
                                        <span className="text-[#6E6E6E]">Primary</span>
                                      </div>
                                      {designDnaResult.colors.secondary && (
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-4 h-4 rounded border border-[#E5E5E5]" style={{ backgroundColor: designDnaResult.colors.secondary }} />
                                          <span className="text-[#6E6E6E]">Secondary</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Typography Section */}
                              {designDnaResult.typography && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-[#161616]">Typography</span>
                                    <Button
                                      onClick={() => {
                                        // TODO: Apply typography
                                        toast.success("Typography applied!");
                                      }}
                                      size="sm"
                                      className="h-6 text-[10px] px-2"
                                    >
                                      Apply
                                    </Button>
                                  </div>
                                  <div className="space-y-1">
                                    {designDnaResult.typography.fonts?.slice(0, 3).map((font: any, index: number) => (
                                      <div key={index} className="flex items-center justify-between px-2 py-1.5 bg-white rounded border border-[#E5E5E5]">
                                        <div className="flex flex-col">
                                          <span className="text-[11px] font-medium text-[#161616]">{font.family}</span>
                                          <span className="text-[9px] text-[#6E6E6E]">{font.usage} • {font.weight}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Action buttons */}
                              <div className="flex gap-1.5 pt-1">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setDesignDnaResult(null);
                                    setDesignImage(null);
                                    persistDesignDnaState(null, null);
                                  }}
                                  className="flex-1 h-7 text-[10px] rounded-lg"
                                  size="sm"
                                >
                                  Clear
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              onClick={handleAnalyzeDesign}
                              disabled={isAnalyzing}
                              className="w-full h-8 text-[11px] rounded-lg gap-1.5"
                              size="sm"
                            >
                              {isAnalyzing ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Extracting DNA...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3" />
                                  Extract Design DNA
                                </>
                              )}
                            </Button>
                          )}
                          {designDnaResult?.isPhotorealistic && (
                            <div className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1.5 rounded border border-amber-100">
                              Note: Photorealistic image detected. Extraction may vary.
                            </div>
                          )}
                        </div>
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
                      <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Smart Layout</span>
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
        )
      }
    </div >
  );
};

