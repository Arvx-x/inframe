import { useMemo, useState, useEffect, useRef } from "react";
import { FabricObject, Rect as FabricRect, Pattern } from "fabric";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import { createFabricObjects } from "@/app/utils/createFabricObject";
import { Plus, ChevronDown } from "lucide-react";

type ToolKey =
  | "backgroundGenerator"
  | "layoutAssistant"
  | "designDna"
  | null;

interface ArtboardEditSpaceProps {
  tool: ToolKey;
  selectedObject: FabricObject | null;
  canvas: any;
  onBackgroundGenerated?: (imageUrl: string) => void;
  onLayoutSuggestionChange?: (suggestion: any) => void;
  generatedBackgroundUrl?: string | null;
  designDnaResult?: any;
}

export function ArtboardEditSpace({
  tool,
  selectedObject,
  canvas,
  onBackgroundGenerated,
  onLayoutSuggestionChange,
  generatedBackgroundUrl,
  designDnaResult
}: ArtboardEditSpaceProps) {
  const [mounted, setMounted] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [compositePreviewSrc, setCompositePreviewSrc] = useState<string>("");
  const [objectCount, setObjectCount] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [currentElementIndex, setCurrentElementIndex] = useState(0);
  const previewUpdateRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get artboard and contained objects
  const artboardData = useMemo(() => {
    if (!mounted || !canvas || !selectedObject) return null;

    const artboard = selectedObject as FabricRect;
    if (!(artboard instanceof FabricRect) || !(artboard as any).isArtboard) {
      return null;
    }

    const artboardBounds = artboard.getBoundingRect();
    const allObjects = canvas.getObjects();

    // Find objects contained within artboard
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
    });

    return {
      artboard,
      bounds: artboardBounds,
      containedObjects,
      width: Math.round(artboard.getScaledWidth()),
      height: Math.round(artboard.getScaledHeight()),
    };
  }, [mounted, canvas, selectedObject]);

  // Update preview when artboard or contained objects change
  useEffect(() => {
    if (!artboardData || !canvas || !selectedObject) return;

    const artboard = selectedObject as FabricRect;
    if (!(artboard instanceof FabricRect) || !(artboard as any).isArtboard) return;

    const updatePreview = () => {
      try {
        // Recalculate bounds in case artboard was resized
        const bounds = artboard.getBoundingRect();
        const allObjects = canvas.getObjects();

        // Recalculate contained objects
        const containedObjects = allObjects.filter((obj: FabricObject) => {
          if (obj === artboard) return false;
          if ((obj as any).isArtboard) return false;

          const objBounds = obj.getBoundingRect();
          const centerX = objBounds.left + objBounds.width / 2;
          const centerY = objBounds.top + objBounds.height / 2;

          return (
            centerX >= bounds.left &&
            centerX <= bounds.left + bounds.width &&
            centerY >= bounds.top &&
            centerY <= bounds.top + bounds.height
          );
        });

        requestAnimationFrame(() => {
          try {
            const maxPreviewSize = 768;
            const scale = Math.min(maxPreviewSize / bounds.width, maxPreviewSize / bounds.height, 1);

            const offCanvas = document.createElement('canvas');
            offCanvas.width = Math.round(bounds.width * scale);
            offCanvas.height = Math.round(bounds.height * scale);
            const ctx = offCanvas.getContext('2d');

            if (!ctx) return;

            const originalBg = canvas.backgroundColor as string | undefined;
            if (!originalBg || originalBg === 'transparent') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
            } else {
              ctx.fillStyle = originalBg;
              ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
            }

            ctx.save();
            ctx.scale(scale, scale);
            ctx.translate(-bounds.left, -bounds.top);

            const objectsToRender = [artboard, ...containedObjects].filter((obj: FabricObject) => {
              const objBounds = obj.getBoundingRect();
              return !(
                objBounds.left + objBounds.width < bounds.left ||
                objBounds.left > bounds.left + bounds.width ||
                objBounds.top + objBounds.height < bounds.top ||
                objBounds.top > bounds.top + bounds.height
              );
            });

            objectsToRender.forEach((obj: FabricObject) => {
              try {
                obj.render(ctx);
              } catch (error) {
                console.warn('Error rendering object to preview:', error);
              }
            });

            ctx.restore();

            const dataURL = offCanvas.toDataURL('image/png', 0.9);

            setPreviewSrc(dataURL);
            setObjectCount(containedObjects.length);
            setDimensions({
              width: Math.round(artboard.getScaledWidth()),
              height: Math.round(artboard.getScaledHeight())
            });
          } catch (error) {
            console.error('Error generating preview:', error);
          }
        });
      } catch (error) {
        console.error('Error in updatePreview:', error);
      }
    };

    const initialTimer = setTimeout(updatePreview, 100);
    previewUpdateRef.current++;

    const handleUpdate = () => {
      updatePreview();
    };

    let updateTimer: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(updatePreview, 150);
    };

    artboard.on('modified', debouncedUpdate);
    artboard.on('scaling', debouncedUpdate);

    canvas.on('object:modified', debouncedUpdate);
    canvas.on('object:added', debouncedUpdate);
    canvas.on('object:removed', debouncedUpdate);
    canvas.on('object:moving', debouncedUpdate);
    canvas.on('after:render', debouncedUpdate);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(updateTimer);
      artboard.off('modified', debouncedUpdate);
      artboard.off('scaling', debouncedUpdate);
      canvas.off('object:modified', debouncedUpdate);
      canvas.off('object:added', debouncedUpdate);
      canvas.off('object:removed', debouncedUpdate);
      canvas.off('object:moving', debouncedUpdate);
      canvas.off('after:render', debouncedUpdate);
    };
  }, [artboardData, canvas, selectedObject]);

  // Design DNA Preview Logic
  useEffect(() => {
    if (tool !== 'designDna' || !designDnaResult || !artboardData || !canvas) {
      if (tool === 'designDna' && !designDnaResult) {
        setCompositePreviewSrc(""); // Clear if no result
      }
      return;
    }

    const generateDesignPreview = async () => {
      try {
        const { artboard, bounds, containedObjects } = artboardData;
        const maxPreviewSize = 768;
        const scale = Math.min(maxPreviewSize / bounds.width, maxPreviewSize / bounds.height, 1);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = Math.round(bounds.width * scale);
        offCanvas.height = Math.round(bounds.height * scale);
        const ctx = offCanvas.getContext('2d');

        if (!ctx) return;

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

        ctx.save();
        ctx.scale(scale, scale);
        ctx.translate(-bounds.left, -bounds.top);

        // Helper to find modification for an object
        const getMod = (id: string) => designDnaResult.modifications?.find((m: any) => m.id === id);

        // Render Artboard (Background)
        artboard.render(ctx);

        // Render Contained Objects with Modifications
        for (const obj of containedObjects) {
          const mod = getMod((obj as any).id);

          if (mod) {
            // Save original properties
            const savedProps: any = {};
            Object.keys(mod).forEach(key => {
              if (key !== 'id') savedProps[key] = (obj as any)[key];
            });

            obj.set(mod);
            obj.render(ctx);

            // Restore original properties
            obj.set(savedProps);
          } else {
            obj.render(ctx);
          }
        }

        // Render Additions - NEW FUNCTIONALITY
        if (designDnaResult.additions && Array.isArray(designDnaResult.additions)) {
          try {
            const newObjects = createFabricObjects(designDnaResult.additions);

            // Render each new object
            newObjects.forEach((obj) => {
              try {
                obj.render(ctx);
              } catch (e) {
                console.warn('Error rendering addition:', e);
              }
            });

            console.log(`Preview: Rendered ${newObjects.length} addition(s)`);
          } catch (e) {
            console.error('Error creating additions for preview:', e);
          }
        }

        ctx.restore();
        setCompositePreviewSrc(offCanvas.toDataURL());

        // Trigger a re-render of the main canvas to ensure no state leaked (safety)
        canvas.requestRenderAll();

      } catch (e) {
        console.error("Error generating Design DNA preview", e);
      }
    };

    generateDesignPreview();
  }, [tool, designDnaResult, artboardData, canvas]);


  // Create composite preview when both background and artboard are available
  useEffect(() => {
    if (tool !== 'backgroundGenerator' || !generatedBackgroundUrl || !artboardData || !canvas || !selectedObject) {
      if (tool === 'backgroundGenerator' && !generatedBackgroundUrl) setCompositePreviewSrc("");
      return;
    }

    const artboard = selectedObject as FabricRect;
    if (!(artboard instanceof FabricRect) || !(artboard as any).isArtboard) {
      setCompositePreviewSrc("");
      return;
    }

    const createComposite = async () => {
      try {
        const bounds = artboard.getBoundingRect();
        const maxPreviewSize = 768;
        const scale = Math.min(maxPreviewSize / bounds.width, maxPreviewSize / bounds.height, 1);

        const originalFill = (artboard as any).fill;

        const bgImg = new Image();
        bgImg.crossOrigin = 'anonymous';

        await new Promise<void>((resolve, reject) => {
          bgImg.onload = () => resolve();
          bgImg.onerror = () => reject(new Error('Failed to load background'));
          bgImg.src = generatedBackgroundUrl;
        });

        const pattern = new Pattern({
          source: bgImg,
          repeat: 'repeat'
        });

        artboard.set({ fill: pattern });
        canvas.renderAll();

        await new Promise(resolve => requestAnimationFrame(resolve));

        const offCanvas = document.createElement('canvas');
        offCanvas.width = Math.round(bounds.width * scale);
        offCanvas.height = Math.round(bounds.height * scale);
        const ctx = offCanvas.getContext('2d');

        if (!ctx) throw new Error('Failed to get offscreen canvas context');

        const originalBg = canvas.backgroundColor as string | undefined;
        if (!originalBg || originalBg === 'transparent') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        } else {
          ctx.fillStyle = originalBg;
          ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        }

        const allObjects = canvas.getObjects();
        const containedObjects = allObjects.filter((obj: FabricObject) => {
          if (obj === artboard) return false;
          if ((obj as any).isArtboard) return false;

          const objBounds = obj.getBoundingRect();
          const centerX = objBounds.left + objBounds.width / 2;
          const centerY = objBounds.top + objBounds.height / 2;

          return (
            centerX >= bounds.left &&
            centerX <= bounds.left + bounds.width &&
            centerY >= bounds.top &&
            centerY <= bounds.top + bounds.height
          );
        });

        ctx.save();
        ctx.scale(scale, scale);
        ctx.translate(-bounds.left, -bounds.top);

        const objectsToRender = [artboard, ...containedObjects].filter((obj: FabricObject) => {
          const objBounds = obj.getBoundingRect();
          return !(
            objBounds.left + objBounds.width < bounds.left ||
            objBounds.left > bounds.left + bounds.width ||
            objBounds.top + objBounds.height < bounds.top ||
            objBounds.top > bounds.top + bounds.height
          );
        });

        objectsToRender.forEach((obj: FabricObject) => {
          try {
            obj.render(ctx);
          } catch (error) {
            console.warn('Error rendering object to composite preview:', error);
          }
        });

        ctx.restore();

        const compositeDataURL = offCanvas.toDataURL('image/png', 0.9);

        artboard.set({ fill: originalFill });
        canvas.renderAll();

        setCompositePreviewSrc(compositeDataURL);
      } catch (error) {
        console.error('Error creating composite preview:', error);
        setCompositePreviewSrc("");
        try {
          if (selectedObject && (selectedObject as any).isArtboard) {
            const artboard = selectedObject as FabricRect;
            const originalFill = (artboard as any).__originalFill;
            if (originalFill !== undefined) {
              artboard.set({ fill: originalFill });
              canvas.renderAll();
            }
          }
        } catch (restoreError) {
          console.error('Error restoring fill:', restoreError);
        }
      }
    };

    createComposite();
  }, [generatedBackgroundUrl, artboardData, canvas, selectedObject, tool]);

  if (!tool) {
    return (
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[38vh]">
        <div className="px-0 py-3 h-full flex flex-col">
          <div className="text-[11px] text-[#9E9E9E] px-3 mb-2">Select a tool to edit here</div>
          <div className="relative flex-1 mx-3 rounded-lg border border-[#E5E5E5]
                          bg-[length:16px_16px]
                          bg-[linear-gradient(to_right,#EDEDED_1px,transparent_1px),linear-gradient(to_bottom,#EDEDED_1px,transparent_1px)]">
            {mounted && previewSrc ? (
              <img
                src={previewSrc}
                alt="Artboard preview"
                className="absolute inset-0 m-auto max-h-[80%] max-w-[80%] object-contain opacity-90 pointer-events-none"
              />
            ) : (
              <div className="absolute inset-0 m-auto h-full w-full flex items-center justify-center text-[11px] text-[#9E9E9E]">
                No artboard selected
              </div>
            )}
          </div>
          {mounted && previewSrc && (
            <div className="mx-3 mt-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded text-center">
              {dimensions.width} × {dimensions.height} • {objectCount} object{objectCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Background Generator tool
  if (tool === "backgroundGenerator") {
    return (
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[38vh]">
        <div className="px-0 py-3 h-full flex flex-col">
          <div className="text-[11px] text-[#9E9E9E] px-3 mb-2">Background Generator — Preview</div>
          <div className="relative flex-1 mx-3 rounded-lg border border-[#E5E5E5]
                          bg-[length:16px_16px]
                          bg-[linear-gradient(to_right,#EDEDED_1px,transparent_1px),linear-gradient(to_bottom,#EDEDED_1px,transparent_1px)]">
            {mounted && compositePreviewSrc ? (
              <img
                src={compositePreviewSrc}
                alt="Composite preview with generated background"
                className="absolute inset-0 m-auto max-h-[80%] max-w-[80%] object-contain opacity-90 pointer-events-none"
              />
            ) : mounted && generatedBackgroundUrl ? (
              <img
                src={generatedBackgroundUrl}
                alt="Generated background preview"
                className="absolute inset-0 m-auto max-h-[80%] max-w-[80%] object-contain opacity-90 pointer-events-none"
              />
            ) : mounted && previewSrc ? (
              <img
                src={previewSrc}
                alt="Artboard preview"
                className="absolute inset-0 m-auto max-h-[80%] max-w-[80%] object-contain opacity-90 pointer-events-none"
              />
            ) : (
              <div className="absolute inset-0 m-auto h-full w-full flex items-center justify-center text-[11px] text-[#9E9E9E]">
                Generate a background to preview
              </div>
            )}
          </div>
          {mounted && (compositePreviewSrc || generatedBackgroundUrl || previewSrc) && (
            <div className="mx-3 mt-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded text-center">
              {dimensions.width} × {dimensions.height}
              {compositePreviewSrc ? " • Preview with Generated Background" : generatedBackgroundUrl ? " • Loading preview..." : ""}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Layout Assistant tool
  if (tool === "layoutAssistant") {
    return (
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[38vh]">
        <div className="px-0 py-3 h-full flex flex-col">
          <div className="text-[11px] text-[#9E9E9E] px-3 mb-2">Smart Layout — Preview</div>
          <div className="relative flex-1 mx-3 rounded-lg border border-[#E5E5E5]
                          bg-[length:16px_16px]
                          bg-[linear-gradient(to_right,#EDEDED_1px,transparent_1px),linear-gradient(to_bottom,#EDEDED_1px,transparent_1px)]">
            {mounted && previewSrc ? (
              <img
                src={previewSrc}
                alt="Layout preview"
                className="absolute inset-0 m-auto max-h-[80%] max-w-[80%] object-contain opacity-90 pointer-events-none"
              />
            ) : (
              <div className="absolute inset-0 m-auto h-full w-full flex items-center justify-center text-[11px] text-[#9E9E9E]">
                Select objects to see layout suggestions
              </div>
            )}
          </div>
          {mounted && previewSrc && (
            <div className="mx-3 mt-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded text-center">
              {dimensions.width} × {dimensions.height} • {objectCount} object{objectCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Design DNA tool
  if (tool === "designDna") {
    const elements = designDnaResult?.elements || [];
    const currentElement = elements[currentElementIndex];

    const handleAddToCanvas = () => {
      if (!currentElement || !canvas) return;

      try {
        const newObj = createFabricObjects([{
          ...currentElement,
          id: `elem-${Date.now()}`,
          // Position at canvas center
          left: (canvas.width || 800) / 2 - (currentElement.width || 100) / 2,
          top: (canvas.height || 600) / 2 - (currentElement.height || 100) / 2,
          ...currentElement.properties
        }])[0];

        if (newObj) {
          canvas.add(newObj);
          newObj.setCoords();
          canvas.renderAll();
          toast.success(`Added "${currentElement.name}" to canvas!`);
        }
      } catch (error) {
        console.error('Error adding element:', error);
        toast.error("Failed to add element");
      }
    };

    return (
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[38vh]">
        <div className="px-0 py-3 h-full flex flex-col">
          <div className="text-[11px] text-[#9E9E9E] px-3 mb-2">Design DNA — Elements</div>
          <div className="relative flex-1 mx-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] overflow-hidden py-4 px-2">
            {elements.length > 0 ? (
              <div className="h-full flex flex-col">
                {/* Element Preview with Side Navigation */}
                <div className="flex-1 flex items-center relative">
                  {/* Left Arrow */}
                  <button
                    onClick={() => setCurrentElementIndex(Math.max(0, currentElementIndex - 1))}
                    disabled={currentElementIndex === 0}
                    className="absolute left-0 top-[62%] -translate-y-1/2 z-10 p-1.5 rounded-full bg-white shadow-md border border-[#E5E5E5] hover:bg-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                  </button>

                  {/* Card Content */}
                  <div className="flex-1 flex flex-col items-center justify-start p-2.5 gap-1.5 -mt-1.5">
                    <div className="text-center w-full max-w-[200px]">
                      {/* Render element preview */}
                      <div className="mb-1.5 flex items-center justify-center min-h-[105px] max-h-[130px] bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-3.5 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-[radial-gradient(#E5E5E5_1px,transparent_1px)] [background-size:8px_8px] opacity-30" />

                        <div className="relative z-10 flex items-center justify-center">
                          {currentElement.type === 'circle' && (
                            <div
                              style={{
                                width: Math.min(currentElement.properties.radius * 2 || 80, 100),
                                height: Math.min(currentElement.properties.radius * 2 || 80, 100),
                                borderRadius: '50%',
                                backgroundColor: currentElement.properties.fill || '#000',
                                border: currentElement.properties.stroke ? `${currentElement.properties.strokeWidth || 1}px solid ${currentElement.properties.stroke}` : 'none',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                          )}
                          {currentElement.type === 'ellipse' && (
                            <div
                              style={{
                                width: Math.min(currentElement.properties.rx * 2 || 100, 120),
                                height: Math.min(currentElement.properties.ry * 2 || 60, 80),
                                borderRadius: '50%',
                                backgroundColor: currentElement.properties.fill || '#000',
                                border: currentElement.properties.stroke ? `${currentElement.properties.strokeWidth || 1}px solid ${currentElement.properties.stroke}` : 'none',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                          )}
                          {currentElement.type === 'rect' && (
                            <div
                              style={{
                                width: Math.min(currentElement.width || 100, 100),
                                height: Math.min(currentElement.height || 80, 80),
                                borderRadius: currentElement.properties.rx || currentElement.properties.ry || 0,
                                backgroundColor: currentElement.properties.fill || '#000',
                                border: currentElement.properties.stroke ? `${currentElement.properties.strokeWidth || 1}px solid ${currentElement.properties.stroke}` : 'none',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                              }}
                            />
                          )}
                          {currentElement.type === 'triangle' && (
                            <div
                              style={{
                                width: 0,
                                height: 0,
                                borderLeft: '40px solid transparent',
                                borderRight: '40px solid transparent',
                                borderBottom: `80px solid ${currentElement.properties.fill || '#000'}`,
                                filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
                              }}
                            />
                          )}
                          {(currentElement.type === 'text' || currentElement.type === 'textbox') && (
                            <div
                              style={{
                                fontSize: Math.min(currentElement.properties.fontSize || 16, 24),
                                fontFamily: currentElement.properties.fontFamily || 'sans-serif',
                                fontWeight: currentElement.properties.fontWeight || 'normal',
                                color: currentElement.properties.fill || '#000',
                                textAlign: currentElement.properties.textAlign || 'center',
                                maxWidth: '100%',
                                wordBreak: 'break-word'
                              }}
                            >
                              {currentElement.properties.text || 'Sample Text'}
                            </div>
                          )}
                          {/* Fallback for other shapes (polygon, path, etc) */}
                          {['polygon', 'path', 'line'].includes(currentElement.type) && (
                            <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                              <div className="w-8 h-8 border-2 border-current rounded-sm transform rotate-45" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[12px] font-medium text-[#161616] mb-0.5 truncate">{currentElement.name}</div>
                      <div className="text-[10px] text-[#6E6E6E] mb-3 capitalize flex items-center justify-center gap-1">
                        {currentElement.type} • <span className="font-mono">{currentElementIndex + 1}/{elements.length}</span>
                      </div>

                      <Button
                        onClick={handleAddToCanvas}
                        className="w-full h-8 text-[11px] rounded-lg gap-1.5 shadow-sm"
                        size="sm"
                      >
                        <Plus className="w-3 h-3" />
                        Add to Canvas
                      </Button>
                    </div>
                  </div>

                  {/* Right Arrow */}
                  <button
                    onClick={() => setCurrentElementIndex(Math.min(elements.length - 1, currentElementIndex + 1))}
                    disabled={currentElementIndex === elements.length - 1}
                    className="absolute right-0 top-[62%] -translate-y-1/2 z-10 p-1.5 rounded-full bg-white shadow-md border border-[#E5E5E5] hover:bg-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronDown className="w-4 h-4 -rotate-90" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 m-auto h-full w-full flex items-center justify-center text-[11px] text-[#9E9E9E] text-center px-4">
                Extract design DNA to see<br />reusable elements
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default preview
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[38vh]">
      <div className="px-0 py-3 h-full flex flex-col">
        <div className="text-[11px] text-[#9E9E9E] px-3 mb-2">Preview</div>
        <div className="relative flex-1 mx-3 rounded-lg border border-[#E5E5E5]
                        bg-[length:16px_16px]
                        bg-[linear-gradient(to_right,#EDEDED_1px,transparent_1px),linear-gradient(to_bottom,#EDEDED_1px,transparent_1px)]">
          {mounted && previewSrc ? (
            <img
              src={previewSrc}
              alt="Artboard preview"
              className="absolute inset-0 m-auto max-h-[70%] max-w-[70%] object-contain opacity-90 pointer-events-none"
            />
          ) : (
            <div className="absolute inset-0 m-auto h-full w-full flex items-center justify-center text-[11px] text-[#9E9E9E]">
              No artboard selected
            </div>
          )}
        </div>
        {mounted && previewSrc && (
          <div className="mx-3 mt-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded text-center">
            {dimensions.width} × {dimensions.height} • {objectCount} object{objectCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}


