import { useMemo, useState, useEffect, useRef } from "react";
import { FabricObject, Rect as FabricRect, Pattern } from "fabric";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";

type ToolKey =
  | "backgroundGenerator"
  | "layoutAssistant"
  | null;

interface ArtboardEditSpaceProps {
  tool: ToolKey;
  selectedObject: FabricObject | null;
  canvas: any;
  onBackgroundGenerated?: (imageUrl: string) => void;
  onLayoutSuggestionChange?: (suggestion: any) => void;
  generatedBackgroundUrl?: string | null;
}

export function ArtboardEditSpace({
  tool,
  selectedObject,
  canvas,
  onBackgroundGenerated,
  onLayoutSuggestionChange,
  generatedBackgroundUrl
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
        // getBoundingRect() returns coordinates in canvas space (zoom-independent)
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
        
        // Use requestAnimationFrame to ensure canvas has rendered
        requestAnimationFrame(() => {
          try {
            // Create offscreen canvas to capture preview without viewport transform interference
            // This ensures the preview is completely zoom-independent
            const maxPreviewSize = 768;
            const scale = Math.min(maxPreviewSize / bounds.width, maxPreviewSize / bounds.height, 1);
            
            const offCanvas = document.createElement('canvas');
            offCanvas.width = Math.round(bounds.width * scale);
            offCanvas.height = Math.round(bounds.height * scale);
            const ctx = offCanvas.getContext('2d');
            
            if (!ctx) {
              console.error('Failed to get offscreen canvas context');
              return;
            }
            
            // Fill with white background (or transparent if canvas is transparent)
            const originalBg = canvas.backgroundColor as string | undefined;
            if (!originalBg || originalBg === 'transparent') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
            } else {
              ctx.fillStyle = originalBg;
              ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
            }
            
            // Render the artboard and contained objects to offscreen canvas
            // Translate and scale context to position objects relative to artboard bounds
            ctx.save();
            ctx.scale(scale, scale);
            ctx.translate(-bounds.left, -bounds.top);
            
            // Get all objects to render (artboard + contained objects)
            const objectsToRender = [artboard, ...containedObjects].filter((obj: FabricObject) => {
              const objBounds = obj.getBoundingRect();
              // Check if object intersects with artboard bounds
              return !(
                objBounds.left + objBounds.width < bounds.left ||
                objBounds.left > bounds.left + bounds.width ||
                objBounds.top + objBounds.height < bounds.top ||
                objBounds.top > bounds.top + bounds.height
              );
            });
            
            // Render each object using absolute coordinates (independent of viewport transform)
            objectsToRender.forEach((obj: FabricObject) => {
              try {
                // Render object directly to offscreen canvas context
                // This bypasses viewport transform completely since we're using absolute coordinates
                obj.render(ctx);
              } catch (error) {
                console.warn('Error rendering object to preview:', error);
              }
            });
            
            ctx.restore();
            
            // Get data URL from offscreen canvas
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

    // Initial update with a small delay to ensure canvas is ready
    const initialTimer = setTimeout(updatePreview, 100);
    previewUpdateRef.current++;

    // Listen for canvas updates
    const handleUpdate = () => {
      updatePreview();
    };

    // Use a debounced update to avoid too frequent updates
    let updateTimer: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(updatePreview, 150);
    };

    // Listen to artboard-specific events for resizing (these are zoom-independent)
    artboard.on('modified', debouncedUpdate);
    artboard.on('scaling', debouncedUpdate);
    
    // Listen to canvas-wide events
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

  // Create composite preview when both background and artboard are available
  // This hook must be called before any early returns to maintain hook order
  useEffect(() => {
    if (!generatedBackgroundUrl || !artboardData || !canvas || !selectedObject) {
      setCompositePreviewSrc("");
      return;
    }

    const artboard = selectedObject as FabricRect;
    if (!(artboard instanceof FabricRect) || !(artboard as any).isArtboard) {
      setCompositePreviewSrc("");
      return;
    }

    const createComposite = async () => {
      try {
        // Recalculate bounds in case artboard was resized (zoom-independent)
        // getBoundingRect() returns coordinates in canvas space
        const bounds = artboard.getBoundingRect();
        const maxPreviewSize = 768;
        const scale = Math.min(maxPreviewSize / bounds.width, maxPreviewSize / bounds.height, 1);
        
        // Store original fill
        const originalFill = (artboard as any).fill;
        
        // Load the generated background image
        const bgImg = new Image();
        bgImg.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          bgImg.onload = () => resolve();
          bgImg.onerror = () => reject(new Error('Failed to load background'));
          bgImg.src = generatedBackgroundUrl;
        });

        // Create a pattern from the loaded image
        const pattern = new Pattern({
          source: bgImg,
          repeat: 'repeat'
        });

        // Temporarily apply the generated background to the artboard
        artboard.set({ fill: pattern });
        canvas.renderAll();

        // Wait a frame for rendering
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Create offscreen canvas to capture preview without viewport transform interference
        const offCanvas = document.createElement('canvas');
        offCanvas.width = Math.round(bounds.width * scale);
        offCanvas.height = Math.round(bounds.height * scale);
        const ctx = offCanvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Failed to get offscreen canvas context');
        }
        
        // Fill with white background (or transparent if canvas is transparent)
        const originalBg = canvas.backgroundColor as string | undefined;
        if (!originalBg || originalBg === 'transparent') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        } else {
          ctx.fillStyle = originalBg;
          ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        }
        
        // Get contained objects for rendering
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
        
        // Render the artboard and contained objects to offscreen canvas
        ctx.save();
        ctx.scale(scale, scale);
        ctx.translate(-bounds.left, -bounds.top);
        
            // Render all objects that are within or intersect the artboard
            const objectsToRender = [artboard, ...containedObjects].filter((obj: FabricObject) => {
              const objBounds = obj.getBoundingRect();
          return !(
            objBounds.left + objBounds.width < bounds.left ||
            objBounds.left > bounds.left + bounds.width ||
            objBounds.top + objBounds.height < bounds.top ||
            objBounds.top > bounds.top + bounds.height
          );
        });
        
        // Render each object using absolute coordinates (independent of viewport transform)
        objectsToRender.forEach((obj: FabricObject) => {
          try {
            obj.render(ctx);
          } catch (error) {
            console.warn('Error rendering object to composite preview:', error);
          }
        });
        
        ctx.restore();
        
        // Get data URL from offscreen canvas
        const compositeDataURL = offCanvas.toDataURL('image/png', 0.9);

        // Restore original fill
        artboard.set({ fill: originalFill });
        canvas.renderAll();

        setCompositePreviewSrc(compositeDataURL);
      } catch (error) {
        console.error('Error creating composite preview:', error);
        setCompositePreviewSrc("");
        // Make sure to restore original fill on error
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
  }, [generatedBackgroundUrl, artboardData, canvas, selectedObject]);

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
          <div className="text-[11px] text-[#9E9E9E] px-3 mb-2">Layout Assistant — Preview</div>
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

