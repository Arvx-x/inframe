'use client';

import { useState } from "react";
import type { SVGProps } from "react";
import { Button } from "@/app/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import {
  Type, Square, Circle as CircleIcon, Minus, Pencil, Plus,
  MousePointer, Hand, ChevronDown, PenTool, Frame, Pipette,
  Paintbrush, Move, Layers, Grid, Ruler, Eraser, Image as ImageIcon
} from "lucide-react";

type ToolbarButton = 'pointer' | 'hand' | 'text' | 'shape' | 'upload' | 'reference' | 'selector' | 'artboard' | 'pen' | 'colorPicker' | 'brush' | 'move' | 'layers' | 'grid' | 'ruler' | 'eraser' | 'eye' | 'zoomIn' | 'zoomOut';
type Tool = 'pointer' | 'hand';
type Shape = 'rect' | 'circle' | 'line';
type PenSubTool = 'draw' | 'pointer' | 'curve';

interface ToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  activeToolbarButton: ToolbarButton;
  setActiveToolbarButton: (button: ToolbarButton) => void;
  activeShape: Shape;
  setActiveShape: (shape: Shape) => void;
  isToolbarExpanded: boolean;
  setIsToolbarExpanded: (expanded: boolean) => void;
  onAddText: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadClick: () => void;
  leftOffset?: number;
  penSubTool: PenSubTool;
  setPenSubTool: (tool: PenSubTool) => void;
  layout?: 'vertical' | 'horizontal';
}

export function Toolbar({
  activeTool,
  setActiveTool,
  activeToolbarButton,
  setActiveToolbarButton,
  activeShape,
  setActiveShape,
  isToolbarExpanded,
  setIsToolbarExpanded,
  onAddText,
  fileInputRef,
  onFileChange,
  onUploadClick,
  leftOffset = 8,
  penSubTool,
  setPenSubTool,
  layout = 'vertical',
}: ToolbarProps) {
  const isHorizontal = layout === 'horizontal';

  // Tooltip position based on layout
  const tooltipSide = isHorizontal ? 'top' : 'right';

  return (
    <TooltipProvider>
      <div
        className={`${isHorizontal
          ? 'fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-row gap-2.5 bg-white px-4 py-2 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.12)] border border-border/60 ring-1 ring-black/5 z-50'
          : 'absolute flex flex-col gap-2.5 bg-white px-1.5 py-3 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-border/60 ring-1 ring-black/5 z-50 transition-all duration-200 ease-out'}`}
        style={isHorizontal ? {} : {
          left: `${leftOffset}px`,
          top: 'calc((100vh - 76px) / 2 - 20px)',
          transform: 'translateY(-50%)',
          transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1), top 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Pointer/Hand tool (split button with dropdown chevron) */}
        <div className="relative inline-flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={`h-9 w-9 p-0 rounded-lg focus-visible:ring-0 focus-visible:outline-none [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'pointer' || activeToolbarButton === 'hand' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`}
                aria-label="Current Tool"
                onClick={() => {
                  const next = activeTool === 'hand' ? 'pointer' : 'hand';
                  setActiveTool(next);
                  setActiveToolbarButton(next);
                }}
              >
                {activeTool === 'hand' ? (
                  <Hand />
                ) : (
                  <MousePointer />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">{activeTool === 'hand' ? 'Hand' : 'Pointer'}</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 p-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0 [&_svg]:!size-2" aria-label="More tools">
                <ChevronDown className="w-2 h-2 text-foreground/80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" sideOffset={8} className="rounded-xl">
              <DropdownMenuItem className="gap-2 text-sm" onClick={() => { setActiveTool('pointer'); setActiveToolbarButton('pointer'); }}>
                <MousePointer className="w-4 h-4" /> Pointer
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-sm" onClick={() => { setActiveTool('hand'); setActiveToolbarButton('hand'); }}>
                <Hand className="w-4 h-4" /> Hand
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Text */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => { setActiveToolbarButton('text'); onAddText(); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg focus-visible:ring-0 focus-visible:outline-none [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'text' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Add Text">
              <Type />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Add Text</TooltipContent>
        </Tooltip>

        {/* Shapes (split button with dropdown chevron) */}
        <div className="relative inline-flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('shape'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg focus-visible:ring-0 focus-visible:outline-none [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'shape' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Add Shape">
                {activeShape === 'rect' && <Square />}
                {activeShape === 'circle' && <CircleIcon />}
                {activeShape === 'line' && <Minus />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">
              {activeShape === 'rect' ? 'Add Rectangle' : activeShape === 'circle' ? 'Add Circle' : 'Add Line'}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 p-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0 [&_svg]:!size-2" aria-label="More shapes">
                <ChevronDown className="w-2 h-2 text-foreground/80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" sideOffset={6} className="rounded-xl">
              <DropdownMenuItem className="gap-2 text-sm" onClick={() => { setActiveToolbarButton('shape'); setActiveShape('rect'); }}>
                <Square className="w-4 h-4" /> Rectangle
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-sm" onClick={() => { setActiveToolbarButton('shape'); setActiveShape('circle'); }}>
                <CircleIcon className="w-4 h-4" /> Circle
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-sm" onClick={() => { setActiveToolbarButton('shape'); setActiveShape('line'); }}>
                <Minus className="w-4 h-4" /> Line
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Artboard */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => { setActiveToolbarButton('artboard'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg focus-visible:ring-0 focus-visible:outline-none [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'artboard' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Artboard">
              <Frame />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Artboard</TooltipContent>
        </Tooltip>

        {/* Pen Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => { setActiveToolbarButton('pen'); setPenSubTool('draw'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg focus-visible:ring-0 focus-visible:outline-none [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'pen' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Pen Tool">
              <PenTool />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Pen Tool</TooltipContent>
        </Tooltip>

        {/* Upload Image Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => {
                setActiveToolbarButton('upload');
                onUploadClick();
              }}
              variant="ghost"
              className="h-9 w-9 p-0 rounded-lg focus-visible:ring-0 focus-visible:outline-none text-foreground/80 hover:text-foreground hover:bg-foreground/5"
              aria-label="Upload Image"
            >
              <div className="relative w-[32px] h-[32px] bg-gray-700 rounded-lg flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Upload Image</TooltipContent>
        </Tooltip>
      </div>

      {/* Pen Sub-toolbar - appears when pen tool is active (only in vertical layout) */}
      {activeToolbarButton === 'pen' && !isHorizontal && (
        <div
          className="absolute flex flex-col gap-2.5 bg-white px-1.5 py-3 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-border/60 ring-1 ring-black/5 z-50 transition-all duration-200 ease-out"
          style={{
            left: `${(leftOffset || 8) + 56}px`,
            top: 'calc((100vh - 76px) / 2 - 20px)',
            transform: 'translateY(-50%)',
            transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1), top 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Move Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => { setPenSubTool('pointer'); }}
                variant="ghost"
                className={`h-9 w-9 p-0 rounded-lg focus-visible:ring-0 focus-visible:outline-none [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${penSubTool === 'pointer' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`}
                aria-label="Move"
              >
                <MousePointer />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Move</TooltipContent>
          </Tooltip>

          {/* Curve Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => { setPenSubTool('curve'); }}
                variant="ghost"
                className={`h-9 w-9 p-0 rounded-lg focus-visible:ring-0 focus-visible:outline-none [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${penSubTool === 'curve' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`}
                aria-label="Curve"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-[17px] h-[17px]"
                >
                  <path d="M4 20C4 12 12 4 20 4" />
                  <circle cx="4" cy="20" r="1.5" />
                  <circle cx="20" cy="4" r="1.5" />
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Curve</TooltipContent>
          </Tooltip>
        </div>
      )}
    </TooltipProvider>
  );
}

