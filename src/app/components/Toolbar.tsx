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
type PenMode = 'straight' | 'curve';

const CurvePenIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 20C4 12 12 4 20 4" />
    <circle cx="4" cy="20" r="1.5" />
    <circle cx="20" cy="4" r="1.5" />
  </svg>
);

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
  penMode: PenMode;
  setPenMode: (mode: PenMode) => void;
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
  penMode,
  setPenMode,
}: ToolbarProps) {
  return (
    <TooltipProvider>
      <div
        className="absolute flex flex-col gap-2.5 bg-white px-1.5 py-3 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-border/60 ring-1 ring-black/5 z-50 transition-all duration-200 ease-out"
        style={{
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
            <TooltipContent side="right" sideOffset={12} className="z-[60]">{activeTool === 'hand' ? 'Hand' : 'Pointer'}</TooltipContent>
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
          <TooltipContent side="right" sideOffset={12} className="z-[60]">Add Text</TooltipContent>
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
            <TooltipContent side="right" sideOffset={12} className="z-[60]">
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
          <TooltipContent side="right" sideOffset={12} className="z-[60]">Artboard</TooltipContent>
        </Tooltip>

        {/* Pen Tool */}
        <div className="relative inline-flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('pen'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg focus-visible:ring-0 focus-visible:outline-none [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'pen' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Pen Tool">
                {penMode === 'straight' ? <PenTool /> : <CurvePenIcon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">
              {penMode === 'straight' ? 'Straight Pen' : 'Curve Pen'}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 p-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0 [&_svg]:!size-2" aria-label="Pen options">
                <ChevronDown className="w-2 h-2 text-foreground/80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" sideOffset={6} className="rounded-xl">
              <DropdownMenuItem
                className="gap-2 text-sm"
                onClick={() => { setActiveToolbarButton('pen'); setPenMode('straight'); }}
              >
                <PenTool className="w-4 h-4" /> Straight Pen
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-sm"
                onClick={() => { setActiveToolbarButton('pen'); setPenMode('curve'); }}
              >
                <CurvePenIcon className="w-4 h-4" /> Curve Pen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Expanded Tools Section - COMMENTED OUT */}
        {/* <div className={`transition-all duration-200 ease-out ${isToolbarExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden flex flex-col gap-2.5 ${isToolbarExpanded ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            transition: 'max-height 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
          <div className="w-3/4 h-px bg-black/30 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('upload'); onUploadClick(); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'upload' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Add Image">
                <ImageIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Add Image</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('pen'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'pen' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Pen Tool">
                <PenTool />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Pen Tool</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('colorPicker'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'colorPicker' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Color Picker">
                <Pipette />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Color Picker</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('brush'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'brush' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Brush">
                <Paintbrush />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Brush</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('move'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'move' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Move">
                <Move />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Move</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('layers'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'layers' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Layers">
                <Layers />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Layers</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('grid'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'grid' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Grid">
                <Grid />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Grid</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('ruler'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'ruler' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Ruler">
                <Ruler />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Ruler</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('eraser'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'eraser' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Eraser">
                <Eraser />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Eraser</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={() => { 
                  setIsToolbarExpanded(false);
                  setActiveToolbarButton('pointer');
                }} 
                variant="ghost" 
                className="h-9 w-9 p-0 rounded-lg text-foreground/80 hover:text-foreground hover:bg-foreground/5" 
                aria-label="Collapse"
              >
                <div className="relative w-[32px] h-[32px] bg-gray-700 rounded-lg flex items-center justify-center">
                  <Minus className="w-6 h-6 text-white" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="z-[60]">Collapse Toolbar</TooltipContent>
          </Tooltip>
        </div> */}

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
          <TooltipContent side="right" sideOffset={12} className="z-[60]">Upload Image</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

