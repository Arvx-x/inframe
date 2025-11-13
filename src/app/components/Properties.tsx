import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Mountain, Square, RotateCw, Maximize, Droplet, Minus, Layers, Palette, Lock, ChevronDown, ChevronUp, Eye, EyeOff, Plus, HelpCircle, Grid3x3, X, Link, Sun, Zap, Wand2, Trash2, Sparkles, Loader2, Move, Type, Box, Sliders, Crop, Brain, Shuffle, Paintbrush, Globe } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { FabricObject, FabricImage, filters } from "fabric";
import { toast } from "sonner";
import { EditSpace } from "@/app/components/EditSpace";

interface PropertiesData {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokePosition: string;
  cornerRadius: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textAlign: string;
  lineHeight: number;
  letterSpacingPx: number;
}

interface PropertiesProps {
  selectedObject: FabricObject | null;
  canvas: any;
  properties: PropertiesData;
  updateObject: (updates: Partial<PropertiesData>) => void;
  cropRatio: string;
  handleCropRatioChange: (ratio: string) => void;
  activeTab: "tools" | "transform" | "color";
  onDelete?: () => void;
  onImageEdit?: (newImageUrl: string) => void;
}

interface AdjustmentSliderProps {
  label: string;
  icon?: ReactNode;
  valueLabel: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

const AdjustmentSlider = ({
  label,
  icon,
  valueLabel,
  value,
  onChange,
  min,
  max,
  step,
}: AdjustmentSliderProps) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] text-[#161616]">{label}</span>
      </div>
      <span className="text-[11px] text-[#6E6E6E] font-mono">{valueLabel}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
    />
  </div>
);

// Edit Image Section Component (inline)
const EditImageSection = ({ imageElement, onEditComplete }: { imageElement: HTMLImageElement | null; onEditComplete: (newImageUrl: string) => void }) => {
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleEdit = async (prompt?: string) => {
    const finalPrompt = prompt || editPrompt;
    
    if (!finalPrompt.trim()) {
      toast.error("Please enter an edit command");
      return;
    }

    if (!imageElement) {
      toast.error("No image selected");
      return;
    }

    setIsEditing(true);

    try {
      // Convert image element to data URL
      const canvas = document.createElement('canvas');
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");
      
      ctx.drawImage(imageElement, 0, 0);
      const currentImageUrl = canvas.toDataURL('image/png');

      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, currentImageUrl, isEdit: true })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (data?.imageUrl) {
        onEditComplete(data.imageUrl);
        setEditPrompt("");
        toast.success("Image edited successfully!");
      } else {
        throw new Error("No image URL returned");
      }
    } catch (error) {
      console.error('Edit error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to edit image");
    } finally {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    }
  };

  return (
    <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
      {/* Header with dropdown button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-blue-500" />
          <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Smart Edit</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
        )}
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-[#E5E5E5] pt-3">
          {/* Image Preview */}
          {imageElement && (
            <div className="rounded-xl border border-[#E5E5E5] overflow-hidden bg-[#F5F5F5] mb-2.5">
              <img
                src={imageElement.src}
                alt="Selected image"
                className="w-full h-24 object-contain"
              />
            </div>
          )}

          {/* Text Input */}
          <div>
            <p className="text-[11px] text-[#6E6E6E] mb-1.5">Describe your edit</p>
            <Textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Make the background warmer..."
              className="min-h-[60px] resize-none text-[11px] border border-[#E5E5E5] bg-white"
              disabled={isEditing}
            />
          </div>

          {/* Apply Button */}
          <Button
            onClick={() => handleEdit()}
            disabled={isEditing || !editPrompt.trim()}
            className="w-full h-8 text-[11px] rounded-lg gap-1.5"
            size="sm"
          >
            {isEditing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                Apply Edit
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export const Properties = ({ 
  selectedObject, 
  canvas, 
  properties, 
  updateObject, 
  cropRatio, 
  handleCropRatioChange,
  activeTab,
  onDelete,
  onImageEdit
}: PropertiesProps) => {
  const [strokeVisible, setStrokeVisible] = useState(true);
  const isImage = selectedObject instanceof FabricImage;
  
  // Effects state
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const [highlights, setHighlights] = useState(0);
  const [shadows, setShadows] = useState(0);
  const [exposure, setExposure] = useState(0);
  const [vibrance, setVibrance] = useState(0);
  const [blur, setBlur] = useState(0);
  const [noise, setNoise] = useState(0);
  const [pixelate, setPixelate] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [vintage, setVintage] = useState(0);
  const [activeTool, setActiveTool] = useState<"crop" | "quickFx" | "adjustments" | "creativeDirector" | "promptRemixer" | "styleTransfer" | "sceneReimagine" | "smartEdit" | "upscale" | null>(null);
  // Prompt states for AI tools in toolbar dropdowns
  const [creativePrompt, setCreativePrompt] = useState("");
  const [remixPrompt, setRemixPrompt] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const [reimaginePrompt, setReimaginePrompt] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [smartEditPrompt, setSmartEditPrompt] = useState("");
  const [smartEditSelection, setSmartEditSelection] = useState<{
    type: "rectangle";
    imageSize: { width: number; height: number };
    rect: { x: number; y: number; width: number; height: number };
    normalized: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const runAiEditFromToolbar = async (prompt: string, selection?: any) => {
    if (!onImageEdit) return;
    if (!selectedObject || !(selectedObject instanceof FabricImage)) return;
    const imgElement = (selectedObject as FabricImage).getElement() as HTMLImageElement;
    if (!imgElement) return;

    const sanitizeSelection = (sel: typeof selection | undefined) => {
      if (!sel || !sel.rect || !imgElement.naturalWidth || !imgElement.naturalHeight) return null;
      const width = Math.max(1, Math.min(sel.rect.width, imgElement.naturalWidth));
      const height = Math.max(1, Math.min(sel.rect.height, imgElement.naturalHeight));
      if (width < 1 || height < 1) return null;
      const x = Math.max(0, Math.min(sel.rect.x, imgElement.naturalWidth - width));
      const y = Math.max(0, Math.min(sel.rect.y, imgElement.naturalHeight - height));
      const normalized = {
        x: Math.min(1, Math.max(0, x / imgElement.naturalWidth)),
        y: Math.min(1, Math.max(0, y / imgElement.naturalHeight)),
        width: Math.min(1, Math.max(0, width / imgElement.naturalWidth)),
        height: Math.min(1, Math.max(0, height / imgElement.naturalHeight)),
      };
      return {
        type: sel.type ?? "rectangle",
        imageSize: {
          width: imgElement.naturalWidth,
          height: imgElement.naturalHeight,
        },
        rect: { x, y, width, height },
        normalized,
      };
    };

    const loadImageElement = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to load image"));
        image.src = src;
      });

    const computeChangeBounds = async (
      baseImg: HTMLImageElement,
      editedImg: HTMLImageElement
    ): Promise<{ x: number; y: number; width: number; height: number } | null> => {
      const baseWidth = baseImg.naturalWidth || baseImg.width;
      const baseHeight = baseImg.naturalHeight || baseImg.height;
      const editWidth = editedImg.naturalWidth || editedImg.width;
      const editHeight = editedImg.naturalHeight || editedImg.height;
      if (baseWidth === 0 || baseHeight === 0 || editWidth === 0 || editHeight === 0) {
        return null;
      }

      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = baseWidth;
      baseCanvas.height = baseHeight;
      const baseCtx = baseCanvas.getContext('2d');
      if (!baseCtx) return null;
      baseCtx.drawImage(baseImg, 0, 0, baseWidth, baseHeight);

      const editedCanvas = document.createElement('canvas');
      editedCanvas.width = baseWidth;
      editedCanvas.height = baseHeight;
      const editedCtx = editedCanvas.getContext('2d');
      if (!editedCtx) return null;
      // Draw edited image scaled to match base dimensions if needed
      editedCtx.drawImage(editedImg, 0, 0, baseWidth, baseHeight);

      const baseData = baseCtx.getImageData(0, 0, baseWidth, baseHeight).data;
      const editedData = editedCtx.getImageData(0, 0, baseWidth, baseHeight).data;

      let minX = baseWidth;
      let minY = baseHeight;
      let maxX = -1;
      let maxY = -1;
      const threshold = 12;

      for (let i = 0; i < baseData.length; i += 4) {
        const r1 = baseData[i];
        const g1 = baseData[i + 1];
        const b1 = baseData[i + 2];
        const a1 = baseData[i + 3];

        const r2 = editedData[i];
        const g2 = editedData[i + 1];
        const b2 = editedData[i + 2];
        const a2 = editedData[i + 3];

        const diff =
          Math.abs(r1 - r2) +
          Math.abs(g1 - g2) +
          Math.abs(b1 - b2) +
          Math.abs(a1 - a2);

        if (diff > threshold) {
          const idx = i / 4;
          const x = idx % baseWidth;
          const y = Math.floor(idx / baseWidth);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < minX || maxY < minY) {
        return null;
      }

      const padding = 12;
      const rectX = Math.max(0, minX - padding);
      const rectY = Math.max(0, minY - padding);
      const rectWidth = Math.min(baseWidth - rectX, maxX - minX + 1 + padding * 2);
      const rectHeight = Math.min(baseHeight - rectY, maxY - minY + 1 + padding * 2);

      return {
        x: rectX,
        y: rectY,
        width: rectWidth,
        height: rectHeight,
      };
    };

    const normalizedPrompt = prompt.toLowerCase();
    const textIntent = (() => {
      const mentionsText =
        /\btext\b/.test(normalizedPrompt) ||
        /\btitle\b/.test(normalizedPrompt) ||
        /\bword\b/.test(normalizedPrompt) ||
        /\bsubtitle\b/.test(normalizedPrompt) ||
        /\bcaption\b/.test(normalizedPrompt) ||
        /\blettering\b/.test(normalizedPrompt) ||
        /\bheadline\b/.test(normalizedPrompt) ||
        /['"][^'"]+['"]/.test(prompt) ||
        /\breplace\b.+\bwith\b/.test(normalizedPrompt) ||
        /\bchange\b.+\bto\b/.test(normalizedPrompt) ||
        /\bwrite\b/.test(normalizedPrompt) ||
        /\badd\b.+\btext\b/.test(normalizedPrompt);
      if (!mentionsText) return null;
      const allowFontChange =
        /\bfont\b/.test(normalizedPrompt) ||
        /\btypeface\b/.test(normalizedPrompt) ||
        /\bstyle\b/.test(normalizedPrompt) ||
        /\bitalic\b/.test(normalizedPrompt) ||
        /\bbold\b/.test(normalizedPrompt);
      const allowSizeChange =
        /\bsize\b/.test(normalizedPrompt) ||
        /\bbigger\b/.test(normalizedPrompt) ||
        /\blarger\b/.test(normalizedPrompt) ||
        /\bsmaller\b/.test(normalizedPrompt) ||
        /\bscale\b/.test(normalizedPrompt);
      const allowPositionChange =
        /\bposition\b/.test(normalizedPrompt) ||
        /\bmove\b/.test(normalizedPrompt) ||
        /\balign\b/.test(normalizedPrompt) ||
        /\bcenter\b/.test(normalizedPrompt) ||
        /\balignment\b/.test(normalizedPrompt);
      return {
        intent: "text" as const,
        allowFontChange,
        allowSizeChange,
        allowPositionChange,
      };
    })();

    const clampedSelection = sanitizeSelection(selection);
    setIsAiProcessing(true);
    try {
      const canvasEl = document.createElement('canvas');
      canvasEl.width = imgElement.naturalWidth;
      canvasEl.height = imgElement.naturalHeight;
      const ctx = canvasEl.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");
      ctx.drawImage(imgElement, 0, 0);
      const currentImageUrl = canvasEl.toDataURL('image/png');
      // Base image
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          currentImageUrl,
          isEdit: true,
          selection: clampedSelection ?? null,
          editIntent: textIntent?.intent ?? null,
          textEditOptions: textIntent
            ? {
                allowFontChange: textIntent.allowFontChange,
                allowSizeChange: textIntent.allowSizeChange,
                allowPositionChange: textIntent.allowPositionChange,
              }
            : null,
          selectionImageUrl: (() => {
            try {
              if (!clampedSelection?.rect) return null;
              const { x, y, width, height } = clampedSelection.rect;
              const off = document.createElement('canvas');
              // Limit very large crops to keep payload reasonable
              const MAX_SIDE = 1536;
              const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
              off.width = Math.max(1, Math.round(width * scale));
              off.height = Math.max(1, Math.round(height * scale));
              const c = off.getContext('2d');
              if (!c) return null;
              c.imageSmoothingEnabled = true;
              c.imageSmoothingQuality = 'high';
              c.drawImage(
                imgElement,
                x, y, width, height,
                0, 0, off.width, off.height
              );
              return off.toDataURL('image/png');
            } catch {
              return null;
            }
          })()
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data?.imageUrl) {
        let finalImageUrl = data.imageUrl;
        if (clampedSelection) {
          try {
            const [baseImage, editedImage] = await Promise.all([
              loadImageElement(currentImageUrl),
              loadImageElement(data.imageUrl),
            ]);
            const baseWidth = baseImage.naturalWidth || baseImage.width;
            const baseHeight = baseImage.naturalHeight || baseImage.height;
            const editWidth = editedImage.naturalWidth || editedImage.width;
            const editHeight = editedImage.naturalHeight || editedImage.height;
            const changeBounds = await computeChangeBounds(baseImage, editedImage);
            const fallbackRect = clampedSelection.rect;
            const patch = changeBounds || fallbackRect;
            const { x, y, width, height } = patch;

            if (baseWidth > 0 && baseHeight > 0 && width > 0 && height > 0) {
              const compositeCanvas = document.createElement('canvas');
              compositeCanvas.width = baseWidth;
              compositeCanvas.height = baseHeight;
              const compositeCtx = compositeCanvas.getContext('2d');
              if (compositeCtx) {
                compositeCtx.drawImage(baseImage, 0, 0, baseWidth, baseHeight);
                const ratioX = editWidth / baseWidth || 1;
                const ratioY = editHeight / baseHeight || 1;
                const srcX = Math.max(0, Math.round(x * ratioX));
                const srcY = Math.max(0, Math.round(y * ratioY));
                const srcW = Math.max(1, Math.round(width * ratioX));
                const srcH = Math.max(1, Math.round(height * ratioY));
                const safeSrcW = Math.max(1, Math.min(srcW, editWidth - srcX));
                const safeSrcH = Math.max(1, Math.min(srcH, editHeight - srcY));
                const destW = Math.max(1, Math.min(width, baseWidth - x));
                const destH = Math.max(1, Math.min(height, baseHeight - y));
                compositeCtx.drawImage(
                  editedImage,
                  srcX,
                  srcY,
                  safeSrcW,
                  safeSrcH,
                  x,
                  y,
                  destW,
                  destH
                );
                finalImageUrl = compositeCanvas.toDataURL('image/png');
              }
            }
          } catch (err) {
            console.error("Smart edit compositing failed:", err);
          }
        }
        onImageEdit(finalImageUrl);
        if (clampedSelection) {
          setSmartEditSelection(clampedSelection);
        }
        toast.success("Smart Edit applied to selected region");
      }
    } catch (e) {
      console.error("Smart Edit failed:", e);
      toast.error("Smart Edit failed. Please try again.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Initialize effects from object
  useEffect(() => {
    if (isImage && selectedObject) {
      const img = selectedObject as FabricImage;
      // Initialize opacity
      setOpacity(Math.round((img.opacity || 1) * 100));
      if (img.filters) {
        img.filters.forEach((filter: any) => {
          if (filter.type === 'Brightness') setBrightness(filter.brightness || 0);
          if (filter.type === 'Contrast') setContrast(filter.contrast || 0);
          if (filter.type === 'Saturation') setSaturation(filter.saturation || 0);
          if (filter.type === 'Blur') setBlur(filter.blur || 0);
          if (filter.type === 'Noise') setNoise(filter.noise || 0);
          if (filter.type === 'Pixelate') setPixelate(filter.blocksize || 0);
        });
      }
    }
  }, [selectedObject, isImage]);

  // Apply effects
  const applyEffects = () => {
    if (!isImage || !selectedObject || !canvas) return;
    const img = selectedObject as FabricImage;
    
    // Don't preserve color picker filters - color picker doesn't apply to images anymore
    img.filters = [];
    
    // Apply effect filters
    if (brightness !== 0) {
      img.filters.push(new filters.Brightness({ brightness }));
    }
    if (contrast !== 0) {
      img.filters.push(new filters.Contrast({ contrast }));
    }
    if (saturation !== 0) {
      img.filters.push(new filters.Saturation({ saturation }));
    }
    if (blur > 0) {
      img.filters.push(new filters.Blur({ blur: blur / 10 }));
    }
    if (noise > 0) {
      img.filters.push(new filters.Noise({ noise: noise / 100 }));
    }
    if (pixelate > 0) {
      img.filters.push(new filters.Pixelate({ blocksize: pixelate }));
    }
    if (sepia > 0) {
      img.filters.push(new filters.Sepia({ amount: sepia / 100 }));
    }
    if (vintage > 0) {
      // Vintage is a combination of sepia and noise
      img.filters.push(new filters.Sepia({ amount: vintage / 200 }));
      img.filters.push(new filters.Noise({ noise: vintage / 100 }));
    }
    
    // Exposure and Vibrance - approximate with brightness/contrast/saturation
    if (exposure !== 0) {
      const brightnessAdjust = (exposure / 100) * 0.5;
      img.filters.push(new filters.Brightness({ brightness: brightnessAdjust }));
    }
    if (vibrance !== 0) {
      const saturationAdjust = (vibrance / 100) * 0.3;
      img.filters.push(new filters.Saturation({ saturation: saturationAdjust }));
    }
    
    // Highlights and Shadows - approximate with brightness
    if (highlights !== 0) {
      const brightnessAdjust = (highlights / 100) * 0.3;
      img.filters.push(new filters.Brightness({ brightness: brightnessAdjust }));
    }
    if (shadows !== 0) {
      const brightnessAdjust = (-shadows / 100) * 0.3;
      img.filters.push(new filters.Brightness({ brightness: brightnessAdjust }));
    }
    
    img.applyFilters();
    canvas.renderAll();
  };

  // Apply opacity separately
  useEffect(() => {
    if (isImage && selectedObject && canvas) {
      const img = selectedObject as FabricImage;
      img.set({ opacity: opacity / 100 });
      canvas.renderAll();
    }
  }, [opacity, isImage, selectedObject, canvas]);

  useEffect(() => {
    if (isImage && selectedObject && canvas) {
      applyEffects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brightness, contrast, saturation, highlights, shadows, exposure, vibrance, blur, noise, pixelate, sepia, vintage, isImage]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {activeTab === "tools" ? (
        <>
          {/* Fixed EditSpace at Top */}
          <EditSpace
            tool={activeTool}
            isImage={isImage}
            cropRatio={cropRatio}
            handleCropRatioChange={handleCropRatioChange}
            onSmartEditSelectionChange={setSmartEditSelection}
            adjustments={{
              brightness,
              contrast,
              saturation,
              highlights,
              shadows,
              exposure,
              vibrance,
              blur,
              noise,
              pixelate,
              sepia,
              vintage,
              opacity,
              setBrightness,
              setContrast,
              setSaturation,
              setHighlights,
              setShadows,
              setExposure,
              setVibrance,
              setBlur,
              setNoise,
              setPixelate,
              setSepia,
              setVintage,
              setOpacity,
            }}
            selectedObject={selectedObject}
            canvas={canvas}
            onImageEdit={onImageEdit}
          />
          {/* Scrollable Tools Section Below */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-track]:hidden [&::-webkit-scrollbar-thumb]:hidden">
            <div className="space-y-2.5">
              {/* Crop Section */}
            <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                <button
                onClick={() => setActiveTool(activeTool==='crop'? null : 'crop')}
                className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                >
                  <div className="flex items-center gap-2">
                  <Crop className="w-4 h-4 text-[#3B82F6]" />
                    <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Crop</span>
                  </div>
                  {activeTool === 'crop' ? (
                    <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                  )}
                </button>
              <div
                className={`overflow-hidden transition-all ${activeTool === 'crop' ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                style={{ transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 250ms cubic-bezier(0.4,0,0.2,1)' }}
              >
                <div className="pt-2 px-3 pb-3 space-y-2">
                  <div className="text-[11px] text-[#6E6E6E]">Aspect ratio</div>
                  <div className="flex items-center gap-1.5">
                    <Select value={cropRatio} onValueChange={handleCropRatioChange}>
                      <SelectTrigger className="h-7 flex-1 text-[11px] border border-[#E5E5E5] bg-white hover:border-[#D1D1D1] focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded text-[#161616]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="1:1">1:1 (Square)</SelectItem>
                        <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                        <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                        <SelectItem value="3:2">3:2 (Photo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-[10px] text-[#9E9E9E]">Use the crop handles in the workspace to refine the selection.</div>
                </div>
              </div>
              </div>

              {/* Quick FX Section */}
              {isImage && (
              <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                  <button
                  onClick={() => setActiveTool(activeTool==='quickFx'? null : 'quickFx')}
                  className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#3B82F6]" />
                      <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Quick FX</span>
                    </div>
                    {activeTool === 'quickFx' ? (
                      <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                    )}
                  </button>
                <div
                  className={`overflow-hidden transition-all ${activeTool === 'quickFx' ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                  style={{ transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 250ms cubic-bezier(0.4,0,0.2,1)' }}
                >
                  <div className="pt-2 px-3 pb-3 space-y-2">
                    <div className="text-[11px] text-[#6E6E6E]">Choose a look</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button variant="outline" size="sm" className="h-8 text-[11px] px-2"
                        onClick={() => { setBrightness(0); setContrast(0); setSaturation(0); setHighlights(0); setShadows(0); setExposure(0); setVibrance(0); setBlur(0); setNoise(0); setPixelate(0); setSepia(0); setVintage(0); setOpacity(100); }}>
                        Original
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-[11px] px-2"
                        onClick={() => { setBrightness(0.1); setContrast(0.05); setSaturation(0.15); setVibrance(25); setHighlights(10); setShadows(-5); setExposure(10); setBlur(0); setNoise(0); setPixelate(0); setSepia(0); setVintage(0); }}>
                        Warm Glow
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-[11px] px-2"
                        onClick={() => { setBrightness(-0.05); setContrast(0.15); setSaturation(-0.1); setVibrance(-15); setHighlights(-10); setShadows(20); setExposure(-5); setBlur(0); setNoise(100); setPixelate(0); setSepia(20); setVintage(40); }}>
                        Vintage Fade
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-[11px] px-2"
                        onClick={() => { setBrightness(0); setContrast(0.25); setSaturation(0.05); setVibrance(10); setHighlights(5); setShadows(30); setExposure(5); setBlur(0); setNoise(0); setPixelate(0); setSepia(0); setVintage(0); }}>
                        Dramatic
                      </Button>
                    </div>
                  </div>
                </div>
                </div>
              )}

              {/* Adjustments Section */}
              {isImage && (
              <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                  <button
                  onClick={() => setActiveTool(activeTool==='adjustments'? null : 'adjustments')}
                  className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#3B82F6]" />
                      <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Adjustments</span>
                    </div>
                    {activeTool === 'adjustments' ? (
                      <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                    )}
                  </button>
                <div
                  className={`overflow-hidden transition-all ${activeTool === 'adjustments' ? 'max-h-[700px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                  style={{ transition: 'max-height 280ms cubic-bezier(0.4,0,0.2,1), opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 280ms cubic-bezier(0.4,0,0.2,1)' }}
                >
                  <div className="pt-2 px-3 pb-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-[#6E6E6E]">Fine-tune the image.</p>
                      <button
                        className="h-7 px-2 text-[11px] border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors"
                        onClick={() => { setBrightness(0); setContrast(0); setSaturation(0); setHighlights(0); setShadows(0); setExposure(0); setVibrance(0); setOpacity(100); }}>
                        Reset
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      <AdjustmentSlider label="Brightness" icon={<Sun className="w-3 h-3 text-[#6E6E6E]" />} valueLabel={`${Math.round(brightness * 100)}%`} min={-1} max={1} step={0.01} value={brightness} onChange={setBrightness} />
                      <AdjustmentSlider label="Contrast" icon={<Zap className="w-3 h-3 text-[#6E6E6E]" />} valueLabel={`${Math.round(contrast * 100)}%`} min={-1} max={1} step={0.01} value={contrast} onChange={setContrast} />
                      <AdjustmentSlider label="Saturation" icon={<Droplet className="w-3 h-3 text-[#6E6E6E]" />} valueLabel={`${Math.round(saturation * 100)}%`} min={-1} max={1} step={0.01} value={saturation} onChange={setSaturation} />
                      <AdjustmentSlider label="Highlights" valueLabel={`${Math.round(highlights)}`} min={-100} max={100} step={1} value={highlights} onChange={setHighlights} />
                      <AdjustmentSlider label="Shadows" valueLabel={`${Math.round(shadows)}`} min={-100} max={100} step={1} value={shadows} onChange={setShadows} />
                      <AdjustmentSlider label="Exposure" valueLabel={`${Math.round(exposure)}`} min={-100} max={100} step={1} value={exposure} onChange={setExposure} />
                      <AdjustmentSlider label="Vibrance" valueLabel={`${Math.round(vibrance)}`} min={-100} max={100} step={1} value={vibrance} onChange={setVibrance} />
                      <AdjustmentSlider label="Opacity" icon={<Eye className="w-3 h-3 text-[#6E6E6E]" />} valueLabel={`${Math.round(opacity)}%`} min={0} max={100} step={1} value={opacity} onChange={setOpacity} />
                    </div>
                  </div>
                </div>
                </div>
              )}

              {/* AI-Powered Tools */}
              {isImage && (
                <>
                  {/* Smart Edit (moved above Creative Director) */}
                  {onImageEdit && (
                  <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                      <button
                        onClick={() => setActiveTool(activeTool==='smartEdit'? null : 'smartEdit')}
                        className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-[#3B82F6]" />
                          <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Smart Edit</span>
                        </div>
                        {activeTool === 'smartEdit' ? (
                          <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                        )}
                      </button>
                    <div
                      className={`overflow-hidden transition-all ${activeTool === 'smartEdit' ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                      style={{ transition: 'max-height 240ms cubic-bezier(0.4,0,0.2,1), opacity 180ms cubic-bezier(0.4,0,0.2,1), transform 240ms cubic-bezier(0.4,0,0.2,1)' }}
                    >
                      <div className="pt-2 px-3 pb-3 space-y-2">
                        <div>
                          <p className="text-[11px] text-[#6E6E6E] mb-1.5">Describe your edit</p>
                          <Textarea
                            value={smartEditPrompt}
                            onChange={(e) => setSmartEditPrompt(e.target.value)}
                            placeholder="e.g., Make the background warmer..."
                            className="min-h-[96px] pt-3 resize-none text-[11px] border border-[#E5E5E5] bg-white rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-track]:hidden [&::-webkit-scrollbar-thumb]:hidden focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            disabled={isAiProcessing}
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (!smartEditSelection) {
                              toast.error("Draw a selection on the canvas.");
                              return;
                            }
                            runAiEditFromToolbar(smartEditPrompt, smartEditSelection);
                          }}
                          disabled={isAiProcessing || !smartEditPrompt.trim()}
                          className="w-full h-8 text-[11px] rounded-lg gap-1.5"
                          size="sm"
                        >
                          {isAiProcessing ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            "Apply Edit"
                          )}
                        </Button>
                        {!smartEditSelection && (
                          <div className="text-[10px] text-[#9E9E9E]">Tip: Drag on the canvas to select a region.</div>
                        )}
                      </div>
                    </div>
                    </div>
                  )}
                  {/* Creative Director */}
                <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                    <button
                    onClick={() => setActiveTool(activeTool==='creativeDirector'? null : 'creativeDirector')}
                    className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-[#3B82F6]" />
                        <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Creative Director</span>
                      </div>
                      {activeTool === 'creativeDirector' ? (
                        <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                      )}
                    </button>
                  <div
                    className={`overflow-hidden transition-all ${activeTool === 'creativeDirector' ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                    style={{ transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 250ms cubic-bezier(0.4,0,0.2,1)' }}
                  >
                    <div className="pt-2 px-3 pb-3 space-y-2">
                      <div className="text-[11px] text-[#6E6E6E]">Describe the direction to apply.</div>
                      <Textarea value={creativePrompt} onChange={(e)=>setCreativePrompt(e.target.value)} placeholder="e.g., cinematic mood, dramatic lighting" className="min-h-[60px] resize-none text-[11px] border border-[#E5E5E5] bg-white" disabled={isAiProcessing} />
                      <Button className="w-full h-8 text-[11px] rounded-lg gap-1.5" size="sm" disabled={isAiProcessing || !creativePrompt.trim()} onClick={()=>runAiEditFromToolbar(creativePrompt)}>
                        {isAiProcessing ? (<><Loader2 className="w-3 h-3 animate-spin" />Processing...</>) : (<><Brain className="w-3 h-3" />Apply Direction</>)}
                      </Button>
                    </div>
                  </div>
                  </div>

                  {/* Prompt Remixer */}
                <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                    <button
                    onClick={() => setActiveTool(activeTool==='promptRemixer'? null : 'promptRemixer')}
                    className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                      <Shuffle className="w-4 h-4 text-[#3B82F6]" />
                        <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Prompt Remixer</span>
                      </div>
                      {activeTool === 'promptRemixer' ? (
                        <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                      )}
                    </button>
                  <div
                    className={`overflow-hidden transition-all ${activeTool === 'promptRemixer' ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                    style={{ transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 250ms cubic-bezier(0.4,0,0.2,1)' }}
                  >
                    <div className="pt-2 px-3 pb-3 space-y-2">
                      <div className="text-[11px] text-[#6E6E6E]">Describe how to remix the image.</div>
                      <Textarea value={remixPrompt} onChange={(e)=>setRemixPrompt(e.target.value)} placeholder="e.g., watercolor look, vintage film" className="min-h-[60px] resize-none text-[11px] border border-[#E5E5E5] bg-white" disabled={isAiProcessing} />
                      <Button className="w-full h-8 text-[11px] rounded-lg gap-1.5" size="sm" disabled={isAiProcessing || !remixPrompt.trim()} onClick={()=>runAiEditFromToolbar(remixPrompt)}>
                        {isAiProcessing ? (<><Loader2 className="w-3 h-3 animate-spin" />Remixing...</>) : (<><Shuffle className="w-3 h-3" />Remix Image</>)}
                      </Button>
                    </div>
                  </div>
                  </div>

                  {/* Style Transfer */}
                <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                    <button
                    onClick={() => setActiveTool(activeTool==='styleTransfer'? null : 'styleTransfer')}
                    className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                      <Paintbrush className="w-4 h-4 text-[#3B82F6]" />
                        <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Style Transfer</span>
                      </div>
                      {activeTool === 'styleTransfer' ? (
                        <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                      )}
                    </button>
                  <div
                    className={`overflow-hidden transition-all ${activeTool === 'styleTransfer' ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                    style={{ transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 250ms cubic-bezier(0.4,0,0.2,1)' }}
                  >
                    <div className="pt-2 px-3 pb-3 space-y-2">
                      <div className="text-[11px] text-[#6E6E6E]">Describe the artistic style to apply.</div>
                      <Textarea value={stylePrompt} onChange={(e)=>setStylePrompt(e.target.value)} placeholder="e.g., Van Gogh’s Starry Night" className="min-h-[60px] resize-none text-[11px] border border-[#E5E5E5] bg-white" disabled={isAiProcessing} />
                      <Button className="w-full h-8 text-[11px] rounded-lg gap-1.5" size="sm" disabled={isAiProcessing || !stylePrompt.trim()} onClick={()=>runAiEditFromToolbar(stylePrompt)}>
                        {isAiProcessing ? (<><Loader2 className="w-3 h-3 animate-spin" />Applying...</>) : (<><Paintbrush className="w-3 h-3" />Apply Style</>)}
                      </Button>
                    </div>
                  </div>
                  </div>

                  {/* Scene Reimagine */}
                <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                    <button
                    onClick={() => setActiveTool(activeTool==='sceneReimagine'? null : 'sceneReimagine')}
                    className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#3B82F6]" />
                        <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Scene Reimagine</span>
                      </div>
                      {activeTool === 'sceneReimagine' ? (
                        <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                      )}
                    </button>
                  <div
                    className={`overflow-hidden transition-all ${activeTool === 'sceneReimagine' ? 'max-h-[500px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                    style={{ transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1), opacity 200ms cubic-bezier(0.4,0,0.2,1), transform 250ms cubic-bezier(0.4,0,0.2,1)' }}
                  >
                    <div className="pt-2 px-3 pb-3 space-y-2">
                      <div className="text-[11px] text-[#6E6E6E]">Describe how to reimagine the scene.</div>
                      <Textarea value={reimaginePrompt} onChange={(e)=>setReimaginePrompt(e.target.value)} placeholder="e.g., golden hour, winter snow" className="min-h-[60px] resize-none text-[11px] border border-[#E5E5E5] bg-white" disabled={isAiProcessing} />
                      <Button className="w-full h-8 text-[11px] rounded-lg gap-1.5" size="sm" disabled={isAiProcessing || !reimaginePrompt.trim()} onClick={()=>runAiEditFromToolbar(reimaginePrompt)}>
                        {isAiProcessing ? (<><Loader2 className="w-3 h-3 animate-spin" />Reimagining...</>) : (<><Globe className="w-3 h-3" />Reimagine Scene</>)}
                      </Button>
                    </div>
                  </div>
                  </div>
                </>
              )}

              {/* Smart Edit (was moved above) */}

              {/* Upscale Section */}
              {isImage && (
                <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl mb-2.5">
                  <button
                    onClick={() => setActiveTool(activeTool==='upscale'? null : 'upscale')}
                    className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#F5F5F5] transition-colors rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Mountain className="w-4 h-4 text-[#3B82F6]" />
                      <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Upscale</span>
                    </div>
                    {activeTool === 'upscale' ? (
                      <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
                    )}
                  </button>
                <div
                  className={`overflow-hidden transition-all ${activeTool === 'upscale' ? 'max-h-[400px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}
                  style={{ transition: 'max-height 240ms cubic-bezier(0.4,0,0.2,1), opacity 180ms cubic-bezier(0.4,0,0.2,1), transform 240ms cubic-bezier(0.4,0,0.2,1)' }}
                >
                  <div className="pt-2 px-3 pb-3 space-y-2">
                    <p className="text-[11px] text-[#6E6E6E]">Upscale image quality and sharpen details.</p>
                    <Button className="w-full h-8 text-[11px] rounded-lg gap-1.5" size="sm">
                      <Sparkles className="w-3 h-3" />
                      Upscale Image
                    </Button>
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full h-8 text-[11px]">
                        Sharpen Image
                      </Button>
                      <Button variant="outline" size="sm" className="w-full h-8 text-[11px]">
                        Reduce Noise
                      </Button>
                      <Button variant="outline" size="sm" className="w-full h-8 text-[11px]">
                        2× Super-Resolution
                      </Button>
                    </div>
                  </div>
                </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Transform Tab Content */
        <div className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-track]:hidden [&::-webkit-scrollbar-thumb]:hidden">
          <div className="space-y-2.5">
        {/* Position Section */}
        <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl px-3 py-2.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <Move className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Position</span>
          </div>
          
          {/* Alignment icons - 6 greyed out icons in 2 rows */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {/* Align Left */}
            <button className="w-8 h-8 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none">
                <path d="M2 4H10M2 8H10M2 12H10" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Align Center Horizontal */}
            <button className="w-8 h-8 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none">
                <path d="M3 4H13M3 8H13M3 12H13" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Align Right */}
            <button className="w-8 h-8 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none">
                <path d="M6 4H14M6 8H14M6 12H14" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Align Top */}
            <button className="w-8 h-8 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none">
                <path d="M4 2V10M8 2V10M12 2V10" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Align Center Vertical */}
            <button className="w-8 h-8 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none">
                <path d="M4 3V13M8 3V13M12 3V13" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Align Bottom */}
            <button className="w-8 h-8 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none">
                <path d="M4 6V14M8 6V14M12 6V14" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* X and Y Position */}
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

          {/* Rotation with flip icons */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white">
              <RotateCw className="w-3 h-3 text-[#6E6E6E] ml-2" />
              <Input
                type="number"
                value={Math.round(properties.rotation)}
                onChange={(e) => updateObject({ rotation: Number(e.target.value) })}
                className="h-7 w-16 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                placeholder="0"
                style={{ fontSize: '13px' }}
              />
              <span className="text-[11px] text-[#6E6E6E] pr-2">°</span>
            </div>
            <button className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L2 8L8 14M14 2L8 8L14 14" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none">
                <path d="M2 8L8 2L14 8M2 8L8 14L14 8" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Layout Section */}
        <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl px-3 py-2.5 space-y-2.5">
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

        {/* Border Section */}
        <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl px-3 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Border</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
                <Grid3x3 className="w-4.5 h-4.5 text-[#6E6E6E]" />
              </button>
              <button className="w-7 h-7 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
                <Plus className="w-4.5 h-4.5 text-[#6E6E6E]" />
              </button>
            </div>
          </div>
          
          {/* Border Width */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white">
              <Minus className="w-4 h-4 text-[#6E6E6E] ml-2" />
              <Input
                type="number"
                value={properties.strokeWidth}
                onChange={(e) => updateObject({ strokeWidth: Number(e.target.value) })}
                className="h-7 w-14 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                min={0}
                max={50}
                style={{ fontSize: '13px' }}
              />
            </div>
            {/* Link icon */}
            <button className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <Link className="w-4.5 h-4.5 text-[#6E6E6E]" />
            </button>
            {/* Dashed square icon */}
            <button className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <svg className="w-4.5 h-4.5" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1" strokeDasharray="2 2"/>
              </svg>
            </button>
          </div>

          {/* Border Position */}
          <div className="flex items-center gap-2">
            <Select value={properties.strokePosition} onValueChange={(value) => updateObject({ strokePosition: value })}>
              <SelectTrigger className="h-7 flex-1 text-[11px] border border-[#E5E5E5] bg-white hover:border-[#D1D1D1] focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded text-[#161616]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inside">Inside</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="outside">Outside</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Border Color */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white flex-1">
              <div 
                className="h-6 w-6 rounded border border-[#D1D1D1] cursor-pointer flex-shrink-0 ml-1"
                style={{ backgroundColor: properties.stroke }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'color';
                  input.value = properties.stroke;
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    updateObject({ stroke: target.value });
                  };
                  input.click();
                }}
              />
              <Input
                type="text"
                value={properties.stroke.startsWith('#') ? properties.stroke.toUpperCase() : `#${properties.stroke.toUpperCase()}`}
                onChange={(e) => {
                  let value = e.target.value;
                  value = value.replace('#', '');
                  updateObject({ stroke: value ? `#${value.toUpperCase()}` : '#000000' });
                }}
                className="h-7 text-[11px] bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 flex-1 text-[#161616]"
                placeholder="#000000"
              />
              <span className="text-[11px] text-[#6E6E6E] pr-2">100%</span>
            </div>
            <button 
              className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors"
              onClick={() => setStrokeVisible(!strokeVisible)}
            >
              {strokeVisible ? <Eye className="w-4.5 h-4.5 text-[#6E6E6E]" /> : <EyeOff className="w-4.5 h-4.5 text-[#6E6E6E]" />}
            </button>
            <button className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <X className="w-4.5 h-4.5 text-[#6E6E6E]" />
            </button>
          </div>
        </div>
          </div>
        </div>
      )}
    </div>
  );
};
