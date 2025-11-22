import { useState, useEffect } from "react";
import { 
  Square, Circle, Minus, RotateCw, Droplet, 
  AlignCenter, Lock, Eye, EyeOff, Plus, 
  HelpCircle, ChevronDown, FlipHorizontal, FlipVertical,
  Link, Grid3x3, X, Layers, Sparkles, Trash2, Move, Maximize, Box, CornerDownRight
} from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { FabricObject, Rect as FabricRect, Circle as FabricCircle, Line as FabricLine } from "fabric";

interface ShapesData {
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
  radius?: number; // For circles
}

interface ShapesProps {
  selectedObject: FabricObject | null;
  canvas: any;
  properties: ShapesData;
  updateObject: (updates: Partial<ShapesData>) => void;
  activeTab: "tools" | "transform" | "color";
  onDelete?: () => void;
}

export const Shapes = ({ 
  selectedObject, 
  canvas, 
  properties, 
  updateObject,
  activeTab,
  onDelete
}: ShapesProps) => {
  const isRect = selectedObject instanceof FabricRect;
  const isCircle = selectedObject instanceof FabricCircle;
  const isLine = selectedObject instanceof FabricLine;
  const [fillVisible, setFillVisible] = useState(true);
  const [strokeVisible, setStrokeVisible] = useState(true);

  // Shadow effects state
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowBlur, setShadowBlur] = useState(0);
  const [shadowOffsetX, setShadowOffsetX] = useState(0);
  const [shadowOffsetY, setShadowOffsetY] = useState(0);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowOpacity, setShadowOpacity] = useState(0.3);

  // Initialize shadow from object
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

          {/* Rotation with corner radius */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white">
              <RotateCw className="w-3 h-3 text-[#6E6E6E] ml-2" />
              <Input
                type="number"
                value={Math.round(properties.rotation)}
                onChange={(e) => updateObject({ rotation: Number(e.target.value) })}
                className="h-7 w-14 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                placeholder="0"
                style={{ fontSize: '13px' }}
              />
              <span className="text-[11px] text-[#6E6E6E] pr-2">°</span>
            </div>
            {isRect && (
              <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-white">
                <CornerDownRight className="w-3 h-3 text-[#6E6E6E] ml-2" />
                <Input
                  type="number"
                  value={Math.round(properties.cornerRadius || 0)}
                  onChange={(e) => updateObject({ cornerRadius: Number(e.target.value) })}
                  className="h-7 w-12 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                  placeholder="0"
                  min={0}
                  style={{ fontSize: '13px' }}
                />
                <span className="text-[11px] text-[#6E6E6E] pr-2">px</span>
              </div>
            )}
          </div>
        </div>

        {/* Layout Section */}
        {!isLine && (
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
        )}

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

          {/* Glow Effect (using shadow) */}
          <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-lg px-3 py-2.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Glow</span>
              </div>
              <div className="flex items-center gap-0.5">
                <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
                  <Sparkles className="w-4 h-4 text-[#6E6E6E]" />
                </button>
                <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
                  <X className="w-3.5 h-3.5 text-[#6E6E6E]" />
                </button>
              </div>
            </div>
            <div className="text-[10px] text-[#6E6E6E] italic">Use Shadow with 0 offset for glow effect</div>
          </div>
          </>
        )}

        {/* Tools Tab Content */}
        {activeTab === "tools" && (
          <>
          {/* Empty for now */}
          </>
        )}
      </div>
    </div>
  );
};
