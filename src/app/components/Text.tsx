import { useState, useEffect } from "react";
import { 
  Type, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Bold, Italic, Underline, RotateCw, Eye, EyeOff, Plus, 
  X, Layers, Sparkles, Trash2, ChevronDown, FlipHorizontal, FlipVertical,
  Grid3x3, ArrowUp, ArrowDown, MoreVertical, Move, Box, Minus
} from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { FabricObject, Textbox as FabricTextbox } from "fabric";

interface TextData {
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
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textAlign: string;
  lineHeight: number;
  letterSpacingPx: number;
}

interface TextProps {
  selectedObject: FabricObject | null;
  canvas: any;
  properties: TextData;
  updateObject: (updates: Partial<TextData>) => void;
  activeTab: "tools" | "transform" | "color";
  onDelete?: () => void;
}

// Professional font list - Google Fonts and system fonts
const FONT_LIST = [
  { name: "Inter", category: "Sans Serif" },
  { name: "Roboto", category: "Sans Serif" },
  { name: "Open Sans", category: "Sans Serif" },
  { name: "Lato", category: "Sans Serif" },
  { name: "Montserrat", category: "Sans Serif" },
  { name: "Poppins", category: "Sans Serif" },
  { name: "Raleway", category: "Sans Serif" },
  { name: "Ubuntu", category: "Sans Serif" },
  { name: "Work Sans", category: "Sans Serif" },
  { name: "Nunito", category: "Sans Serif" },
  { name: "Plus Jakarta Sans", category: "Sans Serif" },
  { name: "DM Sans", category: "Sans Serif" },
  { name: "Space Grotesk", category: "Sans Serif" },
  { name: "Manrope", category: "Sans Serif" },
  { name: "Outfit", category: "Sans Serif" },
  { name: "Sora", category: "Sans Serif" },
  { name: "Lexend", category: "Sans Serif" },
  { name: "Merriweather", category: "Serif" },
  { name: "Playfair Display", category: "Serif" },
  { name: "Lora", category: "Serif" },
  { name: "PT Serif", category: "Serif" },
  { name: "Crimson Text", category: "Serif" },
  { name: "Source Serif Pro", category: "Serif" },
  { name: "EB Garamond", category: "Serif" },
  { name: "Cormorant", category: "Serif" },
  { name: "Libre Baskerville", category: "Serif" },
  { name: "Spectral", category: "Serif" },
  { name: "JetBrains Mono", category: "Monospace" },
  { name: "Fira Code", category: "Monospace" },
  { name: "Source Code Pro", category: "Monospace" },
  { name: "IBM Plex Mono", category: "Monospace" },
  { name: "Roboto Mono", category: "Monospace" },
  { name: "Space Mono", category: "Monospace" },
  { name: "Pacifico", category: "Display" },
  { name: "Bebas Neue", category: "Display" },
  { name: "Righteous", category: "Display" },
  { name: "Archivo Black", category: "Display" },
  { name: "Abril Fatface", category: "Display" },
  { name: "Caveat", category: "Handwriting" },
  { name: "Dancing Script", category: "Handwriting" },
  { name: "Satisfy", category: "Handwriting" },
];

// Helper function to apply vertical alignment to textbox
const applyVerticalAlignment = (textbox: FabricTextbox, align: 'top' | 'middle' | 'bottom') => {
  // Store alignment
  (textbox as any).verticalAlign = align;
  
  // Get text dimensions for offset calculation
  const boxHeight = textbox.height || 0;
  const fontSize = textbox.fontSize || 32;
  const lineHeight = (textbox.lineHeight || 1.2) * fontSize;
  const textLines = (textbox.text || '').split('\n') || [''];
  const numLines = Math.max(1, textLines.filter(line => line.trim().length > 0).length || 1);
  const actualTextHeight = numLines * lineHeight;
  
  // Calculate vertical offset
  let textTopOffset = 0;
  if (align === 'middle') {
    textTopOffset = Math.max(0, (boxHeight - actualTextHeight) / 2);
  } else if (align === 'bottom') {
    textTopOffset = Math.max(0, boxHeight - actualTextHeight);
  }
  
  (textbox as any).__textTopOffset = textTopOffset;
  
  // Override _renderText method to apply vertical alignment
  // This needs to work with Fabric.js's transformation matrix
  if (!(textbox as any).__verticalAlignPatched) {
    (textbox as any).__verticalAlignPatched = true;
    const originalRenderText = (textbox as any)._renderText;
    
    (textbox as any)._renderText = function(ctx: CanvasRenderingContext2D) {
      const offset = (this as any).__textTopOffset || 0;
      const align = (this as any).verticalAlign || 'top';
      
      if (offset > 0 && align !== 'top') {
        // Save the current transformation matrix
        ctx.save();
        
        // Calculate the offset in the textbox's local coordinate system
        // We need to account for the textbox's scale
        const scaleY = this.scaleY || 1;
        const localOffset = offset * scaleY;
        
        // Translate to apply vertical offset
        ctx.translate(0, localOffset);
        
        // Call original render method
        if (originalRenderText) {
          originalRenderText.call(this, ctx);
        }
        
        // Restore transformation matrix
        ctx.restore();
      } else {
        // No offset needed for top alignment
        if (originalRenderText) {
          originalRenderText.call(this, ctx);
        }
      }
    };
  }
};

// Font weights
const FONT_WEIGHTS = [
  { value: "100", label: "Thin" },
  { value: "200", label: "Extra Light" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
];

export const Text = ({ 
  selectedObject, 
  canvas, 
  properties, 
  updateObject,
  activeTab,
  onDelete
}: TextProps) => {
  const isText = selectedObject instanceof FabricTextbox;
  const [strokeVisible, setStrokeVisible] = useState(true);
  const [verticalAlign, setVerticalAlign] = useState<'top' | 'middle' | 'bottom'>('top');

  // Shadow effects state
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowBlur, setShadowBlur] = useState(0);
  const [shadowOffsetX, setShadowOffsetX] = useState(0);
  const [shadowOffsetY, setShadowOffsetY] = useState(0);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowOpacity, setShadowOpacity] = useState(0.3);

  // Load Google Fonts dynamically with professional rendering
  useEffect(() => {
    const loadFont = (fontName: string) => {
      const fontUrl = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
      
      // Check if font is already loaded
      const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
      if (!existingLink) {
        const link = document.createElement('link');
        link.href = fontUrl;
        link.rel = 'stylesheet';
        // Add font-display: swap for better performance
        link.setAttribute('crossorigin', 'anonymous');
        document.head.appendChild(link);
      }
    };

    // Load all fonts on component mount
    FONT_LIST.forEach(font => loadFont(font.name));

    // Enable professional font rendering globally for canvas
    if (canvas) {
      const canvasElement = canvas.getElement();
      if (canvasElement) {
        canvasElement.style.fontSmooth = 'always';
        canvasElement.style.webkitFontSmoothing = 'antialiased';
        canvasElement.style.mozOsxFontSmoothing = 'grayscale';
        canvasElement.style.textRendering = 'optimizeLegibility';
      }
    }
  }, [canvas]);

  // Initialize shadow and vertical alignment from object
  useEffect(() => {
    if (selectedObject) {
      const shadow = selectedObject.shadow as any;
      if (shadow) {
        setShadowEnabled(true);
        setShadowBlur(shadow.blur || 0);
        setShadowOffsetX(shadow.offsetX || 0);
        setShadowOffsetY(shadow.offsetY || 0);
        setShadowColor(shadow.color || '#000000');
        setShadowOpacity(shadow.opacity !== undefined ? shadow.opacity : 0.3);
      } else {
        setShadowEnabled(false);
        setShadowBlur(0);
        setShadowOffsetX(0);
        setShadowOffsetY(0);
        setShadowColor('#000000');
        setShadowOpacity(0.3);
      }
      
      // Initialize vertical alignment
      if (selectedObject instanceof FabricTextbox) {
        const va = (selectedObject as any).verticalAlign || 'top';
        setVerticalAlign(va);
      }
    }
  }, [selectedObject]);

  // Apply shadow
  useEffect(() => {
    if (!selectedObject || !canvas) return;
    
    if (shadowEnabled && (shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0)) {
      selectedObject.set({
        shadow: {
          color: shadowColor,
          blur: shadowBlur,
          offsetX: shadowOffsetX,
          offsetY: shadowOffsetY,
          opacity: shadowOpacity,
        } as any
      });
    } else {
      selectedObject.set({ shadow: null });
    }
    
    canvas.renderAll();
  }, [shadowEnabled, shadowBlur, shadowOffsetX, shadowOffsetY, shadowColor, shadowOpacity, selectedObject, canvas]);

  // Handle text alignment with real-time update
  const handleAlign = (alignment: string) => {
    updateObject({ textAlign: alignment });
    if (canvas) {
      canvas.renderAll();
    }
  };

  // Handle vertical alignment with real-time update
  const handleVerticalAlign = (align: 'top' | 'middle' | 'bottom') => {
    if (!selectedObject || !canvas || !(selectedObject instanceof FabricTextbox)) return;
    
    setVerticalAlign(align);
    const textbox = selectedObject as FabricTextbox;
    
    // Apply vertical alignment using helper function
    applyVerticalAlignment(textbox, align);
    
    // Update the offset when properties change
    const boxHeight = textbox.height || 0;
    const fontSize = textbox.fontSize || 32;
    const lineHeight = (textbox.lineHeight || 1.2) * fontSize;
    const textLines = (textbox.text || '').split('\n') || [''];
    const numLines = Math.max(1, textLines.filter(line => line.trim().length > 0).length || 1);
    const actualTextHeight = numLines * lineHeight;
    
    let textTopOffset = 0;
    if (align === 'middle') {
      textTopOffset = Math.max(0, (boxHeight - actualTextHeight) / 2);
    } else if (align === 'bottom') {
      textTopOffset = Math.max(0, boxHeight - actualTextHeight);
    }
    
    (textbox as any).__textTopOffset = textTopOffset;
    
    canvas.renderAll();
  };
  
  // Reapply vertical alignment when text properties change
  useEffect(() => {
    if (selectedObject && selectedObject instanceof FabricTextbox) {
      const textbox = selectedObject as FabricTextbox;
      const align = (textbox as any).verticalAlign || verticalAlign;
      if (align) {
        applyVerticalAlignment(textbox, align);
        // Recalculate offset
        const boxHeight = textbox.height || 0;
        const fontSize = textbox.fontSize || 32;
        const lineHeight = (textbox.lineHeight || 1.2) * fontSize;
        const textLines = (textbox.text || '').split('\n') || [''];
        const numLines = Math.max(1, textLines.filter(line => line.trim().length > 0).length || 1);
        const actualTextHeight = numLines * lineHeight;
        
        let textTopOffset = 0;
        if (align === 'middle') {
          textTopOffset = Math.max(0, (boxHeight - actualTextHeight) / 2);
        } else if (align === 'bottom') {
          textTopOffset = Math.max(0, boxHeight - actualTextHeight);
        }
        (textbox as any).__textTopOffset = textTopOffset;
        if (canvas) canvas.renderAll();
      }
    }
  }, [properties.fontSize, properties.lineHeight, properties.height, selectedObject, canvas, verticalAlign]);

  // Handle font change with preloading for smooth rendering
  const handleFontChange = async (fontName: string) => {
    // Apply immediately for instant feedback
    updateObject({ fontFamily: fontName });
    
    try {
      // Preload font in background for smooth rendering
      if (document.fonts) {
        await document.fonts.load(`12px "${fontName}"`);
        await document.fonts.load(`16px "${fontName}"`);
        await document.fonts.load(`400 16px "${fontName}"`);
        await document.fonts.load(`700 16px "${fontName}"`);
      }
      
      // Force canvas re-render after font is fully loaded
      if (canvas) {
        canvas.renderAll();
      }
    } catch (error) {
      console.warn('Font preload failed:', error);
    }
  };

  // Handle font size change with real-time update
  const handleFontSizeChange = (newSize: number) => {
    updateObject({ fontSize: newSize });
    if (canvas) {
      canvas.renderAll();
    }
  };

  // Handle font weight change with real-time update
  const handleFontWeightChange = (newWeight: string) => {
    updateObject({ fontWeight: newWeight });
    if (canvas) {
      canvas.renderAll();
    }
  };

  // Handle line height change with real-time update
  const handleLineHeightChange = (newLineHeight: number) => {
    updateObject({ lineHeight: newLineHeight });
    if (canvas) {
      canvas.renderAll();
    }
  };

  // Handle letter spacing change with real-time update
  const handleLetterSpacingChange = (newSpacing: number) => {
    updateObject({ letterSpacingPx: newSpacing });
    if (canvas) {
      canvas.renderAll();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white [scrollbar-width:thin] [scrollbar-color:#D1D1D1_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#D1D1D1] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
      <div className="px-3 py-3 space-y-2.5">
        {/* Transform Tab Content */}
        {activeTab === "transform" && (
          <>
        {/* Typography Section */}
        <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
          {/* Header with icon */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Typography</span>
            </div>
            <button className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <Grid3x3 className="w-4.5 h-4.5 text-[#6E6E6E]" />
            </button>
          </div>
          
          {/* Font Family Dropdown - Large, full width */}
          <Select value={properties.fontFamily || "Inter"} onValueChange={handleFontChange}>
            <SelectTrigger className="h-8 text-[12px] border border-[#E5E5E5] bg-white hover:border-[#D1D1D1] focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded text-[#161616]">
              <SelectValue placeholder="Inter" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {FONT_LIST.map((font) => (
                <SelectItem 
                  key={font.name} 
                  value={font.name}
                  style={{ fontFamily: font.name }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{font.name}</span>
                    <span className="text-[10px] text-[#9E9E9E] ml-2">{font.category}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Font Weight and Size - Side by side */}
          <div className="flex items-center gap-2">
            {/* Font Weight - Left */}
            <Select value={properties.fontWeight} onValueChange={handleFontWeightChange}>
              <SelectTrigger className="h-7 flex-[1] text-[12px] border border-[#E5E5E5] bg-white hover:border-[#D1D1D1] focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded text-[#161616]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_WEIGHTS.map((weight) => (
                  <SelectItem key={weight.value} value={weight.value}>
                    {weight.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Font Size - Right */}
            <div className="flex-[1.3] flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white h-7">
              <Input
                type="number"
                value={Math.round(properties.fontSize)}
                onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                className="h-7 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616] flex-1"
                style={{ fontSize: '13px' }}
                min={1}
                max={500}
              />
              <ChevronDown className="w-3.5 h-3.5 text-[#6E6E6E] mr-2 flex-shrink-0" />
            </div>
          </div>

          {/* Line Height and Letter Spacing - Side by side */}
          <div className="flex items-center gap-2">
            {/* Line Height - Left */}
            <div className="flex-1">
              <span className="text-[11px] text-[#6E6E6E] mb-1 block">Line height</span>
              <div className="group flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white h-7 relative">
                <svg className="w-3.5 h-3.5 text-[#6E6E6E] ml-1.5 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                  <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <text x="8" y="10" textAnchor="middle" fontSize="8" fill="currentColor">A</text>
                  <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <Input
                  type="text"
                  value={properties.lineHeight === 1.2 ? "Auto" : properties.lineHeight.toFixed(2)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "Auto" || val === "") {
                      handleLineHeightChange(1.2);
                    } else {
                      const num = parseFloat(val);
                      if (!isNaN(num)) handleLineHeightChange(Math.max(0.5, Math.min(3, num)));
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  className="h-7 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616] cursor-text flex-1"
                  style={{ fontSize: '13px' }}
                />
                {/* Arrow controls - visible on hover */}
                <div className="absolute right-1 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newValue = Math.min(3, properties.lineHeight + 0.1);
                      handleLineHeightChange(newValue);
                    }}
                    className="w-3 h-2.5 flex items-center justify-center hover:bg-[#E0E0E0] rounded-t cursor-pointer"
                  >
                    <ArrowUp className="w-2.5 h-2.5 text-[#6E6E6E]" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newValue = Math.max(0.5, properties.lineHeight - 0.1);
                      handleLineHeightChange(newValue);
                    }}
                    className="w-3 h-2.5 flex items-center justify-center hover:bg-[#E0E0E0] rounded-b cursor-pointer"
                  >
                    <ArrowDown className="w-2.5 h-2.5 text-[#6E6E6E]" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Letter Spacing - Right */}
            <div className="flex-1">
              <span className="text-[11px] text-[#6E6E6E] mb-1 block">Letter spacing</span>
              <div className="group flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white h-7 relative">
                <svg className="w-3.5 h-3.5 text-[#6E6E6E] ml-1.5 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                  <line x1="2" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <text x="8" y="10" textAnchor="middle" fontSize="8" fill="currentColor">A</text>
                  <line x1="14" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <Input
                  type="text"
                  value={properties.letterSpacingPx === 0 ? "0%" : `${properties.letterSpacingPx}%`}
                  onChange={(e) => {
                    const val = e.target.value.replace('%', '');
                    const num = parseFloat(val);
                    if (!isNaN(num)) handleLetterSpacingChange(Math.max(-10, Math.min(50, num)));
                  }}
                  onFocus={(e) => e.target.select()}
                  className="h-7 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616] cursor-text flex-1"
                  style={{ fontSize: '13px' }}
                />
                {/* Arrow controls - visible on hover */}
                <div className="absolute right-1 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newValue = Math.min(50, properties.letterSpacingPx + 1);
                      handleLetterSpacingChange(newValue);
                    }}
                    className="w-3 h-2.5 flex items-center justify-center hover:bg-[#E0E0E0] rounded-t cursor-pointer"
                  >
                    <ArrowUp className="w-2.5 h-2.5 text-[#6E6E6E]" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newValue = Math.max(-10, properties.letterSpacingPx - 1);
                      handleLetterSpacingChange(newValue);
                    }}
                    className="w-3 h-2.5 flex items-center justify-center hover:bg-[#E0E0E0] rounded-b cursor-pointer"
                  >
                    <ArrowDown className="w-2.5 h-2.5 text-[#6E6E6E]" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Alignment - Two gray boxes with smaller buttons */}
          <div className="space-y-1">
            <span className="text-[11px] text-[#6E6E6E]">Alignment</span>
            <div className="flex items-center gap-2">
              {/* Horizontal Alignment Box */}
              <div className="bg-[#F5F5F5] border border-[#E5E5E5] rounded px-1.5 py-1 flex items-center gap-0.5">
                <button
                  onClick={() => handleAlign('left')}
                  className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                    properties.textAlign === 'left' 
                      ? 'bg-[#18A0FB] text-white' 
                      : 'hover:bg-[#E0E0E0]'
                  }`}
                  title="Left align"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleAlign('center')}
                  className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                    properties.textAlign === 'center' 
                      ? 'bg-[#18A0FB] text-white' 
                      : 'hover:bg-[#E0E0E0]'
                  }`}
                  title="Center align"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleAlign('right')}
                  className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                    properties.textAlign === 'right' 
                      ? 'bg-[#18A0FB] text-white' 
                      : 'hover:bg-[#E0E0E0]'
                  }`}
                  title="Right align"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {/* Vertical Alignment Box */}
              <div className="bg-[#F5F5F5] border border-[#E5E5E5] rounded px-1.5 py-1 flex items-center gap-0.5">
                <button
                  onClick={() => handleVerticalAlign('top')}
                  className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                    verticalAlign === 'top' 
                      ? 'bg-[#18A0FB] text-white' 
                      : 'hover:bg-[#E0E0E0]'
                  }`}
                  title="Top align"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                    {/* Horizontal line at top */}
                    <line x1="2" y1="3" x2="14" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    {/* Vertical line */}
                    <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    {/* Up arrow */}
                    <path d="M8 7 L6 5 L10 5 Z" fill="currentColor"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleVerticalAlign('middle')}
                  className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                    verticalAlign === 'middle' 
                      ? 'bg-[#18A0FB] text-white' 
                      : 'hover:bg-[#E0E0E0]'
                  }`}
                  title="Middle align"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                    {/* Horizontal line in center */}
                    <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    {/* Vertical line */}
                    <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    {/* Up and down arrows */}
                    <path d="M8 6 L6 7.5 L10 7.5 Z" fill="currentColor"/>
                    <path d="M8 10 L6 8.5 L10 8.5 Z" fill="currentColor"/>
                  </svg>
                </button>
                <button
                  onClick={() => handleVerticalAlign('bottom')}
                  className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                    verticalAlign === 'bottom' 
                      ? 'bg-[#18A0FB] text-white' 
                      : 'hover:bg-[#E0E0E0]'
                  }`}
                  title="Bottom align"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                    {/* Horizontal line at bottom */}
                    <line x1="2" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    {/* Vertical line */}
                    <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    {/* Down arrow */}
                    <path d="M8 9 L6 11 L10 11 Z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

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

        {/* Stroke/Outline Section */}
        <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Outline</span>
            </div>
            <button 
              className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors"
              onClick={() => setStrokeVisible(!strokeVisible)}
            >
              {strokeVisible ? <Eye className="w-4.5 h-4.5 text-[#6E6E6E]" /> : <EyeOff className="w-4.5 h-4.5 text-[#6E6E6E]" />}
            </button>
          </div>
          
          {/* Stroke Width */}
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
          </div>

          {/* Stroke Color */}
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
            <button className="w-8 h-8 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <X className="w-4.5 h-4.5 text-[#6E6E6E]" />
            </button>
          </div>
        </div>
          </>
        )}

        {/* Tools Tab Content */}
        {activeTab === "tools" && (
          <>
          {/* Shadow Effects */}
          <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Shadow</span>
              </div>
              <div className="flex items-center gap-0.5">
                <button 
                  onClick={() => setShadowEnabled(!shadowEnabled)}
                  className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors"
                >
                  {shadowEnabled ? <Eye className="w-4 h-4 text-[#6E6E6E]" /> : <EyeOff className="w-4 h-4 text-[#6E6E6E]" />}
                </button>
                <button 
                  onClick={() => {
                    setShadowEnabled(false);
                    setShadowBlur(0);
                    setShadowOffsetX(0);
                    setShadowOffsetY(0);
                    setShadowColor('#000000');
                    setShadowOpacity(0.3);
                  }}
                  className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-[#6E6E6E]" />
                </button>
              </div>
            </div>
            
            {shadowEnabled && (
              <>
                {/* Shadow Blur */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-[#6E6E6E]" />
                      <span className="text-[10px] text-[#161616]">Blur</span>
                    </div>
                    <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(shadowBlur)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={shadowBlur}
                    onChange={(e) => setShadowBlur(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
                  />
                </div>

                {/* Shadow Offset X */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#161616]">Offset X</span>
                    <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(shadowOffsetX)}</span>
                  </div>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={1}
                    value={shadowOffsetX}
                    onChange={(e) => setShadowOffsetX(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
                  />
                </div>

                {/* Shadow Offset Y */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#161616]">Offset Y</span>
                    <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(shadowOffsetY)}</span>
                  </div>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={1}
                    value={shadowOffsetY}
                    onChange={(e) => setShadowOffsetY(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
                  />
                </div>

                {/* Shadow Opacity */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#161616]">Opacity</span>
                    <span className="text-[10px] text-[#6E6E6E] font-mono">{Math.round(shadowOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={shadowOpacity}
                    onChange={(e) => setShadowOpacity(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer accent-[#18A0FB]"
                  />
                </div>

                {/* Shadow Color */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white flex-1">
                    <div 
                      className="h-5 w-5 rounded border border-[#D1D1D1] cursor-pointer flex-shrink-0 ml-1"
                      style={{ backgroundColor: shadowColor }}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'color';
                        input.value = shadowColor;
                        input.onchange = (e) => {
                          const target = e.target as HTMLInputElement;
                          setShadowColor(target.value);
                        };
                        input.click();
                      }}
                    />
                    <Input
                      type="text"
                      value={shadowColor.startsWith('#') ? shadowColor.toUpperCase() : `#${shadowColor.toUpperCase()}`}
                      onChange={(e) => {
                        let value = e.target.value;
                        value = value.replace('#', '');
                        setShadowColor(value ? `#${value.toUpperCase()}` : '#000000');
                      }}
                      className="h-6 text-[10px] bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 flex-1 text-[#161616]"
                      placeholder="#000000"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          </>
        )}

        {/* Tools Tab Content */}
        {activeTab === "tools" && (
          <>
          {/* Text Transform */}
          <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
            <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Transform</div>
            <div className="flex items-center gap-2">
              <button className="flex-1 h-7 text-[10px] border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
                UPPERCASE
              </button>
              <button className="flex-1 h-7 text-[10px] border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
                lowercase
              </button>
              <button className="flex-1 h-7 text-[10px] border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
                Title Case
              </button>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
};

