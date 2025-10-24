'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

interface ColorSelectorProps {
  canvasColor: string;
  onColorChange: (color: string) => void;
}

export default function ColorSelector({ canvasColor, onColorChange }: ColorSelectorProps) {
  // Color picker state
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [lightness, setLightness] = useState(95);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'square' | 'hue' | null>(null);
  const colorSquareRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);

  // Convert HSL to Hex
  const hslToHex = (h: number, s: number, l: number) => {
    const lightness = l / 100;
    const a = s * Math.min(lightness, 1 - lightness) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Convert Hex to HSL
  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  };

  // Update color when HSL values change
  useEffect(() => {
    const hex = hslToHex(hue, saturation, lightness);
    onColorChange(hex);
  }, [hue, saturation, lightness, onColorChange]);

  // Handle color square click and drag
  const handleColorSquareMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragType('square');
    handleColorSquareMove(e);
  };

  const handleColorSquareMove = (e: React.MouseEvent | MouseEvent) => {
    if (!colorSquareRef.current) return;
    const rect = colorSquareRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    
    const newSaturation = Math.round((x / rect.width) * 100);
    const newLightness = Math.round(100 - (y / rect.height) * 100);
    
    setSaturation(Math.max(0, Math.min(100, newSaturation)));
    setLightness(Math.max(0, Math.min(100, newLightness)));
  };

  // Handle hue slider click and drag
  const handleHueSliderMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragType('hue');
    handleHueSliderMove(e);
  };

  const handleHueSliderMove = (e: React.MouseEvent | MouseEvent) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const newHue = Math.round((x / rect.width) * 360);
    setHue(Math.max(0, Math.min(360, newHue)));
  };

  // Global mouse events for smooth dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      if (dragType === 'square') {
        handleColorSquareMove(e);
      } else if (dragType === 'hue') {
        handleHueSliderMove(e);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragType(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragType]);

  // Handle hex input change with better validation
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let hex = e.target.value;
    
    // Add # if missing
    if (hex && !hex.startsWith('#')) {
      hex = '#' + hex;
    }
    
    // Allow partial input while typing
    if (hex.length <= 7) {
      onColorChange(hex);
      
      // Only update HSL if it's a complete hex
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        const hsl = hexToHsl(hex);
        setHue(hsl.h);
        setSaturation(hsl.s);
        setLightness(hsl.l);
      }
    }
  };

  // Handle hex input blur to ensure valid color
  const handleHexBlur = () => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(canvasColor)) {
      // Reset to current HSL values if invalid
      const hex = hslToHex(hue, saturation, lightness);
      onColorChange(hex);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 px-3 rounded-lg flex items-center gap-2 border-2 hover:bg-gray-100 transition-colors bg-gray-50"
          aria-label="Canvas Color"
        >
          <Palette className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 bg-white border border-gray-200 shadow-xl rounded-2xl" align="end">
        <div className="space-y-4">
          {/* Color Square */}
          <div className="relative">
            <div
              ref={colorSquareRef}
              className="w-full h-40 rounded-xl cursor-crosshair relative overflow-hidden border border-gray-200 shadow-sm"
              style={{
                background: `linear-gradient(to left, hsl(${hue}, 100%, 50%), hsl(${hue}, 0%, 50%)), linear-gradient(to bottom, transparent, hsl(${hue}, 100%, 0%))`
              }}
              onMouseDown={handleColorSquareMouseDown}
            >
              {/* Color selector handle */}
              <div
                className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg pointer-events-none ring-2 ring-gray-300"
                style={{
                  left: `${saturation}%`,
                  top: `${100 - lightness}%`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`
                }}
              />
            </div>
          </div>

          {/* Hue Slider */}
          <div className="relative">
            <div
              ref={hueSliderRef}
              className="w-full h-4 rounded-lg cursor-pointer border border-gray-200 shadow-sm"
              style={{
                background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
              }}
              onMouseDown={handleHueSliderMouseDown}
            >
              {/* Hue selector handle */}
              <div
                className="absolute w-3 h-3 border-2 border-white rounded-full shadow-lg pointer-events-none ring-2 ring-gray-300"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: `hsl(${hue}, 100%, 50%)`
                }}
              />
            </div>
          </div>

          {/* Hex Input */}
          <div className="space-y-2">
            <Label htmlFor="hex-input" className="text-sm font-semibold text-gray-700">Canvas Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="hex-input"
                value={canvasColor}
                onChange={handleHexChange}
                onBlur={handleHexBlur}
                placeholder="#ffffff"
                className="flex-1 font-mono text-sm border-gray-300 focus:border-gray-300 focus:ring-0 focus:outline-none focus:shadow-none focus:border-gray-300 rounded-lg"
                style={{ outline: 'none', boxShadow: 'none' }}
                maxLength={7}
              />
              <div 
                className="w-8 h-8 rounded-lg border-2 border-gray-300 shadow-sm"
                style={{ backgroundColor: canvasColor }}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
