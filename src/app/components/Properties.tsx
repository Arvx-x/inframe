import { useState, useEffect } from "react";
import { Mountain, Square, RotateCw, Maximize, Droplet, Minus, Layers, Palette, Lock, ChevronDown, ChevronUp, Eye, EyeOff, Plus, HelpCircle, Grid3x3, X, Link, Sun, Zap, Wand2, Trash2, Sparkles, Loader2, Move, Type, Box, Sliders, Crop } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { FabricObject, FabricImage, filters } from "fabric";
import { toast } from "sonner";

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
    <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg mb-2.5">
      {/* Header with dropdown button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#F5F5F5] transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Smart Edit</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-[#6E6E6E]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[#6E6E6E]" />
        )}
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-3 pb-2.5 space-y-2.5 border-t border-[#E5E5E5] pt-2.5">
          {/* Image Preview */}
          {imageElement && (
            <div className="rounded-lg border border-[#E5E5E5] overflow-hidden bg-[#F5F5F5] mb-2.5">
              <img
                src={imageElement.src}
                alt="Selected image"
                className="w-full h-24 object-contain"
              />
            </div>
          )}

          {/* Text Input */}
          <div>
            <p className="text-[10px] text-[#6E6E6E] mb-1.5">Describe your edit</p>
            <Textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Make the background warmer..."
              className="min-h-[60px] resize-none text-[10px] border border-[#E5E5E5] bg-white"
              disabled={isEditing}
            />
          </div>

          {/* Apply Button */}
          <Button
            onClick={() => handleEdit()}
            disabled={isEditing || !editPrompt.trim()}
            className="w-full h-7 text-[10px] rounded-lg gap-1.5"
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
    <div className="flex-1 overflow-y-auto bg-white [scrollbar-width:thin] [scrollbar-color:#D1D1D1_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#D1D1D1] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
      <div className="px-3 py-3 space-y-2.5">
        {/* Transform Tab Content */}
        {activeTab === "transform" && (
          <>
        {/* Position Section */}
        <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
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

        {/* Border Section */}
        <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
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
          </>
        )}

        {/* Tools Tab Content */}
        {activeTab === "tools" && isImage && (
          <>
          {/* Basic Adjustments */}
          <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Basic Adjustments</div>
              <button 
                onClick={() => {
                  setBrightness(0); setContrast(0); setSaturation(0); setOpacity(100);
                  applyEffects();
                }}
                className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-[#6E6E6E]" />
              </button>
            </div>
            
            {/* Brightness */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sun className="w-3 h-3 text-[#6E6E6E]" />
                  <span className="text-[10px] text-[#161616]">Brightness</span>
                </div>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(brightness * 100)}%</span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>

            {/* Contrast */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-[#6E6E6E]" />
                  <span className="text-[10px] text-[#161616]">Contrast</span>
                </div>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(contrast * 100)}%</span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>

            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Droplet className="w-3 h-3 text-[#6E6E6E]" />
                  <span className="text-[10px] text-[#161616]">Saturation</span>
                </div>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(saturation * 100)}%</span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={saturation}
                onChange={(e) => setSaturation(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>

            {/* Opacity */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3 h-3 text-[#6E6E6E]" />
                  <span className="text-[10px] text-[#161616]">Opacity</span>
                </div>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(opacity)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>
          </div>

          {/* Light & Color */}
          <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Light & Color</div>
              <button 
                onClick={() => {
                  setHighlights(0); setShadows(0); setExposure(0); setVibrance(0);
                  applyEffects();
                }}
                className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-[#6E6E6E]" />
              </button>
            </div>
            
            {/* Highlights */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#161616]">Highlights</span>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(highlights)}</span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={highlights}
                onChange={(e) => setHighlights(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>

            {/* Shadows */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#161616]">Shadows</span>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(shadows)}</span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={shadows}
                onChange={(e) => setShadows(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>

            {/* Exposure */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#161616]">Exposure</span>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(exposure)}</span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={exposure}
                onChange={(e) => setExposure(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>

            {/* Vibrance */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Wand2 className="w-3 h-3 text-[#6E6E6E]" />
                  <span className="text-[10px] text-[#161616]">Vibrance</span>
                </div>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(vibrance)}</span>
              </div>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={vibrance}
                onChange={(e) => setVibrance(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>
          </div>

          {/* Effects */}
          <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Effects</div>
              <button 
                onClick={() => {
                  setBlur(0); setNoise(0); setPixelate(0); setSepia(0); setVintage(0);
                  applyEffects();
                }}
                className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-[#6E6E6E]" />
              </button>
            </div>
            
            {/* Blur */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-[#6E6E6E]" />
                  <span className="text-[10px] text-[#161616]">Blur</span>
                </div>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(blur)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={blur}
                onChange={(e) => setBlur(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>

            {/* Noise */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#161616]">Noise</span>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(noise)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                step={10}
                value={noise}
                onChange={(e) => setNoise(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>

            {/* Pixelate */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#161616]">Pixelate</span>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(pixelate)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={pixelate}
                onChange={(e) => setPixelate(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>

            {/* Sepia */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#161616]">Sepia</span>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(sepia)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={sepia}
                onChange={(e) => setSepia(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>

            {/* Vintage */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#161616]">Vintage</span>
                <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(vintage)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={vintage}
                onChange={(e) => setVintage(Number(e.target.value))}
                className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
              />
            </div>
          </div>
          </>
        )}

        {/* Tools Tab Content */}
        {activeTab === "tools" && (
          <>
        {/* Edit Image Section */}
        {isImage && onImageEdit && (() => {
          const imgElement = (selectedObject as FabricImage)?.getElement();
          return imgElement ? (
            <EditImageSection 
              imageElement={imgElement as HTMLImageElement}
              onEditComplete={onImageEdit}
            />
          ) : null;
        })()}
        
        {/* Crop Section */}
        <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Crop</div>
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
              <Maximize className="w-4 h-4 text-[#6E6E6E]" />
            </button>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Select value={cropRatio} onValueChange={handleCropRatioChange}>
              <SelectTrigger className="h-6 flex-1 text-[10px] border border-[#E5E5E5] bg-white hover:border-[#D1D1D1] focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded text-[#161616]">
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
        </div>
          </>
        )}
      </div>
    </div>
  );
};
