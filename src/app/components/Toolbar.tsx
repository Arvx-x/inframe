'use client';

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { 
  Type, Square, Circle as CircleIcon, Minus, Pencil, Plus, 
  MousePointer, Hand, ChevronDown, PenTool, Layout, Pipette, 
  Paintbrush, Move, Layers, Grid, Ruler, Eraser 
} from "lucide-react";

type ToolbarButton = 'pointer' | 'hand' | 'text' | 'shape' | 'upload' | 'reference' | 'selector' | 'artboard' | 'pen' | 'colorPicker' | 'brush' | 'move' | 'layers' | 'grid' | 'ruler' | 'eraser' | 'eye' | 'zoomIn' | 'zoomOut';
type Tool = 'pointer' | 'hand';
type Shape = 'rect' | 'circle' | 'line';

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
}: ToolbarProps) {
  return (
    <TooltipProvider>
      <div
        className={`absolute left-2 flex flex-col gap-2.5 bg-white/70 dark:bg-neutral-900/60 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md px-1.5 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-border/60 ring-1 ring-black/5 z-50 transition-all duration-200 ease-out overflow-hidden ${isToolbarExpanded ? 'pt-0 pb-1.5' : 'py-3'}`}
        style={{
          top: isToolbarExpanded ? '0px' : 'calc((100vh - 76px) / 2 - 20px)',
          transform: isToolbarExpanded ? 'translateY(0)' : 'translateY(-50%)',
          maxHeight: isToolbarExpanded ? 'calc(100vh - 6px)' : 'none',
          transition: 'top 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1), max-height 200ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Pointer/Hand tool (split button with dropdown chevron) */}
        <div className="relative inline-flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'pointer' || activeToolbarButton === 'hand' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`}
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
            <TooltipContent side="right">Tools</TooltipContent>
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
            <Button onClick={() => { setActiveToolbarButton('text'); onAddText(); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'text' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Add Text">
              <Type />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Add Text</TooltipContent>
        </Tooltip>

        {/* Shapes (split button with dropdown chevron) */}
        <div className="relative inline-flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('shape'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'shape' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Add Shape">
                {activeShape === 'rect' && <Square />}
                {activeShape === 'circle' && <CircleIcon />}
                {activeShape === 'line' && <Minus />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {activeShape === 'rect' ? 'Add Rectangle' : activeShape === 'circle' ? 'Add Circle' : 'Add Line'}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 p-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0 [&_svg]:!size-2" aria-label="More shapes">
                <ChevronDown className="w-2 h-2 text-foreground/80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" sideOffset={8} className="rounded-xl">
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

        {/* Upload */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => { setActiveToolbarButton('upload'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'upload' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Upload Image">
              <Pencil />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Upload Image</TooltipContent>
        </Tooltip>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

        {/* Expanded Tools Section */}
        <div className={`transition-all duration-200 ease-out ${isToolbarExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden flex flex-col gap-2.5 ${isToolbarExpanded ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            transition: 'max-height 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
          {/* Divider */}
          <div className="w-3/4 h-px bg-black/30 mx-1" />

          {/* Artboard Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('artboard'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'artboard' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Artboard">
                <Layout />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Artboard</TooltipContent>
          </Tooltip>

          {/* Pen Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('pen'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'pen' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Pen Tool">
                <PenTool />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Pen Tool</TooltipContent>
          </Tooltip>

          {/* Color Picker Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('colorPicker'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'colorPicker' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Color Picker">
                <Pipette />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Color Picker</TooltipContent>
          </Tooltip>

          {/* Brush Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('brush'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'brush' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Brush">
                <Paintbrush />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Brush</TooltipContent>
          </Tooltip>

          {/* Move Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('move'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'move' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Move">
                <Move />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Move</TooltipContent>
          </Tooltip>

          {/* Layers Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('layers'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'layers' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Layers">
                <Layers />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Layers</TooltipContent>
          </Tooltip>

          {/* Grid Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('grid'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'grid' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Grid">
                <Grid />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Grid</TooltipContent>
          </Tooltip>

          {/* Ruler Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('ruler'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'ruler' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Ruler">
                <Ruler />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Ruler</TooltipContent>
          </Tooltip>

          {/* Eraser Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => { setActiveToolbarButton('eraser'); }} variant="ghost" className={`h-9 w-9 p-0 rounded-lg [&_svg]:!w-[17px] [&_svg]:!h-[17px] ${activeToolbarButton === 'eraser' ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`} aria-label="Eraser">
                <Eraser />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Eraser</TooltipContent>
          </Tooltip>

          {/* Collapse Button (only visible when expanded) */}
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
            <TooltipContent side="right">Collapse Toolbar</TooltipContent>
          </Tooltip>
        </div>

        {/* Reference / Expand Button */}
        {!isToolbarExpanded && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={() => { 
                  setIsToolbarExpanded(true);
                  setActiveToolbarButton('reference');
                }} 
                variant="ghost" 
                className="h-9 w-9 p-0 rounded-lg text-foreground/80 hover:text-foreground hover:bg-foreground/5" 
                aria-label="Expand"
              >
                <div className="relative w-[32px] h-[32px] bg-gray-700 rounded-lg flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand Toolbar</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

