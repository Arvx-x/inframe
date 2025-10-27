import { useState, useEffect } from "react";
import { Square, Circle, Minus, RotateCw, Droplet, Palette, AlignCenter, GripVertical } from "lucide-react";
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
}

export const Shapes = ({ 
  selectedObject, 
  canvas, 
  properties, 
  updateObject 
}: ShapesProps) => {
  const isRect = selectedObject instanceof FabricRect;
  const isCircle = selectedObject instanceof FabricCircle;
  const isLine = selectedObject instanceof FabricLine;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Shape Properties Card */}
      <div className="bg-gray-100 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
              {isRect && <Square className="w-4 h-4 text-white" />}
              {isCircle && <Circle className="w-4 h-4 text-white" />}
              {isLine && <Minus className="w-4 h-4 text-white" />}
            </div>
            <span className="text-sm font-medium text-gray-900">
              {isRect ? "Rectangle" : isCircle ? "Circle" : "Line"}
            </span>
          </div>
        </div>
        
        {/* Position and Size */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors">
              <span className="text-sm text-gray-600 w-5 px-1">X</span>
              <Input
                type="number"
                value={properties.x}
                onChange={(e) => updateObject({ x: Number(e.target.value) })}
                className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
              />
            </div>
            <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors">
              <span className="text-sm text-gray-600 w-5 px-1">Y</span>
              <Input
                type="number"
                value={properties.y}
                onChange={(e) => updateObject({ y: Number(e.target.value) })}
                className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
              />
            </div>
          </div>
          
          {/* Size controls - different for each shape type */}
          {!isLine && !isCircle && (
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors">
                <span className="text-sm text-gray-600 w-5 px-1">W</span>
                <Input
                  type="number"
                  value={properties.width}
                  onChange={(e) => updateObject({ width: Number(e.target.value) })}
                  className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
                />
              </div>
              <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors">
                <span className="text-sm text-gray-600 w-5 px-1">H</span>
                <Input
                  type="number"
                  value={properties.height}
                  onChange={(e) => updateObject({ height: Number(e.target.value) })}
                  className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
                />
              </div>
            </div>
          )}
          
          {isCircle && properties.radius !== undefined && (
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors flex-1">
                <span className="text-sm text-gray-600 w-5 px-1">R</span>
                <Input
                  type="number"
                  value={properties.radius}
                  onChange={(e) => updateObject({ radius: Number(e.target.value) })}
                  className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Rotation and Corner Radius (Rectangle only) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors">
              <span className="text-sm text-gray-600 w-5 px-1 flex items-center justify-center">
                <RotateCw className="w-4 h-4" />
              </span>
              <Input
                type="number"
                value={properties.rotation}
                onChange={(e) => updateObject({ rotation: Number(e.target.value) })}
                className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
                placeholder="0°"
              />
            </div>
            {isRect && (
              <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors">
                <span className="text-sm text-gray-600 w-5 px-1 flex items-center justify-center">
                  <Square className="w-4 h-4" />
                </span>
                <Input
                  type="number"
                  value={properties.cornerRadius}
                  onChange={(e) => updateObject({ cornerRadius: Number(e.target.value) })}
                  className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
                  min={0}
                  placeholder="0"
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Opacity */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 w-5 px-1 flex items-center justify-center">
            <Droplet className="w-5 h-5" />
          </span>
          <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors flex-1">
            <Input
              type="number"
              value={properties.opacity}
              onChange={(e) => updateObject({ opacity: Number(e.target.value) })}
              className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
              min={0}
              max={100}
              placeholder="100"
            />
            <span className="text-sm text-gray-600 px-1">%</span>
          </div>
        </div>
        
        {/* Fill Color */}
        {!isLine && (
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors flex-1">
              <div 
                className="h-6 w-6 rounded-full border border-gray-300 cursor-pointer flex-shrink-0"
                style={{ backgroundColor: properties.fill }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'color';
                  input.value = properties.fill;
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    updateObject({ fill: target.value });
                  };
                  input.click();
                }}
              />
              <Input
                type="text"
                value={properties.fill}
                onChange={(e) => updateObject({ fill: e.target.value })}
                className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
                placeholder="#000000"
              />
            </div>
          </div>
        )}
      </div>

      {/* Stroke Card */}
      <div className="bg-gray-100 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
            <Palette className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-900">Stroke</span>
        </div>
        
        {/* Stroke Width and Position */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 w-8 px-1 flex items-center justify-center gap-0.5">
            <div className="flex flex-col gap-0.5">
              <div className="h-0.5 w-3 bg-gray-600 rounded"></div>
              <div className="h-1 w-3 bg-gray-600 rounded"></div>
              <div className="h-0.5 w-3 bg-gray-600 rounded"></div>
            </div>
          </span>
          <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors flex-1">
            <Input
              type="number"
              value={properties.strokeWidth}
              onChange={(e) => updateObject({ strokeWidth: Number(e.target.value) })}
              className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
              min={0}
              max={50}
            />
          </div>
          <Select
            value={properties.strokePosition}
            onValueChange={(value) => updateObject({ strokePosition: value })}
          >
            <SelectTrigger className="h-8 w-[90px] text-xs border border-gray-300 bg-transparent focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inside">Inside</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="outside">Outside</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Stroke Color */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors flex-1">
            <div 
              className="h-6 w-6 rounded-full border border-gray-300 cursor-pointer flex-shrink-0"
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
              value={properties.stroke}
              onChange={(e) => updateObject({ stroke: e.target.value })}
              className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1"
              placeholder="#000000"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

