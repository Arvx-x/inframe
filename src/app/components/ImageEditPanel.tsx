'use client';

import { Slider } from "@/app/components/ui/slider";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { RotateCcw } from "lucide-react";

interface ImageEditPanelProps {
  position: { x: number; y: number };
  filters: {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
  };
  onFilterChange: (filterName: string, value: number) => void;
  onReset: () => void;
  compact?: boolean;
}

export default function ImageEditPanel({
  position,
  filters,
  onFilterChange,
  onReset,
  compact = false,
}: ImageEditPanelProps) {
  return (
    <div
      className={`absolute bg-background border border-border rounded-xl shadow-lg ${compact ? "p-3 w-64" : "p-4 w-80"} z-50`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className={compact ? "flex items-center justify-between mb-3" : "flex items-center justify-between mb-4"}>
        <h3 className="text-sm font-semibold">Adjustments</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className={compact ? "h-7 w-7 p-0" : "h-8 w-8 p-0"}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className={compact ? "space-y-3" : "space-y-4"}>
        {/* Brightness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Brightness</Label>
            <span className="text-xs text-muted-foreground">
              {Math.round(filters.brightness * 100)}%
            </span>
          </div>
          <Slider
            value={[filters.brightness]}
            onValueChange={([value]) => onFilterChange('brightness', value)}
            min={-1}
            max={1}
            step={0.01}
            className="w-full"
          />
        </div>

        {/* Contrast */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Contrast</Label>
            <span className="text-xs text-muted-foreground">
              {Math.round(filters.contrast * 100)}%
            </span>
          </div>
          <Slider
            value={[filters.contrast]}
            onValueChange={([value]) => onFilterChange('contrast', value)}
            min={-1}
            max={1}
            step={0.01}
            className="w-full"
          />
        </div>

        {/* Saturation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Saturation</Label>
            <span className="text-xs text-muted-foreground">
              {Math.round((filters.saturation + 1) * 100)}%
            </span>
          </div>
          <Slider
            value={[filters.saturation]}
            onValueChange={([value]) => onFilterChange('saturation', value)}
            min={-1}
            max={1}
            step={0.01}
            className="w-full"
          />
        </div>

        {/* Hue */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Color Shift</Label>
            <span className="text-xs text-muted-foreground">
              {Math.round(filters.hue)}°
            </span>
          </div>
          <Slider
            value={[filters.hue]}
            onValueChange={([value]) => onFilterChange('hue', value)}
            min={-180}
            max={180}
            step={1}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
