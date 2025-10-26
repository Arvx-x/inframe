import { useState, useEffect } from "react";
import { Mountain, Square, RotateCw, Maximize, Droplet, Minus, Layers, Palette } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { FabricObject, FabricImage, Textbox as FabricTextbox, Rect as FabricRect } from "fabric";

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
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Image Properties Card */}
      <div className="bg-gray-100 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
              <Mountain className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-900">Image</span>
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
        </div>
        
        {/* Rotation and Corner Radius */}
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
          </div>
        </div>
        
        {/* Crop and Opacity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 w-5 px-1 flex items-center justify-center">
              <Maximize className="w-4 h-4" />
            </span>
            <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors flex-1">
              <Select value={cropRatio} onValueChange={handleCropRatioChange}>
                <SelectTrigger className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1">
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
        </div>
      </div>

      {/* Border Properties Card */}
      <div className="bg-gray-100 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 rounded flex items-center justify-center">
            <Square className="w-3 h-3 text-blue-500" />
          </div>
          <span className="text-sm font-medium text-gray-900">Border</span>
        </div>
        
        {/* Border Width */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 w-5 px-1 flex items-center justify-center">
            <Minus className="w-4 h-4" />
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
        </div>
        
        {/* Border Position */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 w-5 px-1 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </span>
          <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors flex-1">
            <Select value={properties.strokePosition} onValueChange={(value) => updateObject({ strokePosition: value })}>
              <SelectTrigger className="h-8 text-sm bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 font-mono px-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inside">Inside</SelectItem>
                <SelectItem value="outside">Outside</SelectItem>
                <SelectItem value="center">Center</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Border Color */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 w-5 px-1 flex items-center justify-center">
            <Palette className="w-4 h-4" />
          </span>
          <div className="flex items-center border border-transparent rounded hover:border-gray-300 transition-colors flex-1">
            <Input
              type="color"
              value={properties.stroke}
              onChange={(e) => updateObject({ stroke: e.target.value })}
              className="h-8 w-8 p-1 bg-transparent border-0 focus:border-0 focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
