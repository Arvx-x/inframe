import { useMemo, useState, useEffect, useRef } from "react";
import { FabricObject, Rect as FabricRect, Pattern } from "fabric";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";

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

        // 1. Clone Artboard and apply modifications
        // We can't easily clone Fabric objects with full fidelity in a lightweight way without async
        // So we will try to modify the rendering context or use a temporary invisible canvas?
        // Actually, we can just use the existing objects but override their properties during render?
        // No, render() uses internal state.
        // Best approach: Clone objects, apply mods, render, then dispose.

        // Helper to find modification for an object
        const getMod = (id: string) => designDnaResult.modifications?.find((m: any) => m.id === id);

        // Render Artboard (Background)
        // Check if artboard has mods
        // We need to know the artboard's ID or assume it's the container
        // For now, let's assume artboard modifications might be passed with a special ID or we check if any mod matches artboard properties?
        // The API returns mods by ID. We assigned IDs to objects sent.
        // If we didn't assign ID to artboard, we might miss it.
        // Let's just render artboard as is for now, or try to apply fill if we can match it.

        // Render Artboard
        artboard.render(ctx);

        // Render Contained Objects with Modifications
        for (const obj of containedObjects) {
          const mod = getMod((obj as any).id); // Assuming we have IDs

          if (mod) {
            // Clone and modify
            // This is expensive. 
            // Alternative: Save state, modify, render, restore.
            const originalState = obj.toObject(); // simplified state save
            // Actually, toObject is heavy.
            // Let's just save the specific props we modify.
            const savedProps: any = {};
            Object.keys(mod).forEach(key => {
              if (key !== 'id') savedProps[key] = (obj as any)[key];
            });

            obj.set(mod);
            obj.render(ctx);

            // Restore
            obj.set(savedProps);
          } else {
            obj.render(ctx);
          }
        }

        // Render Additions
        // We need to create new Fabric objects for additions
        if (designDnaResult.additions) {
          for (const add of designDnaResult.additions) {
            // Create object based on type
            // This requires importing Fabric classes or using a factory
            // Since we can't easily import everything here dynamically, 
            // we might skip additions for this preview or support basic shapes.
            // For now, let's skip additions to avoid complexity or use simple placeholder drawing.
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
    return (
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[38vh]">
        <div className="px-0 py-3 h-full flex flex-col">
          <div className="text-[11px] text-[#9E9E9E] px-3 mb-2">Design DNA — Preview</div>
          <div className="relative flex-1 mx-3 rounded-lg border border-[#E5E5E5]
                          bg-[length:16px_16px]
                          bg-[linear-gradient(to_right,#EDEDED_1px,transparent_1px),linear-gradient(to_bottom,#EDEDED_1px,transparent_1px)]">
            {mounted && compositePreviewSrc ? (
              <img
                src={compositePreviewSrc}
                alt="Design DNA preview"
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
                Upload an image to extract design DNA
              </div>
            )}
          </div>
          {mounted && (compositePreviewSrc || previewSrc) && (
            <div className="mx-3 mt-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded text-center">
              {dimensions.width} × {dimensions.height}
              {compositePreviewSrc ? " • Preview with Design DNA" : ""}
            </div>
          )}
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


