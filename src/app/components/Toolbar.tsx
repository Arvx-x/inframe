'use client';

import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/app/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import {
  Type, Square, Circle as CircleIcon, Minus, Plus,
  MousePointer, Hand, ChevronDown, PenTool, Frame
} from "lucide-react";

type ToolbarButton = 'pointer' | 'hand' | 'text' | 'shape' | 'upload' | 'reference' | 'selector' | 'artboard' | 'pen' | 'colorPicker' | 'brush' | 'move' | 'layers' | 'grid' | 'ruler' | 'eraser' | 'eye' | 'zoomIn' | 'zoomOut' | 'timer' | 'vote' | 'kanban' | 'mindmap';
type Tool = 'pointer' | 'hand';
type Shape = 'rect' | 'circle' | 'line' | 'diamond';
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
  onAddStickyNote?: () => void;
  onActivateBrush?: () => void;
  onAddTimer?: () => void;
  onAddVote?: () => void;
  onAddKanban?: () => void;
  onAddMindMap?: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadClick: () => void;
  leftOffset?: number;
  penSubTool: PenSubTool;
  setPenSubTool: (tool: PenSubTool) => void;
  layout?: 'vertical' | 'horizontal';
  mode?: 'default' | 'plan';
}

// Shared button style helper
const btnClass = (active: boolean, size: 'default' | 'plan' = 'default') => {
  const baseSize = size === 'plan'
    ? 'h-12 w-12 [&_svg]:!w-[24px] [&_svg]:!h-[24px]'
    : 'h-9 w-9 [&_svg]:!w-[16px] [&_svg]:!h-[16px]';

  return `${baseSize} p-0 rounded-xl focus-visible:ring-0 focus-visible:outline-none ${active ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : 'text-foreground/80 hover:text-foreground hover:bg-foreground/5'}`;
};

type PlanIconIds = {
  primary: string;
  secondary: string;
  highlight: string;
  shadow: string;
};

type PlanIconProps = {
  children: (ids: PlanIconIds) => ReactNode;
  viewBox?: string;
  primary?: string;
  secondary?: string;
  highlight?: string;
};

const PlanIcon = ({
  children,
  viewBox = "0 0 24 24",
  primary = "#FDE68A",
  secondary = "#F59E0B",
  highlight = "#FEF3C7",
}: PlanIconProps) => {
  const id = useId();
  const ids: PlanIconIds = {
    primary: `${id}-primary`,
    secondary: `${id}-secondary`,
    highlight: `${id}-highlight`,
    shadow: `${id}-shadow`,
  };

  return (
    <svg viewBox={viewBox} className="w-[24px] h-[24px]" aria-hidden="true">
      <defs>
        <linearGradient id={ids.primary} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
        <linearGradient id={ids.highlight} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id={ids.shadow} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.6" floodColor="rgba(15,23,42,0.35)" />
        </filter>
      </defs>
      {children(ids)}
    </svg>
  );
};

const PlanPointerIcon = () => (
  <PlanIcon primary="#E2E8F0" secondary="#94A3B8" highlight="#F8FAFC">
    {(ids) => (
      <path
        d="M6 3.5L17 18.5l1.8-4.6 4.2 4.2 1.3-1.3-4.2-4.2 4.6-1.8L6 3.5z"
        fill={`url(#${ids.primary})`}
        stroke="#475569"
        strokeWidth="0.8"
        filter={`url(#${ids.shadow})`}
      />
    )}
  </PlanIcon>
);

const PlanHandIcon = () => (
  <PlanIcon primary="#F8D1B0" secondary="#F3A46B" highlight="#FFE5CC">
    {(ids) => (
      <>
        <path
          d="M7 11c0-1.1.9-2 2-2h1V6.8c0-.9.7-1.6 1.6-1.6s1.6.7 1.6 1.6V9h1V6.6c0-.9.7-1.6 1.6-1.6s1.6.7 1.6 1.6V10h.9c1 0 1.9.8 1.9 1.9v3.2c0 3.2-2.6 5.8-5.8 5.8h-2.6C8.6 20.9 7 19.3 7 17.3V11z"
          fill={`url(#${ids.primary})`}
          stroke="#9A5A35"
          strokeWidth="0.8"
          filter={`url(#${ids.shadow})`}
        />
        <path
          d="M9 11.5h7.5"
          stroke={`url(#${ids.highlight})`}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </>
    )}
  </PlanIcon>
);

const PlanStickyNoteIcon = () => (
  <PlanIcon primary="#FDE68A" secondary="#FBBF24" highlight="#FFF7D1">
    {(ids) => (
      <>
        <rect x="4" y="3.5" width="16" height="16" rx="3" fill={`url(#${ids.primary})`} stroke="#B45309" strokeWidth="0.8" filter={`url(#${ids.shadow})`} />
        <path d="M14.5 19.5v-4h4" fill={`url(#${ids.highlight})`} stroke="#B45309" strokeWidth="0.6" />
      </>
    )}
  </PlanIcon>
);

const PlanRectIcon = () => (
  <PlanIcon primary="#93C5FD" secondary="#3B82F6" highlight="#DBEAFE">
    {(ids) => (
      <rect x="4" y="6" width="16" height="12" rx="2" fill={`url(#${ids.primary})`} stroke="#1D4ED8" strokeWidth="0.9" filter={`url(#${ids.shadow})`} />
    )}
  </PlanIcon>
);

const PlanCircleIcon = () => (
  <PlanIcon primary="#A7F3D0" secondary="#10B981" highlight="#D1FAE5">
    {(ids) => (
      <circle cx="12" cy="12" r="6.5" fill={`url(#${ids.primary})`} stroke="#047857" strokeWidth="0.9" filter={`url(#${ids.shadow})`} />
    )}
  </PlanIcon>
);

const PlanDiamondIcon = () => (
  <PlanIcon primary="#FBCFE8" secondary="#EC4899" highlight="#FCE7F3">
    {(ids) => (
      <path d="M12 4.5L19.5 12 12 19.5 4.5 12 12 4.5z" fill={`url(#${ids.primary})`} stroke="#BE185D" strokeWidth="0.9" filter={`url(#${ids.shadow})`} />
    )}
  </PlanIcon>
);

const PlanLineIcon = () => (
  <PlanIcon primary="#E2E8F0" secondary="#94A3B8" highlight="#F8FAFC">
    {(ids) => (
      <path d="M5 16.5h14" stroke={`url(#${ids.primary})`} strokeWidth="2.4" strokeLinecap="round" filter={`url(#${ids.shadow})`} />
    )}
  </PlanIcon>
);

const PlanConnectorIcon = () => (
  <PlanIcon primary="#C4B5FD" secondary="#8B5CF6" highlight="#EDE9FE">
    {(ids) => (
      <>
        <path d="M5 12h11" stroke={`url(#${ids.primary})`} strokeWidth="2.2" strokeLinecap="round" filter={`url(#${ids.shadow})`} />
        <path d="M13 7l5 5-5 5" fill="none" stroke="#6D28D9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
  </PlanIcon>
);

const PlanMarkerIcon = () => (
  <PlanIcon primary="#99F6E4" secondary="#14B8A6" highlight="#CCFBF1">
    {(ids) => (
      <>
        <rect x="6" y="5" width="12" height="10" rx="2" fill={`url(#${ids.primary})`} stroke="#0F766E" strokeWidth="0.8" filter={`url(#${ids.shadow})`} />
        <path d="M9 17h6l-1 2H10l-1-2z" fill="#0F766E" />
      </>
    )}
  </PlanIcon>
);

const PlanFrameIcon = () => (
  <PlanIcon primary="#E2E8F0" secondary="#CBD5F5" highlight="#F8FAFC">
    {(ids) => (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2.5" fill={`url(#${ids.primary})`} stroke="#64748B" strokeWidth="0.8" filter={`url(#${ids.shadow})`} />
        <rect x="6.5" y="7.5" width="11" height="2.5" rx="1.2" fill={`url(#${ids.highlight})`} />
      </>
    )}
  </PlanIcon>
);

const PlanImageIcon = () => (
  <PlanIcon primary="#BBF7D0" secondary="#22C55E" highlight="#DCFCE7">
    {(ids) => (
      <>
        <rect x="4.5" y="5.5" width="15" height="13" rx="2" fill={`url(#${ids.primary})`} stroke="#15803D" strokeWidth="0.8" filter={`url(#${ids.shadow})`} />
        <path d="M7.5 15.5l3.5-4 3 3 2.5-2.5 2.5 3.5" fill="none" stroke="#166534" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="9" r="1.4" fill="#166534" />
      </>
    )}
  </PlanIcon>
);

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
  onAddStickyNote,
  onActivateBrush,
  onAddTimer,
  onAddVote,
  onAddKanban,
  onAddMindMap,
  fileInputRef,
  onFileChange,
  onUploadClick,
  leftOffset = 8,
  penSubTool,
  setPenSubTool,
  layout = 'vertical',
  mode = 'default',
}: ToolbarProps) {
  const isPlanMode = mode === 'plan';
  const isHorizontal = layout === 'horizontal' || isPlanMode;
  const buttonClass = (active: boolean) => btnClass(active, isPlanMode ? 'plan' : 'default');

  // Tooltip position based on layout
  const tooltipSide = isHorizontal ? 'top' : (isPlanMode ? 'left' : 'right');

  const verticalLayout = !isHorizontal;
  const planModeBottomCenterStyle: CSSProperties = {
    left: '50%',
    bottom: '16px',
    transform: 'translateX(-50%)',
    transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1), bottom 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  };
  const defaultVerticalStyle: CSSProperties = {
    left: `${leftOffset}px`,
    top: 'calc((100vh - 76px) / 2 - 20px)',
    transform: 'translateY(-50%)',
    transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1), top 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  };

  return (
    <TooltipProvider>
      <div
        className={`${!verticalLayout
          ? 'fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-row gap-2.5 bg-white px-4 py-2 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.12)] border border-border/60 ring-1 ring-black/5 z-50'
          : `${isPlanMode ? 'fixed' : 'absolute'} flex flex-col gap-2.5 bg-white px-1.5 py-3 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-border/60 ring-1 ring-black/5 z-50 transition-all duration-200 ease-out`}`}
        style={verticalLayout ? (isPlanMode ? planModeBottomCenterStyle : defaultVerticalStyle) : undefined}
      >
        {/* Pointer/Hand tool */}
        <div className="relative inline-flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={buttonClass(activeToolbarButton === 'pointer' || activeToolbarButton === 'hand')}
                aria-label="Current Tool"
                onClick={() => {
                  const next = activeTool === 'hand' ? 'pointer' : 'hand';
                  setActiveTool(next);
                  setActiveToolbarButton(next);
                }}
              >
                {activeTool === 'hand' ? (isPlanMode ? <PlanHandIcon /> : <Hand />) : (isPlanMode ? <PlanPointerIcon /> : <MousePointer />)}
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
                {isPlanMode ? <PlanPointerIcon /> : <MousePointer className="w-4 h-4" />} Pointer
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-sm" onClick={() => { setActiveTool('hand'); setActiveToolbarButton('hand'); }}>
                {isPlanMode ? <PlanHandIcon /> : <Hand className="w-4 h-4" />} Hand
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isPlanMode ? (
          <>
            {/* ---- FigJam-style whiteboard tools for Plan mode ---- */}

            {/* Sticky Note */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => { setActiveToolbarButton('text'); onAddStickyNote?.(); }}
                  variant="ghost"
                  className={buttonClass(activeToolbarButton === 'text')}
                  aria-label="Sticky Note"
                >
                  <PlanStickyNoteIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Sticky Note</TooltipContent>
            </Tooltip>

            {/* Shapes (rect, circle, diamond) */}
            <div className="relative inline-flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => { setActiveToolbarButton('shape'); }}
                    variant="ghost"
                    className={buttonClass(activeToolbarButton === 'shape')}
                    aria-label="Shape"
                  >
                    {activeShape === 'circle' ? <PlanCircleIcon /> : activeShape === 'diamond' ? <PlanDiamondIcon /> : activeShape === 'line' ? <PlanLineIcon /> : <PlanRectIcon />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">
                  {activeShape === 'rect' ? 'Rectangle' : activeShape === 'circle' ? 'Circle' : activeShape === 'diamond' ? 'Diamond' : 'Line'}
                </TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 p-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0 [&_svg]:!size-2" aria-label="More shapes">
                    <ChevronDown className="w-2 h-2 text-foreground/80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side={isHorizontal ? 'top' : 'right'} sideOffset={6} className="rounded-xl">
                  <DropdownMenuItem className="gap-2 text-sm" onClick={() => { setActiveToolbarButton('shape'); setActiveShape('rect'); }}>
                    <PlanRectIcon /> Rectangle
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-sm" onClick={() => { setActiveToolbarButton('shape'); setActiveShape('circle'); }}>
                    <PlanCircleIcon /> Circle
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 text-sm" onClick={() => { setActiveToolbarButton('shape'); setActiveShape('diamond'); }}>
                    <PlanDiamondIcon /> Diamond
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Connector / Arrow */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => { setActiveToolbarButton('pen'); setPenSubTool('draw'); }}
                  variant="ghost"
                  className={buttonClass(activeToolbarButton === 'pen')}
                  aria-label="Connector"
                >
                  <PlanConnectorIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Connector</TooltipContent>
            </Tooltip>

            {/* Draw / Marker */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => { setActiveToolbarButton('brush'); onActivateBrush?.(); }}
                  variant="ghost"
                  className={buttonClass(activeToolbarButton === 'brush')}
                  aria-label="Marker"
                >
                  <PlanMarkerIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Marker</TooltipContent>
            </Tooltip>

            {/* Section / Frame */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => { setActiveToolbarButton('artboard'); }}
                  variant="ghost"
                  className={buttonClass(activeToolbarButton === 'artboard')}
                  aria-label="Section"
                >
                  <PlanFrameIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Section</TooltipContent>
            </Tooltip>

            {/* Upload Image */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    setActiveToolbarButton('upload');
                    onUploadClick();
                  }}
                  variant="ghost"
                  className={buttonClass(activeToolbarButton === 'upload')}
                  aria-label="Upload Image"
                >
                  <PlanImageIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Image</TooltipContent>
            </Tooltip>

            {/* Timer, Vote, Kanban, Mind Map removed in plan mode */}
          </>
        ) : (
          <>
            {/* ---- Default design tools ---- */}

            {/* Text */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => { setActiveToolbarButton('text'); onAddText(); }} variant="ghost" className={buttonClass(activeToolbarButton === 'text')} aria-label="Add Text">
                  <Type />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Add Text</TooltipContent>
            </Tooltip>

            {/* Shapes */}
            <div className="relative inline-flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => { setActiveToolbarButton('shape'); }} variant="ghost" className={buttonClass(activeToolbarButton === 'shape')} aria-label="Add Shape">
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
                <Button onClick={() => { setActiveToolbarButton('artboard'); }} variant="ghost" className={buttonClass(activeToolbarButton === 'artboard')} aria-label="Artboard">
                  <Frame />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide} sideOffset={12} className="z-[60]">Artboard</TooltipContent>
            </Tooltip>

            {/* Pen Tool */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => { setActiveToolbarButton('pen'); setPenSubTool('draw'); }} variant="ghost" className={buttonClass(activeToolbarButton === 'pen')} aria-label="Pen Tool">
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

          </>
        )}
      </div>

      {/* Pen Sub-toolbar - appears when pen tool is active (only in vertical layout, design mode) */}
      {activeToolbarButton === 'pen' && !isHorizontal && !isPlanMode && (
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
                className={buttonClass(penSubTool === 'pointer')}
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
                className={buttonClass(penSubTool === 'curve')}
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
