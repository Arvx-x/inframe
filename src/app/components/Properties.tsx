import { useState } from "react";
import { Mountain, Square, RotateCw, Maximize, Droplet, Minus, Layers, Palette, Lock, ChevronDown, Eye, EyeOff, Plus, HelpCircle, Grid3x3, X, Link } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { FabricObject, FabricImage } from "fabric";

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
}

export const Properties = ({ 
  selectedObject, 
  canvas, 
  properties, 
  updateObject, 
  cropRatio, 
  handleCropRatioChange 
}: PropertiesProps) => {
  const [strokeVisible, setStrokeVisible] = useState(true);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F7F7F7] [scrollbar-width:thin] [scrollbar-color:#D1D1D1_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#D1D1D1] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
      {/* Image Header */}
      <div className="px-3 py-2.5 border-b border-[#E5E5E5] bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium text-[#161616]">Image</span>
          </div>
          <div className="flex items-center gap-0.5">
            {/* Component icon - 4 diamonds */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 3.5L7 0L10.5 3.5L7 7L3.5 3.5Z" fill="currentColor" className="text-[#6E6E6E]"/>
                <path d="M3.5 10.5L7 14L10.5 10.5L7 7L3.5 10.5Z" fill="currentColor" className="text-[#6E6E6E]"/>
              </svg>
            </button>
            {/* Mask icon */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6.5" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1"/>
                <circle cx="7" cy="7" r="3.5" fill="white" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1"/>
              </svg>
            </button>
            {/* Lock icon */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
              <Lock className="w-4 h-4 text-[#6E6E6E]" />
            </button>
            {/* Dropdown */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
              <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
            </button>
            {/* Constraints icon */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none">
                <path d="M1 7H13M7 1V13" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 py-3 space-y-1">
        {/* Position Section */}
        <div className="bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 space-y-2.5">
          <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Position</div>
          
          {/* Alignment icons - 6 greyed out icons in 2 rows */}
          <div className="grid grid-cols-3 gap-1 mb-2">
            {/* Align Left */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M2 4H10M2 8H10M2 12H10" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Align Center Horizontal */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M3 4H13M3 8H13M3 12H13" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Align Right */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M6 4H14M6 8H14M6 12H14" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Align Top */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 2V10M8 2V10M12 2V10" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Align Center Vertical */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 3V13M8 3V13M12 3V13" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Align Bottom */}
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors opacity-40 cursor-not-allowed">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 6V14M8 6V14M12 6V14" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* X and Y Position */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-[#F5F5F5]">
              <span className="text-[10px] text-[#6E6E6E] px-1.5 py-1 font-medium">X</span>
              <Input
                type="number"
                value={Math.round(properties.x)}
                onChange={(e) => updateObject({ x: Number(e.target.value) })}
                className="h-6 w-16 text-[10px] bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
              />
            </div>
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-[#F5F5F5]">
              <span className="text-[10px] text-[#6E6E6E] px-1.5 py-1 font-medium">Y</span>
              <Input
                type="number"
                value={Math.round(properties.y)}
                onChange={(e) => updateObject({ y: Number(e.target.value) })}
                className="h-6 w-16 text-[10px] bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
              />
            </div>
          </div>

          {/* Rotation with flip icons */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-[#F5F5F5]">
              <RotateCw className="w-3.5 h-3.5 text-[#6E6E6E] ml-1.5" />
              <Input
                type="number"
                value={Math.round(properties.rotation)}
                onChange={(e) => updateObject({ rotation: Number(e.target.value) })}
                className="h-6 w-16 text-[10px] bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                placeholder="0"
              />
              <span className="text-[10px] text-[#6E6E6E] pr-1.5">°</span>
            </div>
            <button className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L2 8L8 14M14 2L8 8L14 14" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M2 8L8 2L14 8M2 8L8 14L14 8" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Layout Section */}
        <div className="bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 space-y-2.5">
          <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Layout</div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-[#F5F5F5]">
              <span className="text-[10px] text-[#6E6E6E] px-1.5 py-1 font-medium">W</span>
              <Input
                type="number"
                value={Math.round(properties.width)}
                onChange={(e) => updateObject({ width: Number(e.target.value) })}
                className="h-6 w-16 text-[10px] bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
              />
            </div>
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-[#F5F5F5]">
              <span className="text-[10px] text-[#6E6E6E] px-1.5 py-1 font-medium">H</span>
              <Input
                type="number"
                value={Math.round(properties.height)}
                onChange={(e) => updateObject({ height: Number(e.target.value) })}
                className="h-6 w-16 text-[10px] bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
              />
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Appearance</div>
            <div className="flex items-center gap-0.5">
              <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
                <Eye className="w-4 h-4 text-[#6E6E6E]" />
              </button>
              <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
                <Droplet className="w-4 h-4 text-[#6E6E6E]" />
              </button>
            </div>
          </div>
          
          {/* Opacity */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-[#F5F5F5] flex-1">
              <div className="w-5 h-5 flex items-center justify-center ml-1">
                <Droplet className="w-3.5 h-3.5 text-[#6E6E6E]" style={{ opacity: properties.opacity / 100 }} />
              </div>
              <Input
                type="number"
                value={Math.round(properties.opacity)}
                onChange={(e) => updateObject({ opacity: Number(e.target.value) })}
                className="h-6 text-[10px] bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 flex-1 text-[#161616]"
                min={0}
                max={100}
              />
              <span className="text-[10px] text-[#6E6E6E] pr-1.5">%</span>
            </div>
            {/* Opacity lock/advanced controls icon */}
            <button className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="6" rx="1" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1.2"/>
                <path d="M5 7V5C5 3.343 6.343 2 8 2C9.657 2 11 3.343 11 5V7" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="8" cy="10" r="1" fill="currentColor" className="text-[#6E6E6E]"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Crop Section */}
        <div className="bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Crop</div>
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
              <Maximize className="w-4 h-4 text-[#6E6E6E]" />
            </button>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Select value={cropRatio} onValueChange={handleCropRatioChange}>
              <SelectTrigger className="h-6 flex-1 text-[10px] border border-[#E5E5E5] bg-[#F5F5F5] hover:border-[#D1D1D1] focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded text-[#161616]">
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

        {/* Border Section */}
        <div className="bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Border</div>
            <div className="flex items-center gap-0.5">
              <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
                <Grid3x3 className="w-4 h-4 text-[#6E6E6E]" />
              </button>
              <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
                <Plus className="w-4 h-4 text-[#6E6E6E]" />
              </button>
            </div>
          </div>
          
          {/* Border Width */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-[#F5F5F5]">
              <Minus className="w-3.5 h-3.5 text-[#6E6E6E] ml-1.5" />
              <Input
                type="number"
                value={properties.strokeWidth}
                onChange={(e) => updateObject({ strokeWidth: Number(e.target.value) })}
                className="h-6 w-14 text-[10px] bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 text-[#161616]"
                min={0}
                max={50}
              />
            </div>
            {/* Link icon */}
            <button className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <Link className="w-4 h-4 text-[#6E6E6E]" />
            </button>
            {/* Dashed square icon */}
            <button className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" stroke="currentColor" className="text-[#6E6E6E]" strokeWidth="1" strokeDasharray="2 2"/>
              </svg>
            </button>
          </div>

          {/* Border Position */}
          <div className="flex items-center gap-1.5">
            <Select value={properties.strokePosition} onValueChange={(value) => updateObject({ strokePosition: value })}>
              <SelectTrigger className="h-6 flex-1 text-[10px] border border-[#E5E5E5] bg-[#F5F5F5] hover:border-[#D1D1D1] focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded text-[#161616]">
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
          <div className="flex items-center gap-1.5">
            <div className="flex items-center border border-[#E5E5E5] rounded hover:border-[#D1D1D1] focus-within:border-[#18A0FB] transition-colors bg-[#F5F5F5] flex-1">
              <div 
                className="h-5 w-5 rounded border border-[#D1D1D1] cursor-pointer flex-shrink-0 ml-1"
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
                className="h-6 text-[10px] bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono px-1.5 py-0.5 flex-1 text-[#161616]"
                placeholder="#000000"
              />
              <span className="text-[10px] text-[#6E6E6E] pr-1.5">100%</span>
            </div>
            <button 
              className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors"
              onClick={() => setStrokeVisible(!strokeVisible)}
            >
              {strokeVisible ? <Eye className="w-4 h-4 text-[#6E6E6E]" /> : <EyeOff className="w-4 h-4 text-[#6E6E6E]" />}
            </button>
            <button className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] rounded hover:bg-[#F0F0F0] transition-colors">
              <X className="w-4 h-4 text-[#6E6E6E]" />
            </button>
          </div>
        </div>

        {/* Effects Section */}
        <div className="bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Effects</div>
            <div className="flex items-center gap-0.5">
              <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
                <HelpCircle className="w-4 h-4 text-[#6E6E6E]" />
              </button>
              <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
                <Plus className="w-4 h-4 text-[#6E6E6E]" />
              </button>
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div className="bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-[#161616] tracking-wide leading-tight">Export</div>
            <button className="w-6 h-6 flex items-center justify-center hover:bg-[#F0F0F0] rounded transition-colors">
              <Plus className="w-4 h-4 text-[#6E6E6E]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
