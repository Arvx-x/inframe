'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas as FabricCanvas, Image as FabricImage, Textbox as FabricTextbox, Rect as FabricRect, Circle as FabricCircle, Line as FabricLine, Path as FabricPath, filters, Point, Object as FabricObject, Group as FabricGroup, ActiveSelection as FabricActiveSelection } from "fabric";
import { Button } from "@/app/components/ui/button";
import { Download, RotateCcw, ImagePlus, Crop, Trash2, Save, Share, Layers as LayersIcon, Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { InspectorSidebar } from "@/app/components/InspectorSidebar";
import { Toolbar } from "@/app/components/Toolbar";
import { PathEditor } from "@/app/components/PathEditor";
// use local Next.js API route for canvas commands
import { executeActions } from "@/app/lib/agent/executor";
import type { AgentAction } from "@/app/lib/agent/canvas-schema";
import LayersPanel from "@/app/components/LayersPanel";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/app/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { Label } from "@/app/components/ui/label";
import { Skeleton } from "@/app/components/ui/skeleton";

interface CanvasProps {
  generatedImageUrl: string | null;
  generatedVideoUrl?: string | null;
  isImagePending?: boolean;
  pendingImageRatio?: string | null;
  onClear: () => void;
  onCanvasCommandRef?: React.MutableRefObject<((command: string) => Promise<string>) | null>;
  onCanvasHistoryRef?: React.MutableRefObject<{ undo: () => void; redo: () => void } | null>;
  onHistoryAvailableChange?: (available: boolean) => void;
  onCanvasExportRef?: React.MutableRefObject<(() => void) | null>;
  onCanvasSaveRef?: React.MutableRefObject<(() => any) | null>;
  onCanvasColorRef?: React.MutableRefObject<((color: string) => void) | null>;
  onCanvasInstanceRef?: React.MutableRefObject<(() => string | null) | null>;
  onCanvasNodesRef?: React.MutableRefObject<CanvasNodesApi | null>;
  initialCanvasColor?: string;
  initialCanvasData?: any;
  isLayersOpen?: boolean;
  onLayersOpenChange?: (open: boolean) => void;
  onSelectedObjectChange?: (object: any) => void;
  onCanvasInstanceChange?: (canvas: any) => void;
  onCanvasDataChange?: (data: any) => void;
  toolbarLayout?: 'vertical' | 'horizontal';
  toolbarMode?: 'default' | 'plan';
  showLayersPanel?: boolean;
  backgroundStyle?: 'grid' | 'plain';
}

type CanvasNodeKind =
  | 'input'
  | 'output'
  | 'image-input'
  | 'text-image-input'
  | 'op-video-gen'
  | 'op-asset-gen'
  | 'op-ad-stitch'
  | 'op-bg-removal'
  | 'op-smart-edit'
  | 'tool-brand-tagline'
  | 'tool-ad-headline'
  | 'tool-product-shortener'
  | 'tool-cta-generator'
  | 'tool-campaign-hook'
  | 'tool-audience-persona'
  | 'tool-swot'
  | 'tool-positioning'
  | 'tool-social-caption'
  | 'tool-hashtag'
  | 'tool-email-subject'
  | 'tool-blog-outline'
  | 'tool-brand-voice'
  | 'tool-name-generator'
  | 'tool-value-prop'
  | 'tool-elevator-pitch';

type CanvasNodesApi = {
  addInputNode: () => void;
  addImageInputNode: () => void;
  addTextImageInputNode: () => void;
  addToolNode: (kind: CanvasNodeKind) => void;
  connectSelectedNodes: () => void;
  runSelectedTools: () => void;
};

// SVG Path utility functions
interface PathPoint {
  x: number;
  y: number;
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
}

function pointsToSVGPath(points: PathPoint[], previewPoint?: { x: number; y: number }, isClosed: boolean = false): string {
  if (points.length === 0) return '';

  let path = `M ${points[0].x} ${points[0].y}`;

  // Draw lines to all points except the first (if closed, we'll use Z command instead)
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Check if we have control points for a curve
    if (curr.cp1x !== undefined && curr.cp1y !== undefined &&
      prev.cp2x !== undefined && prev.cp2y !== undefined) {
      // Cubic Bézier curve
      path += ` C ${prev.cp2x} ${prev.cp2y}, ${curr.cp1x} ${curr.cp1y}, ${curr.x} ${curr.y}`;
    } else {
      // Straight line
      path += ` L ${curr.x} ${curr.y}`;
    }
  }

  // If path is closed, use Z command to close it (connects to first point)
  if (isClosed && points.length > 2) {
    path += ' Z';
  }

  // Add preview line if drawing (and not closed)
  if (previewPoint && points.length > 0 && !isClosed) {
    const last = points[points.length - 1];
    path += ` L ${previewPoint.x} ${previewPoint.y}`;
  }

  return path;
}

// Parse SVG path string to extract points
function parseSVGPath(pathString: string): PathPoint[] {
  const points: PathPoint[] = [];
  if (!pathString) return points;

  // Simple parser for M, L, and C commands
  const commands = pathString.match(/[MLC][^MLC]*/g) || [];
  let currentX = 0;
  let currentY = 0;
  let prevCp2x: number | undefined;
  let prevCp2y: number | undefined;

  for (const cmd of commands) {
    const type = cmd[0];
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

    if (type === 'M' && coords.length >= 2) {
      // Move command - start point
      currentX = coords[0];
      currentY = coords[1];
      points.push({ x: currentX, y: currentY });
      prevCp2x = undefined;
      prevCp2y = undefined;
    } else if (type === 'L' && coords.length >= 2) {
      // Line command
      currentX = coords[0];
      currentY = coords[1];
      points.push({ x: currentX, y: currentY });
      prevCp2x = undefined;
      prevCp2y = undefined;
    } else if (type === 'C' && coords.length >= 6) {
      // Cubic Bézier curve: C cp1x cp1y cp2x cp2y x y
      const cp1x = coords[0];
      const cp1y = coords[1];
      const cp2x = coords[2];
      const cp2y = coords[3];
      currentX = coords[4];
      currentY = coords[5];

      // Update previous point with cp2
      if (points.length > 0) {
        const prev = points[points.length - 1];
        prev.cp2x = cp2x;
        prev.cp2y = cp2y;
      }

      // Add new point with cp1
      points.push({
        x: currentX,
        y: currentY,
        cp1x,
        cp1y,
      });

      prevCp2x = cp2x;
      prevCp2y = cp2y;
    }
  }

  return points;
}

// Update path object with new points
function updatePathFromPoints(path: any, points: PathPoint[], isClosed: boolean = false): void {
  const pathString = pointsToSVGPath(points, undefined, isClosed);
  if (pathString) {
    path.set({ path: pathString });
    // Store points for editing
    (path as any).__pathPoints = points;
    path.setCoords();
  }
}

const applyCurveHandles = (prev: PathPoint, curr: PathPoint) => {
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;
  prev.cp2x = prev.x + dx * CURVE_HANDLE_TENSION;
  prev.cp2y = prev.y + dy * CURVE_HANDLE_TENSION;
  curr.cp1x = curr.x - dx * CURVE_HANDLE_TENSION;
  curr.cp1y = curr.y - dy * CURVE_HANDLE_TENSION;
};

const clearCurveHandles = (point: PathPoint, target: 'cp1' | 'cp2' | 'both' = 'both') => {
  if (target === 'cp1' || target === 'both') {
    point.cp1x = undefined;
    point.cp1y = undefined;
  }
  if (target === 'cp2' || target === 'both') {
    point.cp2x = undefined;
    point.cp2y = undefined;
  }
};

const DEFAULT_PLACEHOLDER_SIZE = 200;
const PLACEHOLDER_VERTICAL_OFFSET_RATIO = 0.08;
const PLACEHOLDER_MIN_TOP = 16;
const PEN_CLOSE_THRESHOLD = 14;
const CURVE_HANDLE_TENSION = 0.4;

const parseRatio = (ratio?: string | null): { width: number; height: number } | null => {
  if (!ratio) return null;
  const normalized = ratio.replace(/\s+/g, '').toLowerCase();
  const parts = normalized.split(/[×x:]/);
  if (parts.length !== 2) return null;
  const width = Number(parts[0]) || 1;
  const height = Number(parts[1]) || 1;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
};

const computeImagePlacement = (
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number
) => {
  const left = (canvasWidth - imageWidth) / 2;
  const verticalOffset = canvasHeight * PLACEHOLDER_VERTICAL_OFFSET_RATIO;
  const top = Math.max((canvasHeight - imageHeight) / 2 - verticalOffset, PLACEHOLDER_MIN_TOP);
  return { left, top };
};

export default function Canvas({
  generatedImageUrl,
  generatedVideoUrl,
  isImagePending = false,
  pendingImageRatio = null,
  onClear,
  onCanvasCommandRef,
  onCanvasHistoryRef,
  onHistoryAvailableChange,
  onCanvasExportRef,
  onCanvasSaveRef,
  onCanvasColorRef,
  onCanvasInstanceRef,
  onCanvasNodesRef,
  initialCanvasColor = "#F4F4F6",
  initialCanvasData,
  isLayersOpen: isLayersOpenProp,
  onLayersOpenChange,
  onSelectedObjectChange,
  onCanvasInstanceChange,
  onCanvasDataChange,
  toolbarLayout = 'horizontal',
  toolbarMode = 'default',
  showLayersPanel = true,
  backgroundStyle = 'grid',
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [gridOffset, setGridOffset] = useState({ x: 0, y: 0 });
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedImage, setSelectedImage] = useState<FabricImage | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const cropRectRef = useRef<FabricRect | null>(null);
  const [imageFilters, setImageFilters] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    blur: 0,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nodeImageFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageNodeRef = useRef<FabricObject | null>(null);
  const isPanningRef = useRef(false);
  const [activeTool, setActiveTool] = useState<"pointer" | "hand">("pointer");
  const activeToolRef = useRef<"pointer" | "hand">("pointer");
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: DEFAULT_PLACEHOLDER_SIZE,
    height: DEFAULT_PLACEHOLDER_SIZE,
  });

  useEffect(() => {
    if (!fabricCanvas) return;
    const updateDimensions = () => {
      const width =
        typeof (fabricCanvas as any).getWidth === "function"
          ? (fabricCanvas as any).getWidth()
          : fabricCanvas.getWidth?.() ?? fabricCanvas.width ?? DEFAULT_PLACEHOLDER_SIZE;
      const height =
        typeof (fabricCanvas as any).getHeight === "function"
          ? (fabricCanvas as any).getHeight()
          : fabricCanvas.getHeight?.() ?? fabricCanvas.height ?? DEFAULT_PLACEHOLDER_SIZE;
      setCanvasDimensions({
        width: Math.max(width, DEFAULT_PLACEHOLDER_SIZE),
        height: Math.max(height, DEFAULT_PLACEHOLDER_SIZE),
      });
    };

    updateDimensions();
    const handleResize = () => updateDimensions();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [fabricCanvas]);

  // Load initial canvas data
  const lastLoadedDataRef = useRef<any>(null);
  const isLoadingRef = useRef(false);
  const skipNextLoadRef = useRef(false);
  useEffect(() => {
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
    if (fabricCanvas && initialCanvasData) {
      isLoadingRef.current = true;
      fabricCanvas.loadFromJSON(initialCanvasData, () => {
        fabricCanvas.renderAll();
        lastLoadedDataRef.current = initialCanvasData;
        // Reset history stack after loading initial data
        undoStackRef.current = [];
        redoStackRef.current = [];
        setHistoryAvailability();
        isLoadingRef.current = false;
      });
    }
  }, [fabricCanvas, initialCanvasData]);

  // Persist canvas changes (add/remove/modify) so edits are not lost when switching modes
  useEffect(() => {
    if (!fabricCanvas || !onCanvasDataChange) return;

    const debounceMs = 300;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleSave = () => {
      if (isLoadingRef.current) return;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const data = fabricCanvas.toJSON();
        if (data) {
          lastLoadedDataRef.current = data;
          skipNextLoadRef.current = true; // Prevent reload — our save would replace videos with static frames
          onCanvasDataChange(data);
        }
      }, debounceMs);
    };

    fabricCanvas.on('object:added', scheduleSave);
    fabricCanvas.on('object:removed', scheduleSave);
    fabricCanvas.on('object:modified', scheduleSave);

    return () => {
      clearTimeout(timeoutId);
      fabricCanvas.off('object:added', scheduleSave);
      fabricCanvas.off('object:removed', scheduleSave);
      fabricCanvas.off('object:modified', scheduleSave);
    };
  }, [fabricCanvas, onCanvasDataChange]);

  const placeholderSize = useMemo(() => {
    const { width: canvasWidth, height: canvasHeight } = canvasDimensions;
    if (!canvasWidth || !canvasHeight) {
      return { width: DEFAULT_PLACEHOLDER_SIZE, height: DEFAULT_PLACEHOLDER_SIZE };
    }

    const maxWidth = canvasWidth * 0.6;
    const maxHeight = canvasHeight * 0.6;
    const ratio = parseRatio(pendingImageRatio);

    if (!ratio) {
      const side = Math.max(DEFAULT_PLACEHOLDER_SIZE, Math.min(maxWidth, maxHeight));
      return { width: side, height: side };
    }

    const aspect = ratio.width / ratio.height;
    let width = maxWidth;
    let height = width / aspect;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }

    width = Math.max(width, DEFAULT_PLACEHOLDER_SIZE);
    height = Math.max(height, DEFAULT_PLACEHOLDER_SIZE);

    return { width, height };
  }, [canvasDimensions, pendingImageRatio]);

  const placeholderPosition = useMemo(() => {
    const { width: canvasWidth, height: canvasHeight } = canvasDimensions;
    if (!canvasWidth || !canvasHeight) {
      return { left: '50%', top: '50%' };
    }
    const { left, top } = computeImagePlacement(
      canvasWidth,
      canvasHeight,
      placeholderSize.width,
      placeholderSize.height
    );
    return { left: `${left}px`, top: `${top}px` };
  }, [canvasDimensions, placeholderSize]);

  const activeToolbarButtonRef = useRef<'pointer' | 'hand' | 'text' | 'shape' | 'upload' | 'reference' | 'selector' | 'artboard' | 'pen' | 'colorPicker' | 'brush' | 'move' | 'layers' | 'grid' | 'ruler' | 'eraser' | 'eye' | 'zoomIn' | 'zoomOut' | 'timer' | 'vote' | 'kanban' | 'mindmap'>('pointer');
  const [activeShape, setActiveShape] = useState<"rect" | "circle" | "line" | "diamond">("circle");
  const activeShapeRef = useRef<"rect" | "circle" | "line" | "diamond">("circle");
  const [activeToolbarButton, setActiveToolbarButton] = useState<
    'pointer' | 'hand' | 'text' | 'shape' | 'upload' | 'reference' | 'selector' | 'artboard' | 'pen' | 'colorPicker' | 'brush' | 'move' | 'layers' | 'grid' | 'ruler' | 'eraser' | 'eye' | 'zoomIn' | 'zoomOut' | 'timer' | 'vote' | 'kanban' | 'mindmap'
  >('pointer');
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [penSubTool, setPenSubTool] = useState<'draw' | 'pointer' | 'curve'>('draw');
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [isSidebarClosing, setIsSidebarClosing] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'svg'>('png');
  const [exportType, setExportType] = useState<'canvas' | 'artboard' | 'selected'>('canvas');
  const [exportPreview, setExportPreview] = useState<string | null>(null);
  const [videoControlsRect, setVideoControlsRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [videoPlayingState, setVideoPlayingState] = useState(false);
  const videoControlsRef = useRef<HTMLDivElement | null>(null);
  const isPlanMode = toolbarMode === 'plan';
  const showGrid = backgroundStyle === 'grid';
  const nodesRef = useRef<Record<string, { id: string; kind: CanvasNodeKind; object: FabricObject }>>({});
  const connectionsRef = useRef<Record<string, { id: string; fromId: string; toId: string; fromSide: 'left' | 'right'; toSide: 'left' | 'right'; line: FabricLine; arrow?: any }>>({});
  const activeConnectorRef = useRef<{ fromId: string; fromSide: 'left' | 'right'; line: FabricLine } | null>(null);
  const isDrawingShapeRef = useRef(false);
  const isDrawingTextRef = useRef(false);
  const isDrawingArtboardRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawingShapeRef = useRef<FabricRect | FabricCircle | FabricLine | FabricPath | null>(null);
  const drawingArtboardRef = useRef<FabricRect | null>(null);
  const drawingTextBoxRef = useRef<FabricRect | null>(null);
  const drawingTextLabelRef = useRef<FabricTextbox | null>(null);

  // Path creation state
  const penSubToolRef = useRef<'draw' | 'pointer' | 'curve'>('draw');
  const isDrawingPathRef = useRef(false);
  const isPathDrawingStoppedRef = useRef(false); // Track if drawing is stopped after closing
  const isPathClosedRef = useRef(false); // Track if path is closed (without duplicating first point)
  const currentPathPointsRef = useRef<PathPoint[]>([]);
  const currentPathRef = useRef<any>(null); // Fabric Path preview
  const penNodeHandlesRef = useRef<FabricCircle[]>([]);
  const penNodeLinesRef = useRef<FabricLine[]>([]);
  const penPreviewLineRef = useRef<FabricLine | null>(null);
  const isDraggingControlHandleRef = useRef(false);
  const draggingHandleIndexRef = useRef<number | null>(null);
  const draggingHandleTypeRef = useRef<'point' | 'cp1' | 'cp2' | null>(null);

  // Path editing state
  const isEditingPathRef = useRef(false);
  const selectedPathRef = useRef<any>(null);
  const selectedPointIndexRef = useRef<number | null>(null);
  const pathEditorHandlesRef = useRef<any[]>([]);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editingPathPoints, setEditingPathPoints] = useState<PathPoint[]>([]);

  // Use controlled layers state if provided, otherwise use internal state
  const [internalLayersOpen, setInternalLayersOpen] = useState(true);
  const isLayersOpen = isLayersOpenProp !== undefined ? isLayersOpenProp : internalLayersOpen;
  const setIsLayersOpen = (open: boolean) => {
    if (onLayersOpenChange) {
      onLayersOpenChange(open);
    } else {
      setInternalLayersOpen(open);
    }
  };
  const setHistoryAvailability = () => {
    if (onHistoryAvailableChange) {
      onHistoryAvailableChange((undoStackRef.current?.length || 0) > 0);
    }
  };
  const undoStackRef = useRef<AgentAction[][]>([]);
  const redoStackRef = useRef<AgentAction[][]>([]);

  const clearPenNodeOverlay = (canvas: FabricCanvas) => {
    penNodeHandlesRef.current.forEach(handle => canvas.remove(handle));
    penNodeHandlesRef.current = [];
    penNodeLinesRef.current.forEach(line => canvas.remove(line));
    penNodeLinesRef.current = [];
    if (penPreviewLineRef.current) {
      canvas.remove(penPreviewLineRef.current);
      penPreviewLineRef.current = null;
    }
  };

  const getCanvasCenter = () => {
    const width =
      typeof (fabricCanvas as any)?.getWidth === "function"
        ? (fabricCanvas as any).getWidth()
        : fabricCanvas?.getWidth?.() ?? fabricCanvas?.width ?? DEFAULT_PLACEHOLDER_SIZE;
    const height =
      typeof (fabricCanvas as any)?.getHeight === "function"
        ? (fabricCanvas as any).getHeight()
        : fabricCanvas?.getHeight?.() ?? fabricCanvas?.height ?? DEFAULT_PLACEHOLDER_SIZE;
    return { x: width / 2, y: height / 2 };
  };

  const getConnectionPoint = (obj: FabricObject, side: 'left' | 'right') => {
    const bounds = (obj as any).getBoundingRect?.(true) ?? { left: obj.left || 0, top: obj.top || 0, width: obj.width || 0, height: obj.height || 0 };
    const y = bounds.top + bounds.height / 2;
    const x = side === 'left' ? bounds.left : bounds.left + bounds.width;
    return { x, y };
  };

  const updateConnectionsForNode = (nodeId: string) => {
    const entries = Object.values(connectionsRef.current).filter(
      (conn) => conn.fromId === nodeId || conn.toId === nodeId
    );
    entries.forEach((conn: any) => {
      const fromNode = nodesRef.current[conn.fromId];
      const toNode = nodesRef.current[conn.toId];
      if (!fromNode || !toNode) return;
      const fromPoint = getConnectionPoint(fromNode.object, conn.fromSide);
      const toPoint = getConnectionPoint(toNode.object, conn.toSide);
      conn.line.set({ x1: fromPoint.x, y1: fromPoint.y, x2: toPoint.x, y2: toPoint.y });
      // Update arrowhead
      if (conn.arrow && fabricCanvas) {
        fabricCanvas.remove(conn.arrow);
        const newArrow = makeArrowHead(toPoint.x, toPoint.y, fromPoint.x, fromPoint.y, conn.line.stroke || '#6B7280');
        (newArrow as any).__connectionId = conn.id;
        conn.arrow = newArrow;
        fabricCanvas.add(newArrow);
        (fabricCanvas as any).sendToBack(newArrow);
      }
    });
    fabricCanvas?.requestRenderAll();
  };

  const makeArrowHead = (x2: number, y2: number, x1: number, y1: number, color: string) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 10;
    const p1x = x2 - headLen * Math.cos(angle - Math.PI / 6);
    const p1y = y2 - headLen * Math.sin(angle - Math.PI / 6);
    const p2x = x2 - headLen * Math.cos(angle + Math.PI / 6);
    const p2y = y2 - headLen * Math.sin(angle + Math.PI / 6);
    const pathStr = `M ${p1x} ${p1y} L ${x2} ${y2} L ${p2x} ${p2y}`;
    return new FabricPath(pathStr, {
      stroke: color,
      strokeWidth: 2,
      fill: 'transparent',
      selectable: false,
      evented: false,
    });
  };

  const createConnection = (
    fromId: string,
    toId: string,
    fromSide: 'left' | 'right',
    toSide: 'left' | 'right',
    color: string = "#6B7280"
  ) => {
    if (!fabricCanvas) return null;
    const fromNode = nodesRef.current[fromId];
    const toNode = nodesRef.current[toId];
    if (!fromNode || !toNode) return null;
    const fromPoint = getConnectionPoint(fromNode.object, fromSide);
    const toPoint = getConnectionPoint(toNode.object, toSide);
    const line = new FabricLine([fromPoint.x, fromPoint.y, toPoint.x, toPoint.y], {
      stroke: color,
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });
    const arrow = makeArrowHead(toPoint.x, toPoint.y, fromPoint.x, fromPoint.y, color);
    const connId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    (arrow as any).__connectionId = connId;
    (line as any).__connectionId = connId;
    connectionsRef.current[connId] = { id: connId, fromId, toId, fromSide, toSide, line, arrow } as any;
    fabricCanvas.add(line);
    fabricCanvas.add(arrow);
    (fabricCanvas as any).sendToBack(line);
    (fabricCanvas as any).sendToBack(arrow);
    (fabricCanvas as any).bringToFront(fromNode.object);
    (fabricCanvas as any).bringToFront(toNode.object);
    fabricCanvas.requestRenderAll();
    return connId;
  };

  const registerNodeObject = (obj: FabricObject, kind: CanvasNodeKind) => {
    const existingId = (obj as any).__nodeId as string | undefined;
    const nodeId = existingId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    (obj as any).__nodeId = nodeId;
    (obj as any).__nodeKind = kind;
    nodesRef.current[nodeId] = { id: nodeId, kind, object: obj };
    obj.on('moving', () => updateConnectionsForNode(nodeId));
    obj.on('scaling', () => updateConnectionsForNode(nodeId));
    obj.on('modified', () => updateConnectionsForNode(nodeId));
    return nodeId;
  };

  const ensureNodeFromObject = (obj: FabricObject) => {
    const existingId = (obj as any).__nodeId as string | undefined;
    if (existingId) {
      return existingId;
    }
    if (obj.type === 'textbox') {
      return registerNodeObject(obj, 'input');
    }
    return null;
  };

  const addInputNode = () => {
    if (!fabricCanvas) return;
    const { x, y } = getCanvasCenter();
    const NODE_W = 260;
    const NODE_H = 80;
    const rect = new FabricRect({
      width: NODE_W,
      height: NODE_H,
      rx: 10, ry: 10,
      fill: "#FFF9DB",
      stroke: "#F59E0B",
      strokeWidth: 1,
    });
    const title = new FabricTextbox("Text Input", {
      left: 16, top: 8, width: NODE_W - 32,
      fontSize: 13, fontWeight: 600, fill: "#92400E",
      editable: false, selectable: false,
    });
    const body = new FabricTextbox("Paste your rough draft here...", {
      left: 16, top: 30, width: NODE_W - 32,
      fontSize: 11, fill: "#78350F",
      editable: true, selectable: true,
    });
    const outputConn = new FabricCircle({
      radius: 6, left: NODE_W - 6, top: NODE_H / 2 - 6,
      fill: "#FFFFFF", stroke: "#F59E0B", strokeWidth: 2,
      selectable: true, evented: true, hoverCursor: "crosshair",
    });
    const group = new FabricGroup([rect, title, body, outputConn], {
      left: x - NODE_W / 2 - 180,
      top: y - NODE_H / 2,
      subTargetCheck: true,
    });
    const nodeId = registerNodeObject(group as unknown as FabricObject, 'input');
    (outputConn as any).__connectorSide = 'right';
    (outputConn as any).__nodeId = nodeId;
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();
  };

  const addImageInputNode = () => {
    if (!fabricCanvas) return;
    const { x, y } = getCanvasCenter();
    const NODE_W = 260;
    const NODE_H = 100;
    const rect = new FabricRect({
      width: NODE_W, height: NODE_H, rx: 10, ry: 10,
      fill: "#E0F2FE", stroke: "#0EA5E9", strokeWidth: 1,
    });
    const title = new FabricTextbox("Image Input", {
      left: 16, top: 8, width: NODE_W - 32,
      fontSize: 13, fontWeight: 600, fill: "#0C4A6E",
      editable: false, selectable: false,
    });
    const uploadZone = new FabricRect({
      left: 16, top: 32, width: NODE_W - 32, height: 44,
      rx: 6, ry: 6,
      fill: "#BAE6FD",
      stroke: "#0EA5E9",
      strokeWidth: 1,
      selectable: true, evented: true, hoverCursor: "pointer",
    });
    (uploadZone as any).__isUploadZone = true;
    const uploadLabel = new FabricTextbox("Click to upload", {
      left: 26, top: 44, width: NODE_W - 52,
      fontSize: 11, fill: "#0369A1",
      editable: false, selectable: false, evented: false,
    });
    const outputConn = new FabricCircle({
      radius: 6, left: NODE_W - 6, top: NODE_H / 2 - 6,
      fill: "#FFFFFF", stroke: "#0EA5E9", strokeWidth: 2,
      selectable: true, evented: true, hoverCursor: "crosshair",
    });
    const group = new FabricGroup([rect, title, uploadZone, uploadLabel, outputConn], {
      left: x - NODE_W / 2 - 180,
      top: y - NODE_H / 2,
      subTargetCheck: true,
    });
    const nodeId = registerNodeObject(group as unknown as FabricObject, 'image-input');
    (uploadZone as any).__nodeId = nodeId;
    (outputConn as any).__connectorSide = 'right';
    (outputConn as any).__nodeId = nodeId;
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();
  };

  const addTextImageInputNode = () => {
    if (!fabricCanvas) return;
    const { x, y } = getCanvasCenter();
    const NODE_W = 260;
    const NODE_H = 130;
    const rect = new FabricRect({
      width: NODE_W, height: NODE_H, rx: 10, ry: 10,
      fill: "#E0E7FF", stroke: "#6366F1", strokeWidth: 1,
    });
    const title = new FabricTextbox("Text + Image Input", {
      left: 16, top: 8, width: NODE_W - 32,
      fontSize: 13, fontWeight: 600, fill: "#312E81",
      editable: false, selectable: false,
    });
    const body = new FabricTextbox("Enter prompt or description...", {
      left: 16, top: 28, width: NODE_W - 32,
      fontSize: 11, fill: "#4338CA",
      editable: true, selectable: true,
    });
    const uploadZone = new FabricRect({
      left: 16, top: 52, width: NODE_W - 32, height: 44,
      rx: 6, ry: 6,
      fill: "#C7D2FE",
      stroke: "#6366F1",
      strokeWidth: 1,
      selectable: true, evented: true, hoverCursor: "pointer",
    });
    (uploadZone as any).__isUploadZone = true;
    const uploadLabel = new FabricTextbox("Click to upload image", {
      left: 26, top: 64, width: NODE_W - 52,
      fontSize: 11, fill: "#4338CA",
      editable: false, selectable: false, evented: false,
    });
    const outputConn = new FabricCircle({
      radius: 6, left: NODE_W - 6, top: NODE_H / 2 - 6,
      fill: "#FFFFFF", stroke: "#6366F1", strokeWidth: 2,
      selectable: true, evented: true, hoverCursor: "crosshair",
    });
    const group = new FabricGroup([rect, title, body, uploadZone, uploadLabel, outputConn], {
      left: x - NODE_W / 2 - 180,
      top: y - NODE_H / 2,
      subTargetCheck: true,
    });
    const nodeId = registerNodeObject(group as unknown as FabricObject, 'text-image-input');
    (uploadZone as any).__nodeId = nodeId;
    (outputConn as any).__connectorSide = 'right';
    (outputConn as any).__nodeId = nodeId;
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();
  };

  const addToolNode = (kind: CanvasNodeKind) => {
    if (!fabricCanvas) return;
    const { x, y } = getCanvasCenter();
    const NODE_W = 260;
    const NODE_H = 80;
    const toolLabelMap: Record<string, { title: string; desc: string; fill: string; stroke: string }> = {
      'op-video-gen':          { title: "Video Generation",  desc: "Generate video from image + prompt",              fill: "#FCE7F3", stroke: "#EC4899" },
      'op-asset-gen':          { title: "Asset Generation",  desc: "Generate images from text/image",                 fill: "#FCE7F3", stroke: "#EC4899" },
      'op-ad-stitch':          { title: "Ad Stitcher",       desc: "Compose video ad from clips/images",              fill: "#FCE7F3", stroke: "#EC4899" },
      'op-bg-removal':         { title: "Background Removal", desc: "Remove image background",                        fill: "#E0E7FF", stroke: "#6366F1" },
      'op-smart-edit':         { title: "Smart Edit",        desc: "Edit image with text instructions",               fill: "#E0E7FF", stroke: "#6366F1" },
      'tool-brand-tagline':    { title: "Brand Tagline",     desc: "Turn rough copy into a brand tagline.",           fill: "#E0F2FE", stroke: "#3B82F6" },
      'tool-ad-headline':      { title: "Ad Headline",       desc: "Generate attention-grabbing ad headlines.",       fill: "#E0F2FE", stroke: "#3B82F6" },
      'tool-product-shortener':{ title: "Copy Shortener",    desc: "Condense long descriptions into concise copy.",  fill: "#E0F2FE", stroke: "#3B82F6" },
      'tool-cta-generator':    { title: "CTA Generator",     desc: "Create compelling calls-to-action.",             fill: "#E0F2FE", stroke: "#3B82F6" },
      'tool-campaign-hook':    { title: "Campaign Hook",     desc: "Generate a hook idea for your campaign.",         fill: "#F3E8FF", stroke: "#8B5CF6" },
      'tool-audience-persona': { title: "Audience Persona",  desc: "Build a target audience persona from a brief.",  fill: "#F3E8FF", stroke: "#8B5CF6" },
      'tool-swot':             { title: "SWOT Analysis",     desc: "Generate strengths, weaknesses, opportunities.", fill: "#F3E8FF", stroke: "#8B5CF6" },
      'tool-positioning':      { title: "Brand Positioning", desc: "Craft a positioning statement.",                  fill: "#F3E8FF", stroke: "#8B5CF6" },
      'tool-social-caption':   { title: "Social Caption",    desc: "Write a social media caption from a brief.",     fill: "#DCFCE7", stroke: "#22C55E" },
      'tool-hashtag':          { title: "Hashtag Generator", desc: "Generate relevant hashtags for your content.",    fill: "#DCFCE7", stroke: "#22C55E" },
      'tool-email-subject':    { title: "Email Subject",     desc: "Craft high-open-rate email subject lines.",      fill: "#DCFCE7", stroke: "#22C55E" },
      'tool-blog-outline':     { title: "Blog Outline",      desc: "Create a structured blog post outline.",         fill: "#DCFCE7", stroke: "#22C55E" },
      'tool-brand-voice':      { title: "Brand Voice",       desc: "Define tone and voice guidelines.",              fill: "#FEF3C7", stroke: "#D97706" },
      'tool-name-generator':   { title: "Name Generator",    desc: "Brainstorm product or brand name ideas.",        fill: "#FEF3C7", stroke: "#D97706" },
      'tool-value-prop':       { title: "Value Proposition", desc: "Distill a clear value proposition statement.",   fill: "#FEF3C7", stroke: "#D97706" },
      'tool-elevator-pitch':   { title: "Elevator Pitch",    desc: "Generate a concise elevator pitch.",             fill: "#FEF3C7", stroke: "#D97706" },
      input:  { title: "Input",  desc: "", fill: "#FFF9DB", stroke: "#F59E0B" },
      output: { title: "Output", desc: "", fill: "#ECFDF3", stroke: "#10B981" },
    };
    const tool = toolLabelMap[kind] || { title: kind, desc: "", fill: "#F3F4F6", stroke: "#9CA3AF" };
    const rect = new FabricRect({
      width: NODE_W, height: NODE_H, rx: 10, ry: 10,
      fill: tool.fill, stroke: tool.stroke, strokeWidth: 1,
    });
    const title = new FabricTextbox(tool.title, {
      left: 20, top: 10, width: NODE_W - 40,
      fontSize: 13, fontWeight: 600, fill: "#111827",
      editable: false, selectable: false,
    });
    const desc = new FabricTextbox(tool.desc, {
      left: 20, top: 32, width: NODE_W - 40,
      fontSize: 11, fill: "#6B7280",
      editable: false, selectable: false,
    });
    const inputConnector = new FabricCircle({
      radius: 6, left: -6, top: NODE_H / 2 - 6,
      fill: "#FFFFFF", stroke: tool.stroke, strokeWidth: 2,
      selectable: true, evented: true, hoverCursor: "crosshair",
    });
    const outputConnector = new FabricCircle({
      radius: 6, left: NODE_W - 6, top: NODE_H / 2 - 6,
      fill: "#FFFFFF", stroke: tool.stroke, strokeWidth: 2,
      selectable: true, evented: true, hoverCursor: "crosshair",
    });
    const group = new FabricGroup([rect, title, desc, inputConnector, outputConnector], {
      left: x - NODE_W / 2,
      top: y - NODE_H / 2,
      subTargetCheck: true,
    });
    const nodeId = registerNodeObject(group as unknown as FabricObject, kind);
    (inputConnector as any).__connectorSide = 'left';
    (inputConnector as any).__nodeId = nodeId;
    (outputConnector as any).__connectorSide = 'right';
    (outputConnector as any).__nodeId = nodeId;
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();
  };

  const connectSelectedNodes = () => {
    if (!fabricCanvas) return;
    const selected = fabricCanvas.getActiveObjects().filter((obj) => {
      const hasNodeId = Boolean((obj as any).__nodeId);
      return hasNodeId || obj.type === 'textbox';
    });
    if (selected.length < 2) {
      toast.error("Select two nodes to connect.");
      return;
    }
    const fromObj = selected[0] as FabricObject;
    const toObj = selected[1] as FabricObject;
    const fromId = ensureNodeFromObject(fromObj);
    const toId = ensureNodeFromObject(toObj);
    if (!fromId || !toId) {
      toast.error("Select a valid input and tool node.");
      return;
    }
    createConnection(fromId, toId, 'right', 'left');
  };

  const getInputFromNode = (inputNode: { id: string; kind: CanvasNodeKind; object: FabricObject }): { text: string; imageData: string | null } => {
    let text = "";
    let imageData: string | null = null;
    const obj = inputNode.object;
    if ((obj as any).__imageData) imageData = (obj as any).__imageData;
    if (obj.type === 'textbox') {
      text = (obj as FabricTextbox).text || "";
    } else if (obj.type === 'group') {
      const grpObjs = ((obj as any)._objects || []) as FabricObject[];
      const textObjs = grpObjs.filter((o: any) => o.type === 'textbox' && o.editable);
      for (const t of textObjs) {
        const txt = (t as FabricTextbox).text || "";
        if (txt.trim()) text = txt;
      }
    }
    return { text: text.trim(), imageData };
  };

  const showNodeLoading = (nodeObj: FabricObject) => {
    if (!fabricCanvas) return (() => {});
    const bounds = (nodeObj as any).getBoundingRect?.(true) ?? { left: 0, top: 0, width: 260, height: 80 };
    const overlay = new FabricRect({
      left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height,
      fill: "rgba(255,255,255,0.8)", rx: 10, ry: 10,
      selectable: false, evented: false,
    });
    (overlay as any).__loadingOverlay = true;
    const label = new FabricTextbox("Loading...", {
      left: bounds.left + bounds.width / 2 - 40, top: bounds.top + bounds.height / 2 - 12,
      width: 80, fontSize: 12, fill: "#6B7280", editable: false, selectable: false, evented: false,
    });
    fabricCanvas.add(overlay);
    fabricCanvas.add(label);
    fabricCanvas.requestRenderAll();
    return () => {
      fabricCanvas.remove(overlay);
      fabricCanvas.remove(label);
      fabricCanvas.requestRenderAll();
    };
  };

  const executeNodeOperation = async (
    toolKind: CanvasNodeKind,
    inputText: string,
    inputImage: string | null
  ): Promise<{ type: 'text'; text: string } | { type: 'image'; imageUrl: string } | { type: 'video'; videoUrl?: string; videoBase64?: string; mimeType?: string }> => {
    const instructionMap: Record<string, string> = {
      'tool-brand-tagline': 'Generate a punchy brand tagline from this rough copy.',
      'tool-ad-headline': 'Generate attention-grabbing ad headlines from this brief.',
      'tool-cta-generator': 'Create compelling calls-to-action from this context.',
      'tool-social-caption': 'Write a social media caption from this brief.',
      'tool-product-shortener': 'Condense this long description into concise copy.',
      'tool-campaign-hook': 'Generate a compelling campaign hook from this brief.',
      'tool-audience-persona': 'Build a target audience persona from this brief.',
      'tool-swot': 'Generate a SWOT analysis from this context.',
      'tool-positioning': 'Craft a brand positioning statement from this.',
      'tool-hashtag': 'Generate relevant hashtags from this content.',
      'tool-email-subject': 'Craft high-open-rate email subject lines from this.',
      'tool-blog-outline': 'Create a structured blog post outline from this.',
      'tool-brand-voice': 'Define tone and voice guidelines from these examples.',
      'tool-name-generator': 'Brainstorm product or brand name ideas from this.',
      'tool-value-prop': 'Distill a clear value proposition from this.',
      'tool-elevator-pitch': 'Generate a concise elevator pitch from this.',
    };

    if (toolKind.startsWith('tool-')) {
      const instruction = instructionMap[toolKind] || `Generate marketing copy based on: ${toolKind}`;
      const res = await fetch('/api/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          context: { existingCopy: inputText },
          count: 1,
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Copy generation failed'));
      const data = await res.json();
      const text = data.copy?.variations?.[0]?.text ?? data.copy?.raw ?? JSON.stringify(data.copy);
      return { type: 'text', text };
    }

    if (toolKind === 'op-video-gen') {
      if (!inputImage && !inputText) throw new Error('Image or prompt required for video generation');
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceImageBase64: inputImage?.includes(',') ? inputImage.split(',')[1] : inputImage,
          prompt: inputText || 'Create smooth cinematic motion from this image.',
          duration: 4,
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Video generation failed'));
      const data = await res.json();
      if (data.videoBase64) {
        return { type: 'video', videoBase64: data.videoBase64, mimeType: data.mimeType };
      }
      if (data.videoUrl) return { type: 'video', videoUrl: data.videoUrl };
      throw new Error(data.message || 'Video generation failed');
    }

    if (toolKind === 'op-asset-gen') {
      if (!inputText) throw new Error('Prompt required for asset generation');
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: inputText,
          referenceImageUrl: inputImage || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Image generation failed'));
      const data = await res.json();
      if (!data.imageUrl) throw new Error('No image in response');
      return { type: 'image', imageUrl: data.imageUrl };
    }

    if (toolKind === 'op-bg-removal') {
      if (!inputImage) throw new Error('Image required for background removal');
      const base64 = inputImage.includes(',') ? inputImage.split(',')[1] : inputImage;
      const res = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: `data:image/png;base64,${base64}` }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Background removal failed'));
      const data = await res.json();
      if (!data.imageUrl) throw new Error('No image in response');
      return { type: 'image', imageUrl: data.imageUrl };
    }

    if (toolKind === 'op-smart-edit') {
      if (!inputImage || !inputText) throw new Error('Image and prompt required for smart edit');
      const res = await fetch('/api/smart-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: inputText,
          currentImageUrl: inputImage,
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Smart edit failed'));
      const data = await res.json();
      if (!data.imageUrl) throw new Error('No image in response');
      return { type: 'image', imageUrl: data.imageUrl };
    }

    if (toolKind === 'op-ad-stitch') {
      const res = await fetch('/api/ad-stitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: inputText || 'Create a cohesive video ad',
          images: inputImage ? [inputImage] : [],
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Ad stitch failed'));
      const data = await res.json();
      if (data.videoBase64) return { type: 'video', videoBase64: data.videoBase64, mimeType: data.mimeType };
      if (data.videoUrl) return { type: 'video', videoUrl: data.videoUrl };
      throw new Error(data.message || 'Ad stitch failed');
    }

    return { type: 'text', text: inputText };
  };

  const addOutputNode = (text: string, anchor?: FabricObject, options?: { imageUrl?: string; videoUrl?: string; videoBase64?: string; mimeType?: string }): string | undefined => {
    if (!fabricCanvas) return;
    const anchorPt = anchor ? getConnectionPoint(anchor, 'right') : getCanvasCenter();
    const NODE_W = 260;
    const hasMedia = !!(options?.imageUrl || options?.videoUrl || options?.videoBase64);
    const NODE_H = hasMedia ? 200 : 80;
    const rect = new FabricRect({
      width: NODE_W, height: NODE_H, rx: 10, ry: 10,
      fill: "#ECFDF3", stroke: "#10B981", strokeWidth: 1,
    });
    const title = new FabricTextbox("Output", {
      left: 20, top: 8, width: NODE_W - 32,
      fontSize: 13, fontWeight: 600, fill: "#065F46",
      editable: false, selectable: false,
    });
    const bodyOrPlaceholder = hasMedia
      ? new FabricTextbox(options?.imageUrl ? "[Loading...]" : "Video generated", {
          left: 20, top: 80, width: NODE_W - 40,
          fontSize: 11, fill: "#047857",
          editable: false, selectable: false,
        })
      : new FabricTextbox(text, {
          left: 20, top: 30, width: NODE_W - 32,
          fontSize: 11, fill: "#047857",
          editable: true, selectable: true,
        });
    const inputConn = new FabricCircle({
      radius: 6, left: -6, top: NODE_H / 2 - 6,
      fill: "#FFFFFF", stroke: "#10B981", strokeWidth: 2,
      selectable: true, evented: true, hoverCursor: "crosshair",
    });
    const group = new FabricGroup([rect, title, bodyOrPlaceholder, inputConn], {
      left: anchorPt.x + 40,
      top: anchorPt.y - NODE_H / 2,
      subTargetCheck: true,
    });
    const outputId = registerNodeObject(group as unknown as FabricObject, 'output');
    (inputConn as any).__connectorSide = 'left';
    (inputConn as any).__nodeId = outputId;
    if (options?.imageUrl) (group as any).__imageData = options.imageUrl;
    if (options?.videoBase64) (group as any).__videoBase64 = options.videoBase64;
    if (options?.videoUrl) (group as any).__videoUrl = options.videoUrl;
    fabricCanvas.add(group);
    fabricCanvas.requestRenderAll();

    if (hasMedia && options?.imageUrl) {
      FabricImage.fromURL(options.imageUrl, { crossOrigin: 'anonymous' }).then((img) => {
        const maxW = NODE_W - 40;
        const maxH = NODE_H - 50;
        const scale = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
        img.set({
          left: 20, top: 32, scaleX: scale, scaleY: scale,
          selectable: false, evented: false,
        });
        const grp = nodesRef.current[outputId!]?.object as FabricGroup | undefined;
        if (grp && (grp as any)._objects) {
          const objs = (grp as any)._objects as FabricObject[];
          const idx = objs.indexOf(bodyOrPlaceholder);
          if (idx >= 0) objs[idx] = img;
          (grp as any).setCoords();
          fabricCanvas.requestRenderAll();
        }
      }).catch(() => {
        const grp = nodesRef.current[outputId!]?.object as FabricGroup | undefined;
        if (grp && (grp as any)._objects) {
          const objs = (grp as any)._objects as FabricObject[];
          const ph = objs.find((o: any) => o.type === 'textbox' && (o as FabricTextbox).text === '[Loading...]');
          if (ph) (ph as FabricTextbox).set('text', 'Failed to load');
          fabricCanvas.requestRenderAll();
        }
      });
    }

    return outputId;
  };

  const runSelectedTools = async () => {
    if (!fabricCanvas) return;
    const selected = fabricCanvas.getActiveObjects().filter(
      (obj) => (obj as any).__nodeKind && (
        String((obj as any).__nodeKind).startsWith('tool-') ||
        String((obj as any).__nodeKind).startsWith('op-')
      )
    );
    if (selected.length === 0) {
      toast.error("Select a tool or operation node to run.");
      return;
    }
    for (const toolObj of selected) {
      const toolId = (toolObj as any).__nodeId as string | undefined;
      const toolKind = (toolObj as any).__nodeKind as CanvasNodeKind | undefined;
      if (!toolId || !toolKind) continue;
      const incoming = Object.values(connectionsRef.current).find((conn) => conn.toId === toolId);
      if (!incoming) {
        toast.error("Connect an input node to the tool.");
        continue;
      }
      const inputNode = nodesRef.current[incoming.fromId];
      if (!inputNode) {
        toast.error("Input node not found.");
        continue;
      }
      const { text: inputText, imageData: inputImage } = getInputFromNode(inputNode);
      const needsText = toolKind.startsWith('tool-') || toolKind === 'op-asset-gen' || toolKind === 'op-smart-edit' || toolKind === 'op-ad-stitch';
      const needsImage = toolKind === 'op-video-gen' || toolKind === 'op-bg-removal' || toolKind === 'op-smart-edit' || toolKind === 'op-ad-stitch';
      if (needsText && !inputText && !inputImage) {
        toast.error("Input node is empty. Add text or image.");
        continue;
      }
      if (needsImage && !inputImage) {
        toast.error("Image required for this operation. Connect an image input node.");
        continue;
      }
      const removeLoading = showNodeLoading(toolObj);
      try {
        const result = await executeNodeOperation(toolKind, inputText, inputImage);
        removeLoading();
        if (result.type === 'text') {
          const outputId = addOutputNode(result.text, toolObj);
          if (outputId) createConnection(toolId, outputId, 'right', 'left', "#10B981");
        } else if (result.type === 'image') {
          const outputId = addOutputNode("", toolObj, { imageUrl: result.imageUrl });
          if (outputId) createConnection(toolId, outputId, 'right', 'left', "#10B981");
        } else if (result.type === 'video') {
          const outputId = addOutputNode("[Video]", toolObj, {
            videoUrl: result.videoUrl,
            videoBase64: result.videoBase64,
            mimeType: result.mimeType,
          });
          if (outputId) createConnection(toolId, outputId, 'right', 'left', "#10B981");
        }
      } catch (err: any) {
        removeLoading();
        toast.error(err?.message || "Operation failed");
      }
    }
  };

  useEffect(() => {
    if (!fabricCanvas) return;

    const findConnector = (opt: any) => {
      const subs = opt?.subTargets || [];
      for (const s of subs) {
        if ((s as any).__connectorSide && (s as any).__nodeId) return s;
      }
      if (opt?.target && (opt.target as any).__connectorSide && (opt.target as any).__nodeId) return opt.target;
      return null;
    };

    const findNodeTarget = (opt: any) => {
      const connector = findConnector(opt);
      if (connector) return { nodeId: (connector as any).__nodeId as string, side: (connector as any).__connectorSide as 'left' | 'right' };
      // Also allow dropping on a node directly
      const target = opt?.target;
      if (target && (target as any).__nodeId) {
        return { nodeId: (target as any).__nodeId as string, side: 'left' as const };
      }
      return null;
    };

    let lockedGroup: FabricObject | null = null;
    let lockedGroupOriginal: { lockMovementX: boolean; lockMovementY: boolean; selectable: boolean } | null = null;

    const handleMouseDown = (opt: any) => {
      const target = opt?.target;
      if (target && (target as any).__isUploadZone) {
        const nodeId = (target as any).__nodeId;
        if (nodeId) {
          const nodeObj = nodesRef.current[nodeId]?.object;
          if (nodeObj) {
            pendingImageNodeRef.current = nodeObj;
            nodeImageFileInputRef.current?.click();
            return;
          }
        }
      }

      const connector = findConnector(opt);
      if (!connector) return;
      const nodeId = (connector as any).__nodeId as string;
      const side = (connector as any).__connectorSide as 'left' | 'right';
      const nodeObj = nodesRef.current[nodeId]?.object ?? connector;

      // Lock the parent group so it doesn't move during connector drag
      if (nodeObj && nodeObj !== connector) {
        lockedGroupOriginal = {
          lockMovementX: nodeObj.lockMovementX || false,
          lockMovementY: nodeObj.lockMovementY || false,
          selectable: nodeObj.selectable !== false,
        };
        nodeObj.set({ lockMovementX: true, lockMovementY: true });
        lockedGroup = nodeObj;
      }

      // Deselect everything to prevent drag
      fabricCanvas.discardActiveObject();

      const point = getConnectionPoint(nodeObj, side);
      const line = new FabricLine([point.x, point.y, point.x, point.y], {
        stroke: "#6B7280",
        strokeWidth: 2,
        strokeDashArray: [6, 3],
        selectable: false,
        evented: false,
      });
      activeConnectorRef.current = { fromId: nodeId, fromSide: side, line };
      fabricCanvas.add(line);
      (fabricCanvas as any).sendToBack(line);
      fabricCanvas.requestRenderAll();
    };

    const handleMouseMove = (opt: any) => {
      if (!activeConnectorRef.current) return;
      const pointer = fabricCanvas.getPointer(opt.e);
      activeConnectorRef.current.line.set({ x2: pointer.x, y2: pointer.y });
      fabricCanvas.requestRenderAll();
    };

    const unlockGroup = () => {
      if (lockedGroup && lockedGroupOriginal) {
        lockedGroup.set({
          lockMovementX: lockedGroupOriginal.lockMovementX,
          lockMovementY: lockedGroupOriginal.lockMovementY,
        });
        lockedGroup = null;
        lockedGroupOriginal = null;
      }
    };

    const handleMouseUp = (opt: any) => {
      if (!activeConnectorRef.current) {
        unlockGroup();
        return;
      }
      const active = activeConnectorRef.current;

      const target = findNodeTarget(opt);
      if (target && target.nodeId !== active.fromId) {
        if (active.fromSide === 'right') {
          createConnection(active.fromId, target.nodeId, 'right', 'left');
        } else if (active.fromSide === 'left' && target.side === 'right') {
          createConnection(target.nodeId, active.fromId, 'right', 'left');
        } else {
          createConnection(target.nodeId, active.fromId, 'right', 'left');
        }
      }

      fabricCanvas.remove(active.line);
      activeConnectorRef.current = null;
      unlockGroup();
      fabricCanvas.requestRenderAll();
    };

    fabricCanvas.on('mouse:down', handleMouseDown);
    fabricCanvas.on('mouse:move', handleMouseMove);
    fabricCanvas.on('mouse:up', handleMouseUp);

    return () => {
      fabricCanvas.off('mouse:down', handleMouseDown);
      fabricCanvas.off('mouse:move', handleMouseMove);
      fabricCanvas.off('mouse:up', handleMouseUp);
    };
  }, [fabricCanvas]);

  // (pen tool is now allowed in plan mode for the Connector tool)

  // Disable freehand drawing mode when switching away from brush tool
  useEffect(() => {
    if (!fabricCanvas) return;
    if (activeToolbarButton !== 'brush') {
      fabricCanvas.isDrawingMode = false;
    }
  }, [activeToolbarButton, fabricCanvas]);

  useEffect(() => {
    if (!onCanvasNodesRef) return;
    onCanvasNodesRef.current = {
      addInputNode,
      addImageInputNode,
      addTextImageInputNode,
      addToolNode,
      connectSelectedNodes,
      runSelectedTools,
    };
  });

  const updatePenNodeOverlay = (canvas: FabricCanvas, previewPoint?: { x: number; y: number }) => {
    clearPenNodeOverlay(canvas);
    if (currentPathPointsRef.current.length === 0) {
      return;
    }

    const points = currentPathPointsRef.current;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    let isClosingStart = false;

    if (previewPoint && points.length > 2 && firstPoint) {
      const dx = previewPoint.x - firstPoint.x;
      const dy = previewPoint.y - firstPoint.y;
      isClosingStart = Math.hypot(dx, dy) <= PEN_CLOSE_THRESHOLD;
    }

    // Draw lines between consecutive points
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const line = new FabricLine([prev.x, prev.y, curr.x, curr.y], {
        stroke: '#94A3B8',
        strokeWidth: 1.5,
        selectable: false,
        evented: false,
        strokeDashArray: [4, 4],
        excludeFromExport: true,
      });
      canvas.add(line);
      penNodeLinesRef.current.push(line);
    }

    // If path is closed, draw line from last point to first point
    if (isPathClosedRef.current && points.length > 2) {
      const last = points[points.length - 1];
      const first = points[0];
      const closingLine = new FabricLine([last.x, last.y, first.x, first.y], {
        stroke: '#94A3B8',
        strokeWidth: 1.5,
        selectable: false,
        evented: false,
        strokeDashArray: [4, 4],
        excludeFromExport: true,
      });
      canvas.add(closingLine);
      penNodeLinesRef.current.push(closingLine);
    }

    points.forEach((point, index) => {
      const isStart = index === 0;
      const baseRadius = 5; // All nodes same size
      const highlightStart = isStart && isClosingStart;
      // Make nodes evented when in pointer mode so they can be clicked
      const isPointerMode = penSubToolRef.current === 'pointer';
      const circle = new FabricCircle({
        left: point.x,
        top: point.y,
        radius: highlightStart ? baseRadius + 1 : baseRadius,
        fill: '#111827', // Same color for all points
        stroke: '#ffffff', // Same stroke for all points
        strokeWidth: 2,
        selectable: false,
        evented: isPointerMode, // Allow clicking in pointer mode
        originX: 'center',
        originY: 'center',
        excludeFromExport: true,
        hoverCursor: isPointerMode ? 'move' : 'default',
      });
      // Store index for reference
      (circle as any).__pointIndex = index;
      canvas.add(circle);
      penNodeHandlesRef.current.push(circle);
    });

    if (previewPoint && lastPoint) {
      const previewLine = new FabricLine(
        [lastPoint.x, lastPoint.y, previewPoint.x, previewPoint.y],
        {
          stroke: '#0EA5E9',
          strokeWidth: 1.5,
          selectable: false,
          evented: false,
          strokeDashArray: [2, 2],
          excludeFromExport: true,
        }
      );
      canvas.add(previewLine);
      penPreviewLineRef.current = previewLine;
    }
  };

  // Helper function to update path preview
  const updatePathPreview = (canvas: FabricCanvas, previewPoint?: { x: number; y: number }) => {
    if (currentPathRef.current) {
      canvas.remove(currentPathRef.current);
      currentPathRef.current = null;
    }

    if (currentPathPointsRef.current.length === 0) {
      clearPenNodeOverlay(canvas);
      canvas.renderAll();
      return;
    }

    const pathString = pointsToSVGPath(currentPathPointsRef.current, previewPoint, isPathClosedRef.current);
    if (!pathString) return;

    try {
      const path = new FabricPath(pathString, {
        stroke: '#111827',
        strokeWidth: 2,
        fill: '',
        selectable: false,
        evented: false,
      });
      canvas.add(path);
      currentPathRef.current = path;
      updatePenNodeOverlay(canvas, previewPoint);
      canvas.renderAll();
    } catch (error) {
      console.error('Error creating path preview:', error);
    }
  };

  // Helper function to complete path creation
  const completePath = (canvas: FabricCanvas, options?: { switchToPointer?: boolean }) => {
    const { switchToPointer = true } = options || {};
    const hasPathInProgress = !!currentPathRef.current || isDrawingPathRef.current;
    if (!hasPathInProgress) return;
    if (currentPathPointsRef.current.length < 2) {
      cancelPath(canvas);
      return;
    }

    // Remove preview
    if (currentPathRef.current) {
      canvas.remove(currentPathRef.current);
      currentPathRef.current = null;
    }
    clearPenNodeOverlay(canvas);

    // Create final path
    const pathString = pointsToSVGPath(currentPathPointsRef.current, undefined, isPathClosedRef.current);
    if (!pathString) {
      cancelPath(canvas);
      return;
    }

    try {
      const path = new FabricPath(pathString, {
        stroke: '#111827',
        strokeWidth: 2,
        fill: 'transparent',
        selectable: true,
        name: 'Path',
      });

      // Store original path data for editing
      (path as any).__pathPoints = currentPathPointsRef.current;

      canvas.add(path);
      canvas.setActiveObject(path);
      canvas.renderAll();

      // Reset state
      isDrawingPathRef.current = false;
      isPathDrawingStoppedRef.current = false;
      isPathClosedRef.current = false;
      currentPathPointsRef.current = [];

      if (switchToPointer) {
        // Reset to pointer tool
        setActiveToolbarButton('pointer');
        activeToolbarButtonRef.current = 'pointer';
        canvas.selection = true;
      }
    } catch (error) {
      console.error('Error creating path:', error);
      cancelPath(canvas);
    }
  };

  // Helper function to cancel path creation
  const cancelPath = (canvas: FabricCanvas) => {
    if (currentPathRef.current) {
      canvas.remove(currentPathRef.current);
      currentPathRef.current = null;
    }
    isDrawingPathRef.current = false;
    isPathClosedRef.current = false;
    currentPathPointsRef.current = [];
    clearPenNodeOverlay(canvas);
    canvas.renderAll();
  };

  // Initialize canvas (browser-only)
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: canvasRef.current.parentElement?.clientWidth || window.innerWidth,
      height: canvasRef.current.parentElement?.clientHeight || window.innerHeight,
      backgroundColor: 'transparent',
      preserveObjectStacking: true, // Prevent automatic z-index changes on selection
    });

    // Enable panning with middle mouse drag (or left-drag when Hand tool active)
    canvas.on('mouse:down', (opt: any) => {
      // If a connector drag is active, skip all other mousedown handling
      if (activeConnectorRef.current) return;

      const e = opt.e as MouseEvent;
      const isMiddleButton = e.button === 1 || (e.buttons & 4) === 4;
      const isLeftButton = e.button === 0 || (e.buttons & 1) === 1;
      const useHandTool = activeToolRef.current === 'hand';
      // Block panning/other draw starts during Smart Edit
      if ((canvas as any).__smartEditActive) {
        // Do not initiate panning or any draw tools while smart edit selection is active
        return;
      }

      // Sticky note text editing: if a sticky text sub-target is clicked, edit it directly
      const subTargets = opt?.subTargets || [];
      const stickyTextTarget = subTargets.find((t: any) => t?.__isStickyText);
      if (stickyTextTarget && activeToolRef.current === 'pointer') {
        try {
          canvas.setActiveObject(stickyTextTarget);
          stickyTextTarget.enterEditing?.();
          stickyTextTarget.selectAll?.();
          canvas.requestRenderAll();
        } catch (_e) { /* ignore */ }
        return;
      }

      // Handle text box drawing start
      if (activeToolbarButtonRef.current === 'text' && isLeftButton) {
        opt.e.preventDefault();
        isDrawingTextRef.current = true;
        const pointer = canvas.getPointer(e);
        startPointRef.current = { x: pointer.x, y: pointer.y };

        // Create a visual rectangle to show text box area
        const rect = new FabricRect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: 'rgba(24, 160, 251, 0.1)',
          stroke: '#18A0FB',
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
        });
        canvas.add(rect);
        drawingTextBoxRef.current = rect;
        // Add live size label (W × H)
        const sizeLabel = new FabricTextbox('0 × 0', {
          left: pointer.x + 8,
          top: pointer.y - 18,
          fontSize: 10,
          fill: '#ffffff',
          backgroundColor: '#18A0FB',
          padding: 2,
          selectable: false,
          evented: false,
          fontFamily: 'Inter, Arial, sans-serif',
          borderRadius: 3 as any, // TS guard; fabric supports background with rounded via custom, safe to ignore
        } as any);
        canvas.add(sizeLabel);
        drawingTextLabelRef.current = sizeLabel;
        canvas.selection = false;
        canvas.renderAll();
        return;
      }

      // Handle artboard drawing start
      if (activeToolbarButtonRef.current === 'artboard' && isLeftButton) {
        opt.e.preventDefault();
        isDrawingArtboardRef.current = true;
        const pointer = canvas.getPointer(e);
        startPointRef.current = { x: pointer.x, y: pointer.y };

        const artboard = new FabricRect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: '#ffffff',
          stroke: '#E5E5E5',
          strokeWidth: 1,
          rx: 0,
          ry: 0,
          selectable: false,
          name: 'Artboard',
        });
        // Mark as artboard for identification
        (artboard as any).isArtboard = true;
        drawingArtboardRef.current = artboard;
        canvas.add(artboard);
        canvas.selection = false;
        canvas.renderAll();
        return;
      }

      // Handle shape drawing start
      if (activeToolbarButtonRef.current === 'shape' && isLeftButton) {
        opt.e.preventDefault();
        isDrawingShapeRef.current = true;
        const pointer = canvas.getPointer(e);
        startPointRef.current = { x: pointer.x, y: pointer.y };

        if (activeShapeRef.current === 'rect') {
          const rect = new FabricRect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: '#111827',
            strokeWidth: 2,
            rx: 8,
            ry: 8,
            selectable: false
          });
          drawingShapeRef.current = rect;
          canvas.add(rect);
        } else if (activeShapeRef.current === 'circle') {
          const circle = new FabricCircle({
            left: pointer.x,
            top: pointer.y,
            radius: 0,
            fill: 'transparent',
            stroke: '#111827',
            strokeWidth: 2,
            selectable: false
          });
          drawingShapeRef.current = circle;
          canvas.add(circle);
        } else if (activeShapeRef.current === 'line') {
          const line = new FabricLine([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: '#111827',
            strokeWidth: 2,
            selectable: false
          });
          drawingShapeRef.current = line;
          canvas.add(line);
        } else if (activeShapeRef.current === 'diamond') {
          // Diamond is drawn as a rotated rect; we'll use a path and update on move
          const diamondPath = new FabricPath('M 0 0 L 0 0 L 0 0 L 0 0 Z', {
            fill: 'transparent',
            stroke: '#111827',
            strokeWidth: 2,
            selectable: false,
          });
          (diamondPath as any).__isDiamond = true;
          (diamondPath as any).__startX = pointer.x;
          (diamondPath as any).__startY = pointer.y;
          drawingShapeRef.current = diamondPath;
          canvas.add(diamondPath);
        }

        canvas.renderAll();
        return;
      }

      // Handle path drawing start (pen tool)
      if (activeToolbarButtonRef.current === 'pen' && isLeftButton) {
        opt.e.preventDefault();
        const pointer = canvas.getPointer(e);
        const currentSubTool = penSubToolRef.current;

        // Check if clicking on a node handle (for dragging in pointer mode or stopping after closing)
        let clickedNodeIndex = -1;
        if (opt.target && Array.isArray(penNodeHandlesRef.current) && penNodeHandlesRef.current.length > 0) {
          // First check if target has __pointIndex property (it's a node handle)
          const pointIndex = (opt.target as any)?.__pointIndex;
          if (typeof pointIndex === 'number' && pointIndex >= 0 && pointIndex < penNodeHandlesRef.current.length) {
            const handle = penNodeHandlesRef.current[pointIndex];
            if (handle && handle === opt.target) {
              clickedNodeIndex = pointIndex;
            }
          }

          // If not found by __pointIndex, check by distance
          if (clickedNodeIndex === -1) {
            for (let i = 0; i < penNodeHandlesRef.current.length; i++) {
              const handle = penNodeHandlesRef.current[i];
              if (!handle) continue;
              const handleX = handle.left || 0;
              const handleY = handle.top || 0;
              const distance = Math.hypot(pointer.x - handleX, pointer.y - handleY);
              if (distance <= 10) { // 10px threshold
                clickedNodeIndex = i;
                break;
              }
            }
          }
        }

        // If path is closed and a node is clicked, stop drawing
        if (isPathDrawingStoppedRef.current && clickedNodeIndex >= 0) {
          isDrawingPathRef.current = false;
          isPathDrawingStoppedRef.current = false;
          if (currentSubTool !== 'pointer') {
            return;
          }
        }

        // Handle different sub-tool modes
        if (currentSubTool === 'pointer') {
          // Pointer mode: allow dragging nodes or adding points to midpoints
          if (clickedNodeIndex >= 0) {
            // Start dragging a node
            selectedPointIndexRef.current = clickedNodeIndex;
            isDraggingControlHandleRef.current = true;
            draggingHandleIndexRef.current = clickedNodeIndex;
            draggingHandleTypeRef.current = 'point';
            canvas.selection = false;
            return;
          }

          // Check if clicking near midpoint of a segment
          if (currentPathPointsRef.current.length >= 2) {
            let closestSegmentIndex = -1;
            let closestT = 0;
            let minDist = Infinity;

            for (let i = 0; i < currentPathPointsRef.current.length - 1; i++) {
              const p1 = currentPathPointsRef.current[i];
              const p2 = currentPathPointsRef.current[i + 1];
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const lengthSq = dx * dx + dy * dy;

              if (lengthSq === 0) continue;

              const t = Math.max(0, Math.min(1, ((pointer.x - p1.x) * dx + (pointer.y - p1.y) * dy) / lengthSq));
              const projX = p1.x + t * dx;
              const projY = p1.y + t * dy;
              const dist = Math.sqrt((pointer.x - projX) ** 2 + (pointer.y - projY) ** 2);

              // Check if near midpoint (t between 0.3 and 0.7) and within threshold
              if (dist < minDist && dist < 10 && t > 0.3 && t < 0.7) {
                minDist = dist;
                closestSegmentIndex = i;
                closestT = t;
              }
            }

            if (closestSegmentIndex >= 0) {
              // Insert point at midpoint
              const p1 = currentPathPointsRef.current[closestSegmentIndex];
              const p2 = currentPathPointsRef.current[closestSegmentIndex + 1];
              const newPoint: PathPoint = {
                x: p1.x + (p2.x - p1.x) * closestT,
                y: p1.y + (p2.y - p1.y) * closestT,
              };
              currentPathPointsRef.current.splice(closestSegmentIndex + 1, 0, newPoint);
              updatePathPreview(canvas);
              canvas.renderAll();
              return;
            }
          }

          // If not clicking on node or midpoint, do nothing in pointer mode
          return;
        } else if (currentSubTool === 'curve') {
          // Curve mode: convert straight segments to curves
          if (currentPathPointsRef.current.length >= 2) {
            let closestSegmentIndex = -1;
            let minDist = Infinity;

            for (let i = 0; i < currentPathPointsRef.current.length - 1; i++) {
              const p1 = currentPathPointsRef.current[i];
              const p2 = currentPathPointsRef.current[i + 1];

              // Check if segment is straight (no control points)
              if (p1.cp2x !== undefined || p2.cp1x !== undefined) continue;

              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const lengthSq = dx * dx + dy * dy;

              if (lengthSq === 0) continue;

              const t = Math.max(0, Math.min(1, ((pointer.x - p1.x) * dx + (pointer.y - p1.y) * dy) / lengthSq));
              const projX = p1.x + t * dx;
              const projY = p1.y + t * dy;
              const dist = Math.sqrt((pointer.x - projX) ** 2 + (pointer.y - projY) ** 2);

              if (dist < minDist && dist < 15) {
                minDist = dist;
                closestSegmentIndex = i;
              }
            }

            if (closestSegmentIndex >= 0) {
              // Start dragging to create curve
              const p1 = currentPathPointsRef.current[closestSegmentIndex];
              const p2 = currentPathPointsRef.current[closestSegmentIndex + 1];
              const CURVE_HANDLE_TENSION = 0.33;
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;

              p1.cp2x = p1.x + dx * CURVE_HANDLE_TENSION;
              p1.cp2y = p1.y + dy * CURVE_HANDLE_TENSION;
              p2.cp1x = p2.x - dx * CURVE_HANDLE_TENSION;
              p2.cp1y = p2.y - dy * CURVE_HANDLE_TENSION;

              isDraggingControlHandleRef.current = true;
              draggingHandleIndexRef.current = closestSegmentIndex;
              draggingHandleTypeRef.current = 'cp2';
              canvas.selection = false;
              updatePathPreview(canvas);
              canvas.renderAll();
              return;
            }
          }
          return;
        }

        // Draw mode: add points
        if (!isDrawingPathRef.current) {
          // Start new path
          isDrawingPathRef.current = true;
          isPathDrawingStoppedRef.current = false;
          isPathClosedRef.current = false;
          currentPathPointsRef.current = [{ x: pointer.x, y: pointer.y }];
          canvas.selection = false;
          updatePathPreview(canvas);
          canvas.renderAll();
        } else if (!isPathDrawingStoppedRef.current) {
          // Check if closing path
          if (currentPathPointsRef.current.length > 0) {
            const first = currentPathPointsRef.current[0];
            const dx = pointer.x - first.x;
            const dy = pointer.y - first.y;
            const distanceToStart = Math.hypot(dx, dy);

            if (distanceToStart <= PEN_CLOSE_THRESHOLD && currentPathPointsRef.current.length > 2) {
              // Close path by marking it as closed (don't add duplicate point)
              isPathClosedRef.current = true;
              updatePathPreview(canvas);
              isPathDrawingStoppedRef.current = true; // Stop drawing, wait for node click
              canvas.renderAll();
              return;
            }
          }

          // Add new point to existing path (straight line)
          const newPoint: PathPoint = { x: pointer.x, y: pointer.y };
          currentPathPointsRef.current.push(newPoint);
          updatePathPreview(canvas);
          canvas.renderAll();
        }
        return;
      }

      if (isMiddleButton || (useHandTool && isLeftButton)) {
        isPanningRef.current = true;
        canvas.setCursor('grabbing');
        canvas.selection = false;
      }
    });
    canvas.on('mouse:move', (opt: any) => {
      if ((canvas as any).__smartEditActive) {
        // Let EditSpace handle selection overlay; do not pan or draw here
        return;
      }
      if (isPanningRef.current) {
        const e = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
        vpt[4] += e.movementX;
        vpt[5] += e.movementY;
        canvas.setViewportTransform(vpt);
        // Update grid offset to follow panning
        setGridOffset({ x: vpt[4], y: vpt[5] });
      }

      // Handle text box drawing
      if (isDrawingTextRef.current && startPointRef.current && drawingTextBoxRef.current) {
        opt.e.preventDefault();
        const pointer = canvas.getPointer(opt.e);
        const startX = startPointRef.current.x;
        const startY = startPointRef.current.y;
        const currentX = pointer.x;
        const currentY = pointer.y;

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);

        drawingTextBoxRef.current.set({
          left,
          top,
          width,
          height
        });
        // Update size label
        if (drawingTextLabelRef.current) {
          drawingTextLabelRef.current.set({
            left: left + width + 6,
            top: top + height + 6,
            text: `${Math.round(width)} × ${Math.round(height)}`
          });
        }

        canvas.renderAll();
      }

      // Handle artboard drawing
      if (isDrawingArtboardRef.current && startPointRef.current && drawingArtboardRef.current) {
        opt.e.preventDefault();
        const pointer = canvas.getPointer(opt.e);
        const startX = startPointRef.current.x;
        const startY = startPointRef.current.y;
        const currentX = pointer.x;
        const currentY = pointer.y;

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);

        drawingArtboardRef.current.set({
          left,
          top,
          width,
          height
        });

        canvas.renderAll();
      }

      // Handle shape drawing
      if (isDrawingShapeRef.current && startPointRef.current && drawingShapeRef.current) {
        opt.e.preventDefault();
        const pointer = canvas.getPointer(opt.e);
        const startX = startPointRef.current.x;
        const startY = startPointRef.current.y;
        const currentX = pointer.x;
        const currentY = pointer.y;

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);

        if (drawingShapeRef.current instanceof FabricRect) {
          drawingShapeRef.current.set({
            left,
            top,
            width,
            height
          });
        } else if (drawingShapeRef.current instanceof FabricCircle) {
          // For circles, use the minimum of width and height for radius
          const radius = Math.min(width, height) / 2;
          const centerX = startX + (currentX - startX) / 2;
          const centerY = startY + (currentY - startY) / 2;
          drawingShapeRef.current.set({
            left: centerX - radius,
            top: centerY - radius,
            radius
          });
        } else if (drawingShapeRef.current instanceof FabricLine) {
          drawingShapeRef.current.set({
            x1: startX,
            y1: startY,
            x2: currentX,
            y2: currentY
          });
        } else if ((drawingShapeRef.current as any)?.__isDiamond) {
          // Diamond: 4-point rhombus path
          const cx = left + width / 2;
          const cy = top + height / 2;
          const hw = width / 2;
          const hh = height / 2;
          const d = `M ${cx} ${cy - hh} L ${cx + hw} ${cy} L ${cx} ${cy + hh} L ${cx - hw} ${cy} Z`;
          const diamondObj = drawingShapeRef.current as any;
          diamondObj.set({ path: new FabricPath(d).path, left: cx - hw, top: cy - hh });
          diamondObj.setCoords?.();
        }

        canvas.renderAll();
      }

      // Handle path node dragging (pointer mode)
      if (isDraggingControlHandleRef.current && draggingHandleIndexRef.current !== null &&
        activeToolbarButtonRef.current === 'pen' && penSubToolRef.current === 'pointer') {
        opt.e.preventDefault();
        const pointer = canvas.getPointer(opt.e);
        const pointIndex = draggingHandleIndexRef.current;

        if (pointIndex >= 0 && pointIndex < currentPathPointsRef.current.length) {
          const point = currentPathPointsRef.current[pointIndex];
          if (draggingHandleTypeRef.current === 'point') {
            point.x = pointer.x;
            point.y = pointer.y;
            updatePathPreview(canvas);
            canvas.renderAll();
          }
        }
        return;
      }

      // Handle curve handle dragging (curve mode)
      if (isDraggingControlHandleRef.current && draggingHandleIndexRef.current !== null &&
        activeToolbarButtonRef.current === 'pen' && penSubToolRef.current === 'curve') {
        opt.e.preventDefault();
        const pointer = canvas.getPointer(opt.e);
        const segmentIndex = draggingHandleIndexRef.current;

        if (segmentIndex >= 0 && segmentIndex < currentPathPointsRef.current.length - 1) {
          const p1 = currentPathPointsRef.current[segmentIndex];
          const p2 = currentPathPointsRef.current[segmentIndex + 1];

          if (draggingHandleTypeRef.current === 'cp2') {
            // Update control points based on drag distance
            const dx = pointer.x - p1.x;
            const dy = pointer.y - p1.y;
            p1.cp2x = pointer.x;
            p1.cp2y = pointer.y;
            // Mirror the other control point for smooth curves
            p2.cp1x = p2.x - dx;
            p2.cp1y = p2.y - dy;
            updatePathPreview(canvas);
            canvas.renderAll();
          }
        }
        return;
      }

      // Handle path drawing preview
      if (isDrawingPathRef.current && currentPathPointsRef.current.length > 0 &&
        !isPathDrawingStoppedRef.current && penSubToolRef.current === 'draw') {
        opt.e.preventDefault();
        const pointer = canvas.getPointer(opt.e);
        updatePathPreview(canvas, { x: pointer.x, y: pointer.y });
      }
    });
    canvas.on('mouse:up', () => {
      if ((canvas as any).__smartEditActive) {
        return;
      }

      // Stop dragging nodes or curve handles
      if (isDraggingControlHandleRef.current) {
        isDraggingControlHandleRef.current = false;
        draggingHandleIndexRef.current = null;
        draggingHandleTypeRef.current = null;
      }
      isPanningRef.current = false;
      canvas.setCursor(activeToolRef.current === 'hand' ? 'grab' : 'default');
      canvas.selection = activeToolRef.current === 'pointer';

      // Handle text box drawing completion
      if (isDrawingTextRef.current) {
        isDrawingTextRef.current = false;
        startPointRef.current = null;

        // Always reset cursor and tool state
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.setCursor('default');
        setActiveToolbarButton('pointer');
        setActiveTool('pointer');
        activeToolbarButtonRef.current = 'pointer';
        activeToolRef.current = 'pointer';

        if (drawingTextBoxRef.current) {
          const width = drawingTextBoxRef.current.width || 0;
          const height = drawingTextBoxRef.current.height || 0;
          const left = drawingTextBoxRef.current.left || 0;
          const top = drawingTextBoxRef.current.top || 0;

          // Remove the visual guide rectangle
          canvas.remove(drawingTextBoxRef.current);
          drawingTextBoxRef.current = null;
          // Remove size label if present
          if (drawingTextLabelRef.current) {
            canvas.remove(drawingTextLabelRef.current);
            drawingTextLabelRef.current = null;
          }

          // Create area text if dragged enough; otherwise create point text with default width
          const PLACEHOLDER = "Type something…";
          const makeTextbox = (tw: number, tx: number, ty: number) => {
            const textbox = new FabricTextbox(PLACEHOLDER, {
              left: tx,
              top: ty,
              width: tw,
              fontSize: 32,
              fontFamily: 'Inter',
              fontWeight: '400',
              fill: '#9CA3AF',
              editable: true,
              padding: 6,
              name: 'Text',
            });
            // Professional selection/controls styling
            textbox.set({
              borderColor: '#18A0FB',
              cornerColor: '#18A0FB',
              cornerStyle: 'circle' as any,
              cornerSize: 6,
              transparentCorners: false,
              borderDashArray: [3, 3] as any,
              editingBorderColor: '#18A0FB' as any,
            } as any);
            // Placeholder behavior
            (textbox as any).isPlaceholder = true;
            textbox.on('changed', () => {
              if ((textbox as any).isPlaceholder && textbox.text !== PLACEHOLDER) {
                textbox.set({ fill: '#111827' });
                (textbox as any).isPlaceholder = false;
                canvas.requestRenderAll();
              }
            });
            textbox.on('editing:exited', () => {
              const content = (textbox.text || '').trim();
              if (!content) {
                textbox.set({ text: PLACEHOLDER, fill: '#9CA3AF' });
                (textbox as any).isPlaceholder = true;
                canvas.requestRenderAll();
              }
            });
            canvas.add(textbox);
            canvas.setActiveObject(textbox);
            textbox.enterEditing();
            textbox.selectAll();
            canvas.renderAll();
          };

          if (width > 30 && height > 20) {
            // Area text
            makeTextbox(width, left, top);
          } else {
            // Click to insert point text with default width
            const defaultWidth = 320;
            makeTextbox(defaultWidth, left, top);
          }
        }
      }

      // Handle artboard drawing completion
      if (isDrawingArtboardRef.current) {
        isDrawingArtboardRef.current = false;
        startPointRef.current = null;
        if (drawingArtboardRef.current) {
          // Check if artboard has minimum size before finalizing
          const hasMinimumSize = (drawingArtboardRef.current.width || 0) > 10 && (drawingArtboardRef.current.height || 0) > 10;

          if (hasMinimumSize) {
            drawingArtboardRef.current.set({
              selectable: true,
              evented: true,
            });
            canvas.setActiveObject(drawingArtboardRef.current);
            canvas.selection = true;
            canvas.renderAll();
          } else {
            // Remove artboard if too small
            canvas.remove(drawingArtboardRef.current);
            canvas.renderAll();
          }
        }
        drawingArtboardRef.current = null;
        // Reset to pointer tool after drawing
        setActiveToolbarButton('pointer');
        activeToolbarButtonRef.current = 'pointer';
      }

      // Handle shape drawing completion
      if (isDrawingShapeRef.current) {
        isDrawingShapeRef.current = false;
        startPointRef.current = null;
        if (drawingShapeRef.current) {
          // Check if shape has minimum size before finalizing
          let hasMinimumSize = false;

          if (drawingShapeRef.current instanceof FabricRect) {
            hasMinimumSize = (drawingShapeRef.current.width || 0) > 5 && (drawingShapeRef.current.height || 0) > 5;
          } else if (drawingShapeRef.current instanceof FabricCircle) {
            hasMinimumSize = (drawingShapeRef.current.radius || 0) > 5;
          } else if (drawingShapeRef.current instanceof FabricLine) {
            hasMinimumSize = true; // Lines are always valid
          } else if ((drawingShapeRef.current as any).__isDiamond) {
            hasMinimumSize = true; // Diamond paths are valid if drawn
          }

          if (hasMinimumSize) {
            drawingShapeRef.current.set({ selectable: true });
            canvas.setActiveObject(drawingShapeRef.current);
            canvas.renderAll();
          } else {
            // Remove shape if too small
            canvas.remove(drawingShapeRef.current);
            canvas.renderAll();
          }
          drawingShapeRef.current = null;

          // Reset to pointer tool after drawing
          setActiveToolbarButton('pointer');
          setActiveTool('pointer');
        }
      }

      // Handle path drawing - no completion on mouse:up, wait for double-click or Enter
    });

    // Handle double-click to exit editing mode
    canvas.on('mouse:dblclick', (opt: any) => {
      // Check if pen tool is active and we're in edit mode (drawing or have visible nodes)
      const isInEditMode = activeToolbarButtonRef.current === 'pen' &&
        (isDrawingPathRef.current || penNodeHandlesRef.current.length > 0);

      if (isInEditMode) {
        opt.e.preventDefault();
        // Exit editing mode: finalize path and hide nodes/toolbar
        if (currentPathPointsRef.current.length >= 2) {
          // Create final path
          const pathString = pointsToSVGPath(currentPathPointsRef.current, undefined, isPathClosedRef.current);
          if (pathString) {
            try {
              const path = new FabricPath(pathString, {
                stroke: '#111827',
                strokeWidth: 2,
                fill: 'transparent',
                selectable: true,
                name: 'Path',
              });

              // Store original path data for editing
              (path as any).__pathPoints = currentPathPointsRef.current;

              canvas.add(path);
              canvas.setActiveObject(path);

              // Clear editing state
              cancelPath(canvas);
              setActiveToolbarButton('pointer');
              activeToolbarButtonRef.current = 'pointer';
              setPenSubTool('draw');
              canvas.selection = true;
              canvas.renderAll();
            } catch (error) {
              console.error('Error creating path:', error);
              cancelPath(canvas);
            }
          }
        } else {
          cancelPath(canvas);
          setActiveToolbarButton('pointer');
          activeToolbarButtonRef.current = 'pointer';
          setPenSubTool('draw');
        }
      }
    });

    // Selection tracking for InspectorSidebar (supports images and text)
    const syncSelection = () => {
      // Do not change selection state while Smart Edit selection is active
      if ((canvas as any).__smartEditActive) return;
      const active = canvas.getActiveObject();

      if (!active && selectedObject) {
        // User deselected - trigger closing animation
        setIsSidebarClosing(true);
        setTimeout(() => {
          setSelectedObject(null);
          if (onSelectedObjectChange) {
            onSelectedObjectChange(null);
          }
          setSelectedImage(null);
          setIsSidebarClosing(false);
        }, 300); // Match animation duration
      } else {
        const newSelected = active || null;
        setSelectedObject(newSelected);
        if (onSelectedObjectChange) {
          onSelectedObjectChange(newSelected);
        }
        if (active && active instanceof FabricImage) {
          setSelectedImage(active);
        } else if (!active || !(active instanceof FabricImage)) {
          setSelectedImage(null);
        }
      }
    };
    canvas.on('selection:created', syncSelection);
    canvas.on('selection:updated', syncSelection);
    canvas.on('selection:cleared', syncSelection);

    // Wheel interactions: two-finger swipe pans, pinch (Ctrl/⌘ + wheel) zooms
    canvas.on('mouse:wheel', (opt: any) => {
      const e = opt.e as WheelEvent;
      const isZoomGesture = e.ctrlKey || e.metaKey; // pinch-to-zoom promotes Ctrl on most browsers
      if (isZoomGesture) {
        let zoom = canvas.getZoom();
        // Increased sensitivity: smaller base yields larger change per delta
        const zoomFactor = Math.pow(0.989, e.deltaY);
        zoom *= zoomFactor;
        zoom = Math.min(4, Math.max(0.1, zoom));
        const point = new Point(e.offsetX, e.offsetY);
        canvas.zoomToPoint(point, zoom);
        // Update grid offset after zoom
        const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
        setGridOffset({ x: vpt[4], y: vpt[5] });
      } else {
        const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
        // natural scroll: swipe moves content; move viewport opposite of scroll
        vpt[4] -= e.deltaX;
        vpt[5] -= e.deltaY;
        canvas.setViewportTransform(vpt);
        // Update grid offset to follow panning
        setGridOffset({ x: vpt[4], y: vpt[5] });
      }
      e.preventDefault();
      e.stopPropagation();
    });

    // Handle selection events
    canvas.on('selection:created', (e) => {
      if ((canvas as any).__smartEditActive) return;
      const obj = e.selected?.[0];
      if (obj && obj instanceof (FabricImage as any)) {
        setSelectedImage(obj as FabricImage);
      }
    });

    canvas.on('selection:updated', (e) => {
      if ((canvas as any).__smartEditActive) return;
      const obj = e.selected?.[0];
      if (obj && obj instanceof (FabricImage as any)) {
        setSelectedImage(obj as FabricImage);
      }
    });

    canvas.on('selection:cleared', () => {
      if ((canvas as any).__smartEditActive) return;
      setSelectedImage(null);
    });

    // Ensure canvas background stays transparent so grid is always visible
    const ensureTransparentBackground = () => {
      if (canvas.backgroundColor !== 'transparent') {
        canvas.backgroundColor = 'transparent';
        canvas.renderAll();
      }
    };

    // Listen for object additions and modifications to ensure grid stays visible
    canvas.on('object:added', ensureTransparentBackground);
    canvas.on('object:modified', ensureTransparentBackground);
    canvas.on('path:created', ensureTransparentBackground);

    setFabricCanvas(canvas);
    if (onCanvasInstanceChange) {
      onCanvasInstanceChange(canvas);
    }

    const handleResize = () => {
      const parent = canvasRef.current?.parentElement;
      const width = parent?.clientWidth || window.innerWidth;
      const height = parent?.clientHeight || window.innerHeight;
      canvas.setWidth(width);
      canvas.setHeight(height);
      canvas.renderAll();
    };

    const ro = new ResizeObserver(() => handleResize());
    if (canvasRef.current?.parentElement) ro.observe(canvasRef.current.parentElement);

    window.addEventListener('resize', handleResize);

    return () => {
      // Clean up event listeners
      canvas.off('object:added', ensureTransparentBackground);
      canvas.off('object:modified', ensureTransparentBackground);
      canvas.off('path:created', ensureTransparentBackground);
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
      canvas.dispose();
    };
    // intentionally empty deps: we only want to initialize once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ref mirrors for event handlers
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    activeToolbarButtonRef.current = activeToolbarButton;
  }, [activeToolbarButton]);

  useEffect(() => {
    activeShapeRef.current = activeShape;
  }, [activeShape]);

  useEffect(() => {
    penSubToolRef.current = penSubTool;
    // Update node handles when switching modes (to make them evented in pointer mode)
    if (fabricCanvas && isDrawingPathRef.current && currentPathPointsRef.current.length > 0) {
      updatePathPreview(fabricCanvas);
      // Update cursor when switching to pointer mode
      if (penSubTool === 'pointer') {
        fabricCanvas.defaultCursor = 'default';
        fabricCanvas.hoverCursor = 'move';
      }
    }
  }, [penSubTool, fabricCanvas]);

  useEffect(() => {
    if (!fabricCanvas) return;
    if (activeToolbarButton !== 'pen') {
      // Clear path editing state when pen tool is deselected
      const hasPathInProgress =
        currentPathPointsRef.current.length >= 2 &&
        (currentPathRef.current !== null || isDrawingPathRef.current);
      if (hasPathInProgress) {
        if (currentPathPointsRef.current.length >= 2) {
          completePath(fabricCanvas, { switchToPointer: false });
        }
        setPenSubTool('draw');
      } else if (isDrawingPathRef.current) {
        cancelPath(fabricCanvas);
      }
      if (
        penNodeHandlesRef.current.length > 0 ||
        penNodeLinesRef.current.length > 0 ||
        penPreviewLineRef.current
      ) {
        clearPenNodeOverlay(fabricCanvas);
        fabricCanvas.renderAll();
      }
    }
  }, [activeToolbarButton, fabricCanvas]);

  // Apply tool mode to canvas behavior and cursors
  useEffect(() => {
    if (!fabricCanvas) return;
    const isPointer = activeTool === 'pointer';
    const isShapeTool = activeToolbarButton === 'shape';
    const isPenTool = activeToolbarButton === 'pen';
    const isPenPointerMode = isPenTool && penSubTool === 'pointer';

    // Respect Smart Edit mode if set by EditSpace
    const smartEditActive = (fabricCanvas as any).__smartEditActive === true;
    // Set cursor based on active tool
    const isArtboardTool = activeToolbarButton === 'artboard';
    if (smartEditActive) {
      fabricCanvas.defaultCursor = 'crosshair';
      fabricCanvas.hoverCursor = 'crosshair';
      (fabricCanvas as any).moveCursor = 'crosshair';
      fabricCanvas.selection = false; // do not change active object, just prevent new selections
      fabricCanvas.skipTargetFind = true;
    } else if (isPenPointerMode) {
      // Pointer mode in pen tool - show pointer cursor
      fabricCanvas.defaultCursor = 'default';
      fabricCanvas.hoverCursor = 'move';
      fabricCanvas.selection = false;
      fabricCanvas.skipTargetFind = false;
    } else {
      if (isShapeTool || isArtboardTool || isPenTool) {
        fabricCanvas.defaultCursor = 'crosshair';
        fabricCanvas.hoverCursor = 'crosshair';
      } else {
        fabricCanvas.defaultCursor = isPointer ? 'default' : 'grab';
        fabricCanvas.hoverCursor = isPointer ? 'move' : 'grab';
      }
      fabricCanvas.selection = isPointer && !isShapeTool && !isArtboardTool && !isPenTool;
      fabricCanvas.skipTargetFind = !isPointer || isShapeTool || isArtboardTool || isPenTool;
    }

    if (!isPointer) {
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      setSelectedImage(null);
    }
  }, [activeTool, activeToolbarButton, penSubTool, fabricCanvas]);

  const handleAddActiveShape = () => {
    if (activeShape === 'rect') return handleAddRect();
    if (activeShape === 'circle') return handleAddCircle();
    return handleAddLine();
  };


  // Add generated image to canvas
  useEffect(() => {
    if (!fabricCanvas || !generatedImageUrl) return;

    FabricImage.fromURL(generatedImageUrl, {
      crossOrigin: 'anonymous'
    }).then((img) => {
      const maxWidth = fabricCanvas.width! * 0.6;
      const maxHeight = fabricCanvas.height! * 0.6;

      if (img.width! > maxWidth) {
        img.scaleToWidth(maxWidth);
      }
      if (img.getScaledHeight() > maxHeight) {
        img.scaleToHeight(maxHeight);
      }

      const { left, top } = computeImagePlacement(
        fabricCanvas.width!,
        fabricCanvas.height!,
        img.getScaledWidth(),
        img.getScaledHeight()
      );

      img.set({
        left,
        top,
        selectable: true,
        name: 'Image',
      });

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();

      setSelectedImage(img);

      toast.success("Image added to canvas");
    }).catch((error) => {
      console.error("Error loading image:", error);
      toast.error("Failed to load image");
    });
  }, [generatedImageUrl, fabricCanvas]);

  // ── Add generated video to canvas as a playable, movable object ──
  // Uses an offscreen canvas to draw video frames — Fabric reads <canvas> elements
  // perfectly on every render, unlike <video> which gets snapshot-cached.
  useEffect(() => {
    if (!fabricCanvas || !generatedVideoUrl) return;

    console.log('[Canvas] Adding video to canvas:', generatedVideoUrl.slice(0, 120));

    // Find source image for sizing/positioning
    const activeObj = fabricCanvas.getActiveObject();
    const sourceImg = activeObj instanceof FabricImage && !(activeObj as any).__isVideo ? activeObj : null;
    const allObjects = fabricCanvas.getObjects();
    const lastImage = sourceImg || [...allObjects].reverse().find(o => o instanceof FabricImage && !(o as any).__isVideo) as FabricImage | undefined;

    // Create hidden video element
    const videoEl = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';

    // Create offscreen canvas we'll paint frames onto
    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d')!;

    let animFrameId: number;
    let videoFabric: FabricImage | null = null;

    const onCanPlay = () => {
      const vw = videoEl.videoWidth || 640;
      const vh = videoEl.videoHeight || 360;
      offscreen.width = vw;
      offscreen.height = vh;

      // Draw the first frame so the Fabric object is immediately visible
      offCtx.drawImage(videoEl, 0, 0, vw, vh);

      // Create a FabricImage from the offscreen canvas (not the video element)
      videoFabric = new FabricImage(offscreen, {
        left: 0,
        top: 0,
        objectCaching: false,
        selectable: true,
        name: 'Video',
      });

      // ── Size: match source image, or 60% of canvas ──
      if (lastImage) {
        const targetWidth = lastImage.getScaledWidth();
        const targetHeight = lastImage.getScaledHeight();
        videoFabric.set({
          scaleX: targetWidth / Math.max(vw, 1),
          scaleY: targetHeight / Math.max(vh, 1),
        });
      } else {
        videoFabric.scaleToWidth(fabricCanvas.width! * 0.6);
      }

      const displayedW = videoFabric.getScaledWidth();
      const displayedH = videoFabric.getScaledHeight();

      // ── Position: next to source image, or centered ──
      let placeLeft: number;
      let placeTop: number;

      if (lastImage) {
        const imgLeft = lastImage.left ?? 0;
        const imgTop = lastImage.top ?? 0;
        const imgW = lastImage.getScaledWidth();
        const imgH = lastImage.getScaledHeight();
        placeLeft = imgLeft + imgW + 20;
        placeTop = imgTop;
        if (placeLeft + displayedW > fabricCanvas.width!) {
          placeLeft = imgLeft;
          placeTop = imgTop + imgH + 20;
        }
      } else {
        const center = fabricCanvas.getCenterPoint();
        placeLeft = center.x - displayedW / 2;
        placeTop = center.y - displayedH / 2;
      }

      // Clamp inside canvas
      const clampedLeft = Math.max(12, Math.min(placeLeft, fabricCanvas.width! - displayedW - 12));
      const clampedTop = Math.max(12, Math.min(placeTop, fabricCanvas.height! - displayedH - 12));
      videoFabric.set({ left: clampedLeft, top: clampedTop });

      // Store metadata
      (videoFabric as any).__videoElement = videoEl;
      (videoFabric as any).__offscreenCanvas = offscreen;
      (videoFabric as any).__isVideo = true;
      (videoFabric as any).__isPlaying = false;

      fabricCanvas.add(videoFabric);
      // Fabric v6: move to top of z-stack so video is not behind other objects
      const objects = fabricCanvas.getObjects();
      const idx = objects.indexOf(videoFabric);
      if (idx >= 0 && idx < objects.length - 1) {
        fabricCanvas.moveObjectTo(videoFabric, objects.length - 1);
      }
      fabricCanvas.setActiveObject(videoFabric);
      fabricCanvas.requestRenderAll();

      // Start playback
      videoEl.play().then(() => {
        (videoFabric as any).__isPlaying = true;
      }).catch(() => {
        // Autoplay blocked — user can double-click to play
      });

      // Ensure video loops (some sources don't respect loop attribute)
      videoEl.addEventListener('ended', () => {
        if (videoFabric && fabricCanvas.getObjects().includes(videoFabric)) {
          videoEl.currentTime = 0;
          videoEl.play().catch(() => {});
        }
      });

      // Render loop: paint video frame → offscreen canvas → mark dirty → fabric repaints
      const renderLoop = () => {
        if (!videoFabric || !fabricCanvas.getObjects().includes(videoFabric)) {
          videoEl.pause();
          cancelAnimationFrame(animFrameId);
          return;
        }
        if (!videoEl.paused) {
          offCtx.drawImage(videoEl, 0, 0, offscreen.width, offscreen.height);
          videoFabric.dirty = true;
          fabricCanvas.requestRenderAll();
        }
        animFrameId = requestAnimationFrame(renderLoop);
      };
      animFrameId = requestAnimationFrame(renderLoop);

      // Cleanup when removed
      const handleRemoved = ({ target }: any) => {
        if (target === videoFabric) {
          cancelAnimationFrame(animFrameId);
          videoEl.pause();
          videoEl.removeAttribute('src');
          videoEl.load();
          fabricCanvas.off('object:removed', handleRemoved);
        }
      };
      fabricCanvas.on('object:removed', handleRemoved);

      console.log('[Canvas] Video object added at', clampedLeft, clampedTop, 'size', displayedW, 'x', displayedH);
      toast.success('Video added to canvas — select it to show play/pause');
    };

    videoEl.addEventListener('canplay', () => {
      console.log('[Canvas] canplay — native size:', videoEl.videoWidth, 'x', videoEl.videoHeight);
      onCanPlay();
    }, { once: true });

    videoEl.addEventListener('error', (ev) => {
      console.error('[Canvas] Video load error:', ev, videoEl.error);
      toast.error('Failed to load video onto canvas');
    }, { once: true });

    videoEl.src = generatedVideoUrl;
    videoEl.load();
  }, [generatedVideoUrl, fabricCanvas]);

  // ── Double-click handler for video play/pause (fallback when buttons not used) ──
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleDblClick = () => {
      const active = fabricCanvas.getActiveObject();
      if (!active || !(active as any).__isVideo) return;
      const videoEl = (active as any).__videoElement as HTMLVideoElement;
      if (!videoEl) return;

      if (videoEl.paused) {
        videoEl.play().then(() => {
          (active as any).__isPlaying = true;
        }).catch(() => {});
      } else {
        videoEl.pause();
        (active as any).__isPlaying = false;
      }
    };

    fabricCanvas.on('mouse:dblclick', handleDblClick);
    return () => {
      fabricCanvas.off('mouse:dblclick', handleDblClick);
    };
  }, [fabricCanvas]);

  // ── Update video controls overlay position when a video is selected ──
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const projectPoint = (x: number, y: number) => {
      const vpt = fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0];
      return {
        x: vpt[0] * x + vpt[2] * y + vpt[4],
        y: vpt[1] * x + vpt[3] * y + vpt[5],
      };
    };

    const updateVideoControlsPosition = () => {
      const active = fabricCanvas.getActiveObject();
      if (!active || !(active as any).__isVideo) {
        setVideoControlsRect(null);
        return;
      }
      const bounds = active.getBoundingRect();
      const centerX = bounds.left + bounds.width / 2;
      const topY = bounds.top;
      const center = projectPoint(centerX, topY);
      const btnSize = Math.min(44, Math.max(28, bounds.width * 0.15));
      const ctrlHeight = btnSize + 12;
      const rect = {
        left: center.x - btnSize / 2,
        top: center.y - ctrlHeight - 8,
        width: btnSize,
        height: ctrlHeight,
      };
      if (videoControlsRef.current) {
        videoControlsRef.current.style.left = `${rect.left}px`;
        videoControlsRef.current.style.top = `${rect.top}px`;
        videoControlsRef.current.style.width = `${rect.width}px`;
        videoControlsRef.current.style.height = `${rect.height}px`;
      } else {
        setVideoControlsRect(rect);
      }
    };

    updateVideoControlsPosition();
    const active = fabricCanvas.getActiveObject();
    const videoEl = active && (active as any).__isVideo ? (active as any).__videoElement : null;
    fabricCanvas.on('after:render', updateVideoControlsPosition);
    fabricCanvas.on('object:moving', updateVideoControlsPosition);
    fabricCanvas.on('object:scaling', updateVideoControlsPosition);
    fabricCanvas.on('object:rotating', updateVideoControlsPosition);
    if (videoEl) {
      setVideoPlayingState(!(videoEl as HTMLVideoElement).paused);
      const onPlay = () => setVideoPlayingState(true);
      const onPause = () => setVideoPlayingState(false);
      videoEl.addEventListener('play', onPlay);
      videoEl.addEventListener('pause', onPause);
      return () => {
        videoEl.removeEventListener('play', onPlay);
        videoEl.removeEventListener('pause', onPause);
        fabricCanvas.off('after:render', updateVideoControlsPosition);
        fabricCanvas.off('object:moving', updateVideoControlsPosition);
        fabricCanvas.off('object:scaling', updateVideoControlsPosition);
        fabricCanvas.off('object:rotating', updateVideoControlsPosition);
      };
    }
    return () => {
      fabricCanvas.off('after:render', updateVideoControlsPosition);
      fabricCanvas.off('object:moving', updateVideoControlsPosition);
      fabricCanvas.off('object:scaling', updateVideoControlsPosition);
      fabricCanvas.off('object:rotating', updateVideoControlsPosition);
    };
  }, [fabricCanvas, selectedObject]);

  // Apply filters to selected image
  const handleFilterChange = (filterName: string, value: number) => {
    if (!selectedImage) return;

    const newFilters = { ...imageFilters, [filterName]: value };
    setImageFilters(newFilters);

    // Clear existing filters
    selectedImage.filters = [];

    // Apply brightness filter
    if (newFilters.brightness !== 0) {
      selectedImage.filters.push(new filters.Brightness({ brightness: newFilters.brightness }));
    }

    // Apply contrast filter
    if (newFilters.contrast !== 0) {
      selectedImage.filters.push(new filters.Contrast({ contrast: newFilters.contrast }));
    }

    // Apply saturation filter
    if (newFilters.saturation !== 0) {
      selectedImage.filters.push(new filters.Saturation({ saturation: newFilters.saturation }));
    }

    // Apply hue rotation filter
    if (newFilters.hue !== 0) {
      selectedImage.filters.push(new filters.HueRotation({ rotation: newFilters.hue }));
    }

    // Apply blur filter
    if (newFilters.blur !== 0) {
      selectedImage.filters.push(new filters.Blur({ blur: Math.max(0, newFilters.blur) }));
    }

    selectedImage.applyFilters();
    fabricCanvas?.renderAll();
  };

  // Reset filters
  const handleResetFilters = () => {
    if (!selectedImage) return;

    setImageFilters({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      blur: 0,
    });

    selectedImage.filters = [];
    selectedImage.applyFilters();
    fabricCanvas?.renderAll();
    toast.success("Filters reset");
  };


  // Crop helpers
  const startCrop = () => {
    if (!fabricCanvas || !selectedImage) return;
    if (isCropping) return;
    const img = selectedImage;
    const rect = new FabricRect({
      left: img.left! + 10,
      top: img.top! + 10,
      width: Math.max(40, (img.getScaledWidth() || 200) - 20),
      height: Math.max(40, (img.getScaledHeight() || 120) - 20),
      fill: 'rgba(0,0,0,0.05)',
      stroke: '#111827',
      strokeDashArray: [5, 5],
      strokeWidth: 1,
      selectable: true,
      hasBorders: true,
      hasControls: true,
      lockRotation: true,
    });
    cropRectRef.current = rect;
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
    setIsCropping(true);
    fabricCanvas.renderAll();
  };

  const applyCrop = () => {
    if (!fabricCanvas || !selectedImage || !cropRectRef.current) return;
    const img = selectedImage;
    const rect = cropRectRef.current;
    const imgLeft = img.left || 0;
    const imgTop = img.top || 0;
    const imgScaleX = img.scaleX || 1;
    const imgScaleY = img.scaleY || 1;
    const cropLeft = rect.left || 0;
    const cropTop = rect.top || 0;
    const cropWidth = rect.getScaledWidth();
    const cropHeight = rect.getScaledHeight();

    const cropX = Math.max(0, (cropLeft - imgLeft) / imgScaleX);
    const cropY = Math.max(0, (cropTop - imgTop) / imgScaleY);
    const newWidth = Math.max(1, cropWidth / imgScaleX);
    const newHeight = Math.max(1, cropHeight / imgScaleY);

    img.set({ cropX, cropY, width: newWidth, height: newHeight });
    fabricCanvas.remove(rect);
    cropRectRef.current = null;
    setIsCropping(false);
    fabricCanvas.renderAll();
  };

  const cancelCrop = () => {
    if (!fabricCanvas) return;
    if (cropRectRef.current) {
      fabricCanvas.remove(cropRectRef.current);
      cropRectRef.current = null;
    }
    setIsCropping(false);
    fabricCanvas.renderAll();
  };

  const centerCoords = (objWidth: number, objHeight: number) => {
    const canvasWidth = fabricCanvas?.width ?? window.innerWidth - 320;
    const canvasHeight = fabricCanvas?.height ?? window.innerHeight;
    return {
      left: (canvasWidth - objWidth) / 2,
      top: (canvasHeight - objHeight) / 2,
    };
  };

  const handleAddText = () => {
    if (!fabricCanvas) return;
    // Set text tool mode for drag-to-create
    setActiveToolbarButton('text');
    activeToolbarButtonRef.current = 'text';
    fabricCanvas.selection = false;
    fabricCanvas.defaultCursor = 'text';
    fabricCanvas.setCursor('text');
  };

  const STICKY_COLORS = [
    { bg: '#FFF9DB', fold: '#EDE9A6', text: '#78350F' },
    { bg: '#DCFCE7', fold: '#A7E8BD', text: '#14532D' },
    { bg: '#E0F2FE', fold: '#A5D8F8', text: '#0C4A6E' },
    { bg: '#F3E8FF', fold: '#D4B8F0', text: '#581C87' },
    { bg: '#FFE4E6', fold: '#F5B7BB', text: '#881337' },
    { bg: '#FEF3C7', fold: '#F5D98B', text: '#78350F' },
  ];
  const STICKY_FONT = 'Caveat';

  // Load handwriting font for sticky notes
  const loadStickyFont = () => {
    const fontUrl = `https://fonts.googleapis.com/css2?family=${STICKY_FONT}:wght@400;500;600;700&display=swap`;
    if (!document.querySelector(`link[href="${fontUrl}"]`)) {
      const link = document.createElement('link');
      link.href = fontUrl;
      link.rel = 'stylesheet';
      link.setAttribute('crossorigin', 'anonymous');
      document.head.appendChild(link);
    }
  };

  const handleAddStickyNote = () => {
    if (!fabricCanvas) return;
    loadStickyFont();

    const SIZE = 180;
    const FOLD = 20;
    const PAD = 14;
    const { left: cx, top: cy } = centerCoords(SIZE, SIZE);
    const palette = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];

    // Background note
    const bg = new FabricRect({
      width: SIZE,
      height: SIZE,
      rx: 6, ry: 6,
      fill: palette.bg,
      stroke: 'rgba(0,0,0,0.06)',
      strokeWidth: 1,
      shadow: '2px 3px 8px rgba(0,0,0,0.12)' as any,
      selectable: false,
      evented: false,
    });

    // Folded corner in the top-right (cleaner and more natural)
    const fold = new FabricPath(
      `M ${SIZE - FOLD} 0 L ${SIZE} ${FOLD} L ${SIZE} 0 Z`,
      {
        fill: palette.fold,
        stroke: 'rgba(0,0,0,0.08)',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
      }
    );
    const foldShadow = new FabricPath(
      `M ${SIZE - FOLD} 0 L ${SIZE} ${FOLD}`,
      {
        fill: 'transparent',
        stroke: 'rgba(0,0,0,0.10)',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      }
    );

    const text = new FabricTextbox('', {
      left: PAD,
      top: PAD + 2,
      width: SIZE - PAD * 2,
      fontSize: 18,
      fontFamily: `'${STICKY_FONT}', cursive`,
      fill: palette.text,
      editable: true,
      lineHeight: 1.35,
      selectable: true,
      lockMovementX: true,
      lockMovementY: true,
    });
    (text as any).__isStickyText = true;

    const group = new FabricGroup([bg, fold, foldShadow, text], {
      left: cx,
      top: cy,
      subTargetCheck: true,
      interactive: true,
      objectCaching: false,
    } as any);
    (group as any).name = 'Sticky Note';

    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();

    // Enter editing mode automatically
    setTimeout(() => {
      if (!fabricCanvas) return;
      try {
        fabricCanvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        fabricCanvas.requestRenderAll();
      } catch (_e) { /* ignore */ }
    }, 80);

    // Reset tool
    setActiveToolbarButton('pointer');
    activeToolbarButtonRef.current = 'pointer';
    setActiveTool('pointer');
  };

  const resetToolbarToPointer = () => {
    setActiveToolbarButton('pointer');
    activeToolbarButtonRef.current = 'pointer';
    setActiveTool('pointer');
    activeToolRef.current = 'pointer';
    if (fabricCanvas) {
      fabricCanvas.isDrawingMode = false;
      fabricCanvas.selection = true;
      fabricCanvas.defaultCursor = 'default';
      fabricCanvas.setCursor('default');
    }
  };

  const handleAddTimer = () => {
    if (!fabricCanvas) return;
    const SIZE = 170;
    const { left, top } = centerCoords(SIZE, SIZE);

    const base = new FabricCircle({
      left: 0,
      top: 6,
      radius: 70,
      fill: "#FFF7ED",
      stroke: "#F97316",
      strokeWidth: 2,
      shadow: '2px 3px 8px rgba(0,0,0,0.12)' as any,
    });
    const ring = new FabricCircle({
      left: 10,
      top: 16,
      radius: 60,
      fill: "#FFFBEB",
      stroke: "#FDBA74",
      strokeWidth: 2,
    });
    const knob = new FabricRect({
      left: 60,
      top: -2,
      width: 40,
      height: 14,
      rx: 7,
      ry: 7,
      fill: "#FDBA74",
      stroke: "#F97316",
      strokeWidth: 1,
    });
    const timeText = new FabricTextbox("5:00", {
      left: 35,
      top: 60,
      width: 100,
      fontSize: 24,
      fontWeight: 700,
      fill: "#9A3412",
      textAlign: "center",
      editable: true,
      selectable: true,
    });
    const label = new FabricTextbox("Timer", {
      left: 45,
      top: 100,
      width: 80,
      fontSize: 12,
      fontWeight: 600,
      fill: "#9A3412",
      textAlign: "center",
      editable: true,
      selectable: true,
    });

    const group = new FabricGroup([base, ring, knob, timeText, label], {
      left,
      top,
      subTargetCheck: true,
    } as any);
    (group as any).name = 'Timer';

    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();
    resetToolbarToPointer();
  };

  const handleAddVote = () => {
    if (!fabricCanvas) return;
    const WIDTH = 230;
    const HEIGHT = 130;
    const { left, top } = centerCoords(WIDTH, HEIGHT);

    const card = new FabricRect({
      width: WIDTH,
      height: HEIGHT,
      rx: 14,
      ry: 14,
      fill: "#FFF7ED",
      stroke: "#FDBA74",
      strokeWidth: 2,
      shadow: '2px 3px 8px rgba(0,0,0,0.12)' as any,
    });
    const title = new FabricTextbox("Dot Vote", {
      left: 18,
      top: 12,
      width: WIDTH - 36,
      fontSize: 14,
      fontWeight: 700,
      fill: "#9A3412",
      editable: true,
      selectable: true,
    });
    const subtitle = new FabricTextbox("Tap dots to vote", {
      left: 18,
      top: 34,
      width: WIDTH - 36,
      fontSize: 11,
      fill: "#9A3412",
      editable: true,
      selectable: true,
    });

    const dots = Array.from({ length: 5 }, (_, idx) => new FabricCircle({
      radius: 10,
      left: 28 + idx * 36,
      top: 70,
      fill: "#FDBA74",
      stroke: "#F97316",
      strokeWidth: 1,
    }));

    const group = new FabricGroup([card, title, subtitle, ...dots], {
      left,
      top,
      subTargetCheck: true,
    } as any);
    (group as any).name = 'Dot Vote';

    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();
    resetToolbarToPointer();
  };

  const handleAddKanban = () => {
    if (!fabricCanvas) return;
    const WIDTH = 540;
    const HEIGHT = 300;
    const { left, top } = centerCoords(WIDTH, HEIGHT);

    const board = new FabricRect({
      width: WIDTH,
      height: HEIGHT,
      rx: 16,
      ry: 16,
      fill: "#F8FAFC",
      stroke: "#CBD5F5",
      strokeWidth: 2,
      shadow: '2px 3px 10px rgba(0,0,0,0.10)' as any,
    });
    const colLine1 = new FabricLine([WIDTH / 3, 46, WIDTH / 3, HEIGHT - 12], {
      stroke: "#CBD5F5",
      strokeWidth: 2,
    });
    const colLine2 = new FabricLine([WIDTH * 2 / 3, 46, WIDTH * 2 / 3, HEIGHT - 12], {
      stroke: "#CBD5F5",
      strokeWidth: 2,
    });
    const header = new FabricRect({
      width: WIDTH,
      height: 46,
      rx: 16,
      ry: 16,
      fill: "#EEF2FF",
      stroke: "#CBD5F5",
      strokeWidth: 1,
    });
    const todo = new FabricTextbox("To Do", {
      left: 20,
      top: 12,
      width: WIDTH / 3 - 40,
      fontSize: 14,
      fontWeight: 700,
      fill: "#1E293B",
      editable: true,
      selectable: true,
    });
    const doing = new FabricTextbox("Doing", {
      left: WIDTH / 3 + 20,
      top: 12,
      width: WIDTH / 3 - 40,
      fontSize: 14,
      fontWeight: 700,
      fill: "#1E293B",
      editable: true,
      selectable: true,
    });
    const done = new FabricTextbox("Done", {
      left: WIDTH * 2 / 3 + 20,
      top: 12,
      width: WIDTH / 3 - 40,
      fontSize: 14,
      fontWeight: 700,
      fill: "#1E293B",
      editable: true,
      selectable: true,
    });

    const group = new FabricGroup([board, header, colLine1, colLine2, todo, doing, done], {
      left,
      top,
      subTargetCheck: true,
    } as any);
    (group as any).name = 'Kanban Board';

    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();
    resetToolbarToPointer();
  };

  const handleAddMindMap = () => {
    if (!fabricCanvas) return;
    const WIDTH = 360;
    const HEIGHT = 240;
    const { left, top } = centerCoords(WIDTH, HEIGHT);

    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    const centerNode = new FabricCircle({
      left: centerX - 42,
      top: centerY - 42,
      radius: 42,
      fill: "#FCE7F3",
      stroke: "#DB2777",
      strokeWidth: 2,
      shadow: '2px 3px 8px rgba(0,0,0,0.12)' as any,
    });
    const centerText = new FabricTextbox("Idea", {
      left: centerX - 40,
      top: centerY - 12,
      width: 80,
      fontSize: 14,
      fontWeight: 700,
      fill: "#9D174D",
      textAlign: "center",
      editable: true,
      selectable: true,
    });

    const nodes = [
      { x: 70, y: 40, label: "Branch A" },
      { x: WIDTH - 130, y: 45, label: "Branch B" },
      { x: WIDTH - 120, y: HEIGHT - 90, label: "Branch C" },
    ];
    const nodeCircles = nodes.map((node) => new FabricCircle({
      left: node.x,
      top: node.y,
      radius: 28,
      fill: "#FDF2F8",
      stroke: "#F472B6",
      strokeWidth: 2,
    }));
    const nodeTexts = nodes.map((node) => new FabricTextbox(node.label, {
      left: node.x - 10,
      top: node.y + 10,
      width: 80,
      fontSize: 11,
      fontWeight: 600,
      fill: "#9D174D",
      textAlign: "center",
      editable: true,
      selectable: true,
    }));
    const connectors = nodes.map((node) => new FabricLine(
      [centerX, centerY, node.x + 28, node.y + 28],
      { stroke: "#F472B6", strokeWidth: 2 }
    ));

    const group = new FabricGroup([centerNode, centerText, ...connectors, ...nodeCircles, ...nodeTexts], {
      left,
      top,
      subTargetCheck: true,
    } as any);
    (group as any).name = 'Mind Map';

    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.requestRenderAll();
    resetToolbarToPointer();
  };

  const handleActivateBrush = () => {
    if (!fabricCanvas) return;
    setActiveToolbarButton('brush');
    activeToolbarButtonRef.current = 'brush';
    fabricCanvas.isDrawingMode = true;
    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = 'rgba(255, 213, 79, 0.5)';
      fabricCanvas.freeDrawingBrush.width = 12;
      (fabricCanvas.freeDrawingBrush as any).strokeLineCap = 'round';
    }
    fabricCanvas.defaultCursor = 'crosshair';
    fabricCanvas.setCursor('crosshair');
  };

  const handleAddArtboard = () => {
    if (!fabricCanvas) return;
    // Set artboard tool mode for drag-to-create
    setActiveToolbarButton('artboard');
    activeToolbarButtonRef.current = 'artboard';
    fabricCanvas.selection = false;
    fabricCanvas.defaultCursor = 'crosshair';
    fabricCanvas.setCursor('crosshair');
  };

  const handleAddRect = () => {
    if (!fabricCanvas) return;
    const rect = new FabricRect({
      width: 200,
      height: 120,
      fill: 'transparent',
      stroke: '#111827',
      strokeWidth: 2,
      rx: 8,
      ry: 8,
      name: 'Rectangle',
    });
    const { left, top } = centerCoords(200, 120);
    rect.set({ left, top });
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
    fabricCanvas.renderAll();
  };

  const handleAddCircle = () => {
    if (!fabricCanvas) return;
    const radius = 80;
    const circle = new FabricCircle({
      radius,
      fill: 'transparent',
      stroke: '#111827',
      strokeWidth: 2,
      name: 'Circle',
    });
    const { left, top } = centerCoords(radius * 2, radius * 2);
    circle.set({ left, top });
    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
    fabricCanvas.renderAll();
  };

  const handleAddLine = () => {
    if (!fabricCanvas) return;
    const width = 180;
    const height = 0;
    const { left, top } = centerCoords(width, 2);
    const line = new FabricLine([left, top, left + width, top + height], {
      stroke: '#111827',
      strokeWidth: 2,
      selectable: true,
      name: 'Line',
    });
    fabricCanvas.add(line);
    fabricCanvas.setActiveObject(line);
    fabricCanvas.renderAll();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleNodeImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingImageNodeRef.current || !fabricCanvas) return;
    const nodeObj = pendingImageNodeRef.current;
    pendingImageNodeRef.current = null;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      (nodeObj as any).__imageData = dataUrl;
      const grp = nodeObj.type === 'group' ? (nodeObj as FabricGroup) : null;
      if (grp && (grp as any)._objects) {
        const objs = (grp as any)._objects as FabricObject[];
        const uploadZone = objs.find((o: any) => o.__isUploadZone);
        const uploadLabel = objs.find((o: any) => o.type === 'textbox' && (o as FabricTextbox).text?.toLowerCase().includes('upload'));
        if (uploadZone) (uploadZone as FabricRect).set({ fill: '#86EFAC' });
        if (uploadLabel) (uploadLabel as FabricTextbox).set('text', 'Image loaded');
      }
      fabricCanvas.requestRenderAll();
      toast.success("Image added to node");
    };
    reader.readAsDataURL(file);
    if (nodeImageFileInputRef.current) nodeImageFileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!fabricCanvas) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    FabricImage.fromURL(url).then((img) => {
      const maxWidth = fabricCanvas.width! * 0.6;
      const maxHeight = fabricCanvas.height! * 0.6;

      if (img.width! > maxWidth) {
        img.scaleToWidth(maxWidth);
      }
      if (img.getScaledHeight() > maxHeight) {
        img.scaleToHeight(maxHeight);
      }

      const { left, top } = computeImagePlacement(
        fabricCanvas.width!,
        fabricCanvas.height!,
        img.getScaledWidth(),
        img.getScaledHeight()
      );

      img.set({
        left,
        top,
        selectable: true,
        name: 'Image',
      });

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();

      setSelectedImage(img);
      setSelectedObject(img);
      // Reset toolbar button to pointer after upload
      setActiveToolbarButton('pointer');
      activeToolbarButtonRef.current = 'pointer';
      toast.success("Image uploaded onto canvas");
    }).catch(() => {
      toast.error("Failed to upload image");
      // Reset toolbar button even on error
      setActiveToolbarButton('pointer');
      activeToolbarButtonRef.current = 'pointer';
    }).finally(() => {
      URL.revokeObjectURL(url);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  const handleExport = (format: 'png' | 'jpg' | 'svg', exportType: 'canvas' | 'artboard' | 'selected') => {
    if (!fabricCanvas) return;

    let dataURL: string;
    let filename: string;
    const timestamp = Date.now();
    const multiplier = 4; // Ultra high quality export (4x resolution)

    // Handle selected image or artboard export
    if (exportType === 'selected') {
      if (!selectedObject) {
        toast.error("No object selected");
        return;
      }

      const isSelectedImage = selectedObject instanceof FabricImage;
      const isSelectedArtboard = selectedObject instanceof FabricRect && (selectedObject as any).isArtboard;

      if (!isSelectedImage && !isSelectedArtboard) {
        toast.error("Selected object is not an image or artboard");
        return;
      }

      // Export selected image
      if (isSelectedImage) {
        try {
          const image = selectedObject as FabricImage;
          const bounds = image.getBoundingRect();

          if (format === 'svg') {
            // Export image as SVG
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = bounds.width;
            tempCanvas.height = bounds.height;
            const tempFabricCanvas = new FabricCanvas(tempCanvas, {
              width: bounds.width,
              height: bounds.height,
              backgroundColor: '#ffffff',
            });

            // Clone the image and position it
            image.clone().then((cloned: any) => {
              cloned.set({
                left: 0,
                top: 0,
              });
              cloned.setCoords();
              tempFabricCanvas.add(cloned);
              tempFabricCanvas.renderAll();

              const svgString = tempFabricCanvas.toSVG();
              filename = `image-export-${timestamp}.svg`;
              const blob = new Blob([svgString], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = filename;
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);

              tempFabricCanvas.dispose();
              toast.success("Image exported!");
            }).catch((error) => {
              console.error("Error during SVG export:", error);
              toast.error("Failed to export image. Please try again.");
              tempFabricCanvas.dispose();
            });
          } else {
            // Store original background
            const originalBg = fabricCanvas.backgroundColor as string | undefined;

            // Temporarily set white background if needed
            if (!originalBg || originalBg === 'transparent') {
              fabricCanvas.backgroundColor = '#ffffff';
              fabricCanvas.renderAll();
            }

            // Export with high quality
            dataURL = fabricCanvas.toDataURL({
              format: format === 'jpg' ? 'jpeg' : 'png',
              quality: 1,
              multiplier: multiplier,
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
              height: bounds.height,
            });

            filename = `image-export-${timestamp}.${format === 'jpg' ? 'jpg' : 'png'}`;

            const link = document.createElement('a');
            link.download = filename;
            link.href = dataURL;
            link.click();

            // Restore original background
            fabricCanvas.backgroundColor = originalBg || 'transparent';
            fabricCanvas.renderAll();

            toast.success("Image exported!");
          }
        } catch (error) {
          console.error("Error during image export:", error);
          toast.error("Failed to export image. Please try again.");
        }
        return;
      }

      // Export selected artboard
      if (isSelectedArtboard) {
        const artboard = selectedObject as FabricRect;
        const artboardBounds = artboard.getBoundingRect();

        try {
          // Create a temporary canvas with exact artboard dimensions
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = artboardBounds.width * multiplier;
          tempCanvas.height = artboardBounds.height * multiplier;
          const tempCtx = tempCanvas.getContext('2d');

          if (!tempCtx) {
            toast.error("Failed to create export canvas");
            return;
          }

          // Set background (use artboard fill if available, otherwise white)
          const artboardFill = (artboard as any).fill;
          if (artboardFill && typeof artboardFill === 'string') {
            tempCtx.fillStyle = artboardFill;
          } else {
            tempCtx.fillStyle = '#ffffff';
          }
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

          // Get all objects that are within or overlap the artboard
          const allObjects = fabricCanvas.getObjects();
          const objectsInArtboard = allObjects.filter((obj: any) => {
            if (obj === artboard) return false; // Skip the artboard itself
            const objBounds = obj.getBoundingRect();
            // Check if object overlaps with artboard bounds
            return !(objBounds.left + objBounds.width < artboardBounds.left ||
              objBounds.left > artboardBounds.left + artboardBounds.width ||
              objBounds.top + objBounds.height < artboardBounds.top ||
              objBounds.top > artboardBounds.top + artboardBounds.height);
          });

          // Create a temporary fabric canvas for rendering
          const tempFabricCanvas = new FabricCanvas(tempCanvas, {
            width: artboardBounds.width,
            height: artboardBounds.height,
            backgroundColor: artboardFill && typeof artboardFill === 'string' ? artboardFill : '#ffffff',
          });

          // Clone and position objects relative to artboard
          const clonePromises = objectsInArtboard.map((obj: any) => {
            return obj.clone().then((cloned: any) => {
              cloned.set({
                left: (cloned.left || 0) - artboardBounds.left,
                top: (cloned.top || 0) - artboardBounds.top,
              });
              cloned.setCoords();
              return cloned;
            });
          });

          // Capture format in a const to preserve type in nested callbacks
          const exportFormat: 'png' | 'jpg' | 'svg' = format;
          Promise.all(clonePromises).then((clones) => {
            clones.forEach((clone) => tempFabricCanvas.add(clone));
            tempFabricCanvas.renderAll();

            // Export with high quality
            if (exportFormat === 'svg') {
              const svgString = tempFabricCanvas.toSVG();
              filename = `artboard-export-${timestamp}.svg`;
              const blob = new Blob([svgString], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = filename;
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);
            } else {
              dataURL = tempFabricCanvas.toDataURL({
                format: exportFormat === 'jpg' ? 'jpeg' : 'png',
                quality: 1,
                multiplier: multiplier,
              });
              filename = `artboard-export-${timestamp}.${exportFormat === 'jpg' ? 'jpg' : 'png'}`;
              const link = document.createElement('a');
              link.download = filename;
              link.href = dataURL;
              link.click();
            }

            // Clean up
            tempFabricCanvas.dispose();
            toast.success("Artboard exported!");
          }).catch((error) => {
            console.error("Error during artboard export:", error);
            toast.error("Failed to export artboard. Please try again.");
            tempFabricCanvas.dispose();
          });
        } catch (error) {
          console.error("Error during artboard export:", error);
          toast.error("Failed to export artboard. Please try again.");
        }
        return;
      }
    }

    // Handle SVG export
    if (format === 'svg') {
      try {
        let svgString: string;

        if (exportType === 'artboard') {
          // Export artboard as SVG
          const artboards = getArtboards();
          if (artboards.length === 0) {
            toast.error("No artboard found on canvas");
            return;
          }

          const selectedIsArtboard = selectedObject && (
            (selectedObject instanceof FabricRect && (selectedObject as any).isArtboard) ||
            selectedObject instanceof FabricImage
          );
          const artboard = selectedIsArtboard ? selectedObject : artboards[0];
          const artboardBounds = artboard.getBoundingRect();

          // Get all objects within artboard bounds (including partially overlapping)
          const objectsInArtboard = fabricCanvas.getObjects().filter((obj: any) => {
            // Skip the artboard itself
            if (obj === artboard) return false;
            const objBounds = obj.getBoundingRect();
            // Check if object overlaps with artboard
            return !(objBounds.left + objBounds.width < artboardBounds.left ||
              objBounds.left > artboardBounds.left + artboardBounds.width ||
              objBounds.top + objBounds.height < artboardBounds.top ||
              objBounds.top > artboardBounds.top + artboardBounds.height);
          });

          // Create a temporary canvas for the artboard
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = artboardBounds.width;
          tempCanvas.height = artboardBounds.height;
          const artboardFill = (artboard as any).fill;
          const tempFabricCanvas = new FabricCanvas(tempCanvas, {
            width: artboardBounds.width,
            height: artboardBounds.height,
            backgroundColor: artboardFill && typeof artboardFill === 'string' ? artboardFill : (fabricCanvas.backgroundColor || '#ffffff'),
          });

          // Clone and position objects relative to artboard
          const clonedObjects = objectsInArtboard.map((obj: any) => {
            return obj.clone().then((cloned: any) => {
              cloned.set({
                left: (cloned.left || 0) - artboardBounds.left,
                top: (cloned.top || 0) - artboardBounds.top,
              });
              cloned.setCoords();
              return cloned;
            });
          });

          // Wait for all clones, then add to temp canvas and export
          Promise.all(clonedObjects).then((clones) => {
            clones.forEach((clone) => tempFabricCanvas.add(clone));
            tempFabricCanvas.renderAll();

            svgString = tempFabricCanvas.toSVG();
            filename = `artboard-export-${timestamp}.svg`;

            // Create blob and download
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);

            // Clean up
            tempFabricCanvas.dispose();

            toast.success("SVG exported!");
          }).catch((error) => {
            console.error("Error during SVG export:", error);
            toast.error("Failed to export SVG. Please try again.");
          });

          return;
        } else {
          // Export entire canvas as SVG
          svgString = fabricCanvas.toSVG();
          filename = `canvas-export-${timestamp}.svg`;
        }

        // Create blob and download
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        toast.success("SVG exported!");
        return;
      } catch (error) {
        console.error("Error during SVG export:", error);
        toast.error("Failed to export SVG. Please try again.");
        return;
      }
    }

    if (exportType === 'artboard') {
      // Export artboard with all objects on it
      // Note: SVG export for artboards is handled earlier in the function
      const artboards = getArtboards();
      if (artboards.length === 0) {
        toast.error("No artboard found on canvas");
        return;
      }

      // Export the first artboard (or the selected one if it's an artboard)
      const selectedIsArtboard = selectedObject && (
        (selectedObject instanceof FabricRect && (selectedObject as any).isArtboard) ||
        selectedObject instanceof FabricImage
      );
      const artboard = selectedIsArtboard ? selectedObject : artboards[0];
      const artboardBounds = artboard.getBoundingRect();

      try {
        // Create a temporary canvas with exact artboard dimensions
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = artboardBounds.width * multiplier;
        tempCanvas.height = artboardBounds.height * multiplier;
        const tempCtx = tempCanvas.getContext('2d');

        if (!tempCtx) {
          toast.error("Failed to create export canvas");
          return;
        }

        // Set background (use artboard fill if available, otherwise white)
        const artboardFill = (artboard as any).fill;
        if (artboardFill && typeof artboardFill === 'string') {
          tempCtx.fillStyle = artboardFill;
        } else {
          tempCtx.fillStyle = '#ffffff';
        }
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Get all objects that are within or overlap the artboard
        const allObjects = fabricCanvas.getObjects();
        const objectsInArtboard = allObjects.filter((obj: any) => {
          if (obj === artboard) return false; // Skip the artboard itself
          const objBounds = obj.getBoundingRect();
          // Check if object overlaps with artboard bounds
          return !(objBounds.left + objBounds.width < artboardBounds.left ||
            objBounds.left > artboardBounds.left + artboardBounds.width ||
            objBounds.top + objBounds.height < artboardBounds.top ||
            objBounds.top > artboardBounds.top + artboardBounds.height);
        });

        // Create a temporary fabric canvas for rendering
        const tempFabricCanvas = new FabricCanvas(tempCanvas, {
          width: artboardBounds.width,
          height: artboardBounds.height,
          backgroundColor: artboardFill && typeof artboardFill === 'string' ? artboardFill : '#ffffff',
        });

        // Clone and position objects relative to artboard
        const clonePromises = objectsInArtboard.map((obj: any) => {
          return obj.clone().then((cloned: any) => {
            cloned.set({
              left: (cloned.left || 0) - artboardBounds.left,
              top: (cloned.top || 0) - artboardBounds.top,
            });
            cloned.setCoords();
            return cloned;
          });
        });

        // Capture format in a const to preserve type in nested callbacks
        // At this point, format can only be 'png' | 'jpg' because SVG is handled earlier
        const exportFormat: 'png' | 'jpg' = format as 'png' | 'jpg';
        Promise.all(clonePromises).then((clones) => {
          clones.forEach((clone) => tempFabricCanvas.add(clone));
          tempFabricCanvas.renderAll();

          // Export with high quality (PNG or JPG only, SVG handled earlier)
          dataURL = tempFabricCanvas.toDataURL({
            format: exportFormat === 'jpg' ? 'jpeg' : 'png',
            quality: 1,
            multiplier: multiplier,
          });
          filename = `artboard-export-${timestamp}.${exportFormat === 'jpg' ? 'jpg' : 'png'}`;
          const link = document.createElement('a');
          link.download = filename;
          link.href = dataURL;
          link.click();

          // Clean up
          tempFabricCanvas.dispose();
          toast.success("Artboard exported!");
        }).catch((error) => {
          console.error("Error during artboard export:", error);
          toast.error("Failed to export artboard. Please try again.");
          tempFabricCanvas.dispose();
        });
      } catch (error) {
        console.error("Error during artboard export:", error);
        toast.error("Failed to export artboard. Please try again.");
      }
      return;
    } else {
      // Export entire canvas
      const originalBg = fabricCanvas.backgroundColor as string | undefined;
      (fabricCanvas as any).backgroundColor = '#ffffff';
      fabricCanvas.renderAll();
      fabricCanvas.renderAll();

      dataURL = fabricCanvas.toDataURL({
        format: format === 'jpg' ? 'jpeg' : 'png',
        quality: 1, // Maximum quality for both PNG and JPG
        multiplier: multiplier, // 4x resolution
      });

      filename = `canvas-export-${timestamp}.${format === 'jpg' ? 'jpg' : 'png'}`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataURL;
      link.click();

      // Restore original background
      (fabricCanvas as any).backgroundColor = (originalBg as string | undefined) || 'transparent';
      fabricCanvas.renderAll();
      fabricCanvas.renderAll();

      toast.success("Canvas exported!");
    }
  };

  // Generate preview for selected image/artboard
  const generateExportPreview = () => {
    if (!fabricCanvas) {
      setExportPreview(null);
      return;
    }

    // Check if there's a selected image or artboard
    const isSelectedImage = selectedObject instanceof FabricImage;
    const isSelectedArtboard = selectedObject instanceof FabricRect && (selectedObject as any).isArtboard;

    if (isSelectedImage || isSelectedArtboard) {
      try {
        const bounds = selectedObject.getBoundingRect();
        const previewMultiplier = 2; // Lower multiplier for preview to keep it fast

        // Generate preview
        const previewDataURL = fabricCanvas.toDataURL({
          format: 'png',
          quality: 0.9,
          multiplier: previewMultiplier,
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        });

        setExportPreview(previewDataURL);
      } catch (error) {
        console.error("Error generating preview:", error);
        setExportPreview(null);
      }
    } else {
      setExportPreview(null);
    }
  };

  const handleExportClick = () => {
    // Determine export type based on selection
    const isSelectedImage = selectedObject instanceof FabricImage;
    const isSelectedArtboard = selectedObject instanceof FabricRect && (selectedObject as any).isArtboard;

    if (isSelectedImage || isSelectedArtboard) {
      setExportType('selected');
      generateExportPreview();
    } else {
      setExportType('canvas');
      setExportPreview(null);
    }

    setIsExportDialogOpen(true);
  };

  const handleExportConfirm = () => {
    handleExport(exportFormat, exportType);
    setIsExportDialogOpen(false);
    setExportPreview(null);
  };

  const handleEditComplete = (newImageUrl: string) => {
    if (!fabricCanvas || !selectedImage) return;

    FabricImage.fromURL(newImageUrl, {
      crossOrigin: 'anonymous'
    }).then((img) => {
      // Preserve position, scale, and other properties from the original image
      img.set({
        left: selectedImage.left,
        top: selectedImage.top,
        scaleX: selectedImage.scaleX,
        scaleY: selectedImage.scaleY,
        angle: selectedImage.angle,
        opacity: selectedImage.opacity,
        selectable: true,
      });

      // Remove old image and add new one
      fabricCanvas.remove(selectedImage);
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();

      setSelectedImage(img);
      setSelectedObject(img); // Update selectedObject so sidebar stays open
    }).catch((error) => {
      console.error("Error loading edited image:", error);
      toast.error("Failed to load edited image");
    });
  };

  // Expose save function
  useEffect(() => {
    if (onCanvasSaveRef) {
      onCanvasSaveRef.current = () => {
        if (!fabricCanvas) return null;
        return fabricCanvas.toJSON();
      };
    }
  }, [fabricCanvas, onCanvasSaveRef]);

  // Expose canvas instance for thumbnail generation
  useEffect(() => {
    if (onCanvasInstanceRef) {
      onCanvasInstanceRef.current = () => {
        if (!fabricCanvas) return null;
        // Generate thumbnail as data URL
        try {
          const originalBg = fabricCanvas.backgroundColor as string | undefined;
          if (!originalBg || originalBg === 'transparent') {
            fabricCanvas.backgroundColor = '#ffffff';
            fabricCanvas.renderAll();
          }
          const dataURL = fabricCanvas.toDataURL({
            format: 'png',
            quality: 0.8,
            multiplier: 0.5, // Smaller size for thumbnail
          });
          // Restore background
          if (!originalBg || originalBg === 'transparent') {
            fabricCanvas.backgroundColor = originalBg || 'transparent';
            fabricCanvas.renderAll();
          }
          return dataURL;
        } catch (error) {
          console.error('Error generating thumbnail:', error);
          return null;
        }
      };
    }
  }, [fabricCanvas, onCanvasInstanceRef]);

  const handleNewProject = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = 'transparent';
    fabricCanvas.renderAll();
    setSelectedImage(null);
    setImageFilters({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      blur: 0,
    });
    onClear();
    toast.success("Canvas cleared");
  };

  // Canvas command handler (calls local API route)
  const handleCanvasCommand = async (command: string): Promise<string> => {
    if (!fabricCanvas) {
      toast.error("Canvas not ready");
      return "Canvas not ready";
    }

    const toNumber = (value: unknown, fallback = 0) => {
      const num = typeof value === 'number' ? value : Number(value ?? fallback);
      return Number.isFinite(num) ? num : fallback;
    };

    const isCenterWithin = (childBox: any, parentBox: any) => {
      if (!childBox || !parentBox) return false;
      const cx = toNumber(childBox.centerX ?? childBox.left + childBox.width / 2);
      const cy = toNumber(childBox.centerY ?? childBox.top + childBox.height / 2);
      return (
        cx >= toNumber(parentBox.left) &&
        cx <= toNumber(parentBox.right) &&
        cy >= toNumber(parentBox.top) &&
        cy <= toNumber(parentBox.bottom)
      );
    };

    try {
      const fabricObjects = fabricCanvas.getObjects();

      const objects = fabricObjects.map((obj, idx) => {
        const bounding = (obj as any).getBoundingRect?.(true, true) ?? {
          left: toNumber(obj.left),
          top: toNumber(obj.top),
          width: toNumber(obj.width),
          height: toNumber(obj.height),
        };
        const centerPoint = obj.getCenterPoint?.();
        const scaledWidth = typeof (obj as any).getScaledWidth === 'function'
          ? toNumber((obj as any).getScaledWidth(), bounding.width)
          : toNumber(bounding.width);
        const scaledHeight = typeof (obj as any).getScaledHeight === 'function'
          ? toNumber((obj as any).getScaledHeight(), bounding.height)
          : toNumber(bounding.height);

        const base: any = {
          id: `obj_${idx}`,
          type: obj.type,
          name: (obj as any).name || obj.type || `Object ${idx + 1}`,
          typeLabel: (obj as any).name || obj.type,
          zIndex: idx,
          isArtboard: Boolean((obj as any).isArtboard),
          left: toNumber(obj.left, bounding.left),
          top: toNumber(obj.top, bounding.top),
          width: toNumber(obj.width, bounding.width),
          height: toNumber(obj.height, bounding.height),
          scaledWidth,
          scaledHeight,
          scaleX: toNumber(obj.scaleX, 1),
          scaleY: toNumber(obj.scaleY, 1),
          angle: toNumber(obj.angle, 0),
          opacity: toNumber(obj.opacity, 1),
          flipX: Boolean((obj as any).flipX),
          flipY: Boolean((obj as any).flipY),
          selectable: Boolean(obj.selectable),
          visible: Boolean(obj.visible),
          lockMovementX: Boolean((obj as any).lockMovementX),
          lockMovementY: Boolean((obj as any).lockMovementY),
          boundingBox: {
            left: toNumber(bounding.left),
            top: toNumber(bounding.top),
            width: toNumber(bounding.width),
            height: toNumber(bounding.height),
            right: toNumber(bounding.left) + toNumber(bounding.width),
            bottom: toNumber(bounding.top) + toNumber(bounding.height),
            centerX: toNumber(bounding.left) + toNumber(bounding.width) / 2,
            centerY: toNumber(bounding.top) + toNumber(bounding.height) / 2,
          },
          center: {
            x: toNumber(centerPoint?.x, toNumber(bounding.left) + toNumber(bounding.width) / 2),
            y: toNumber(centerPoint?.y, toNumber(bounding.top) + toNumber(bounding.height) / 2),
          },
          artboardIds: [] as string[],
        };

        if ('fill' in obj) base.fill = (obj as any).fill;
        if ('stroke' in obj) base.stroke = (obj as any).stroke;
        if ('strokeWidth' in obj) base.strokeWidth = toNumber((obj as any).strokeWidth, 0);

        if (obj instanceof FabricTextbox) {
          base.text = obj.text ?? '';
          base.fontSize = toNumber(obj.fontSize, 16);
          base.fontFamily = obj.fontFamily ?? 'Inter';
          base.fontWeight = obj.fontWeight ?? 'normal';
          base.textAlign = obj.textAlign ?? 'left';
          base.fill = obj.fill;
          base.charSpacing = toNumber(obj.charSpacing, 0);
          base.lineHeight = toNumber(obj.lineHeight, 1.16);
        } else if (obj instanceof FabricImage) {
          const getSrc = (obj as any).getSrc;
          base.src = typeof getSrc === 'function' ? getSrc.call(obj) : (obj as any).src || null;
          base.cropX = toNumber(obj.cropX, 0);
          base.cropY = toNumber(obj.cropY, 0);
          base.filterSummary = (obj.filters || []).map((filter: any) => filter?.type || filter?.constructor?.name || 'filter');
        } else if (obj instanceof FabricRect) {
          base.rx = toNumber((obj as any).rx, 0);
          base.ry = toNumber((obj as any).ry, 0);
        } else if (obj instanceof FabricCircle) {
          base.radius = toNumber(obj.radius, scaledWidth / 2);
        } else if (obj instanceof FabricLine) {
          base.points = {
            x1: toNumber((obj as any).x1, obj.left ?? 0),
            y1: toNumber((obj as any).y1, obj.top ?? 0),
            x2: toNumber((obj as any).x2, obj.left ?? 0),
            y2: toNumber((obj as any).y2, obj.top ?? 0),
          };
        } else if (obj instanceof FabricGroup) {
          base.memberIds = (obj as any)._objects?.map((child: any) => {
            const index = fabricObjects.indexOf(child);
            return index >= 0 ? `obj_${index}` : null;
          }).filter(Boolean);
        }

        return base;
      });

      const objectMap: Record<string, any> = {};
      objects.forEach((object) => {
        objectMap[object.id] = object;
      });

      const artboards = objects
        .filter((object) => object.isArtboard)
        .map((artboard) => {
          const containedObjectIds = objects
            .filter((object) => object.id !== artboard.id && isCenterWithin(object.boundingBox, artboard.boundingBox))
            .map((object) => object.id);

          containedObjectIds.forEach((objectId) => {
            const target = objectMap[objectId];
            if (!target) return;
            target.artboardIds = Array.from(new Set([...(target.artboardIds || []), artboard.id]));
          });

          const artboardIndex = parseInt(artboard.id.replace('obj_', ''), 10);
          const artboardFabricObject = fabricObjects[artboardIndex];
          const background = artboardFabricObject && 'fill' in artboardFabricObject ? (artboardFabricObject as any).fill : artboard.fill;

          return {
            id: artboard.id,
            name: artboard.name,
            boundingBox: artboard.boundingBox,
            center: artboard.center,
            size: { width: artboard.scaledWidth, height: artboard.scaledHeight },
            background,
            zIndex: artboard.zIndex,
            objectIds: containedObjectIds,
          };
        });

      const selectedObjects = fabricCanvas.getActiveObjects();
      const selectedObjectSet = new Set<string>();
      selectedObjects.forEach((current) => {
        if (current instanceof FabricActiveSelection) {
          current.getObjects().forEach((child) => {
            const index = fabricObjects.indexOf(child);
            if (index >= 0) {
              selectedObjectSet.add(`obj_${index}`);
            }
          });
        } else {
          const index = fabricObjects.indexOf(current);
          if (index >= 0) {
            selectedObjectSet.add(`obj_${index}`);
          }
        }
      });
      const selectedObjectIds = Array.from(selectedObjectSet);

      const activeSelection = fabricCanvas.getActiveObject();
      let selectionBounds: any = null;
      if (activeSelection) {
        const rawBounds = (activeSelection as any).getBoundingRect?.(true, true);
        const bounds = rawBounds ?? {
          left: toNumber((activeSelection as any).left),
          top: toNumber((activeSelection as any).top),
          width: toNumber((activeSelection as any).width),
          height: toNumber((activeSelection as any).height),
        };
        selectionBounds = {
          left: toNumber(bounds.left),
          top: toNumber(bounds.top),
          width: toNumber(bounds.width),
          height: toNumber(bounds.height),
          right: toNumber(bounds.left) + toNumber(bounds.width),
          bottom: toNumber(bounds.top) + toNumber(bounds.height),
          centerX: toNumber(bounds.left) + toNumber(bounds.width) / 2,
          centerY: toNumber(bounds.top) + toNumber(bounds.height) / 2,
        };
      }

      const countsByType = objects.reduce<Record<string, number>>((acc, object) => {
        acc[object.type] = (acc[object.type] ?? 0) + 1;
        return acc;
      }, {});

      const activeArtboardIds = artboards
        .filter((artboard) => selectedObjectIds.some((id) => id === artboard.id || artboard.objectIds.includes(id)))
        .map((artboard) => artboard.id);

      const summary = {
        totalObjects: objects.length,
        totalArtboards: artboards.length,
        countsByType,
        selectedObjectIds,
        activeArtboardIds,
        artboards: artboards.map((artboard) => ({
          id: artboard.id,
          name: artboard.name,
          objectCount: artboard.objectIds.length,
          width: artboard.size.width,
          height: artboard.size.height,
        })),
        selectedObjects: selectedObjectIds.map((id) => ({
          id,
          name: objectMap[id]?.name,
          type: objectMap[id]?.type,
          artboardIds: objectMap[id]?.artboardIds,
        })),
      };

      const canvasState = {
        version: 2,
        timestamp: Date.now(),
        canvasSize: { width: fabricCanvas.getWidth(), height: fabricCanvas.getHeight() },
        zoom: fabricCanvas.getZoom(),
        viewportTransform: Array.from(fabricCanvas.viewportTransform || []),
        backgroundColor: fabricCanvas.backgroundColor,
        objects,
        artboards,
        objectOrder: objects.map((object) => object.id),
        selectedObjectIds,
        selectionBounds,
        summary,
      };

      console.log('[Canvas Command]', command, canvasState.summary);

      const res = await fetch('/api/canvas-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, canvasState })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[Canvas Command Error]', errorText);
        throw new Error(errorText);
      }

      const data = await res.json();
      console.log('[Canvas Command Response]', data);

      if (data?.actions && Array.isArray(data.actions) && data.actions.length > 0) {
        const { inverseActions } = executeActions(
          fabricCanvas,
          data.actions as AgentAction[],
          {
            createTextbox: (text: string, options: any) => new FabricTextbox(text, options),
          }
        );
        if (inverseActions.length > 0) {
          undoStackRef.current.push(inverseActions);
          if (undoStackRef.current.length > 50) undoStackRef.current.shift();
          redoStackRef.current = [];
          setHistoryAvailability();
        }
        toast.success(data.message || "Command executed");
      } else {
        toast.info(data.message || "No actions performed");
      }

      return data?.message || "Done";
    } catch (error) {
      console.error('Canvas command error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to execute command";
      toast.error(errorMessage);
      return errorMessage;
    }
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    if (!fabricCanvas) return;
    const inverse = undoStackRef.current.pop();
    if (!inverse || inverse.length === 0) return;
    // Executing inverse yields a forward set to redo
    const { inverseActions } = executeActions(
      fabricCanvas,
      inverse,
      {
        createTextbox: (text: string, options: any) => new FabricTextbox(text, options),
      }
    );
    if (inverseActions.length > 0) {
      redoStackRef.current.push(inverseActions);
      if (redoStackRef.current.length > 50) redoStackRef.current.shift();
      setHistoryAvailability();
    }
  };

  const handleRedo = () => {
    if (!fabricCanvas) return;
    const forward = redoStackRef.current.pop();
    if (!forward || forward.length === 0) return;
    const { inverseActions } = executeActions(
      fabricCanvas,
      forward,
      {
        createTextbox: (text: string, options: any) => new FabricTextbox(text, options),
      }
    );
    if (inverseActions.length > 0) {
      undoStackRef.current.push(inverseActions);
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      setHistoryAvailability();
    }
  };

  // Hotkeys for undo/redo and delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      const isDelete = e.key === 'Delete' || e.key === 'Backspace';
      const meta = e.metaKey || e.ctrlKey;

      // Handle Delete/Backspace key
      if (isDelete && !meta && !e.shiftKey && !e.altKey) {
        // Don't delete if user is typing in an input field
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }

        if (fabricCanvas) {
          // Get active object (could be a single object or a group/selection)
          const activeObject = fabricCanvas.getActiveObject();

          if (activeObject) {
            e.preventDefault();

            // Handle ActiveSelection (multiple objects selected)
            if (activeObject instanceof FabricActiveSelection) {
              const objects = activeObject.getObjects();
              objects.forEach((obj: FabricObject) => {
                fabricCanvas.remove(obj);
              });
            } else {
              // Handle single object
              fabricCanvas.remove(activeObject);
            }

            // Clear selection
            fabricCanvas.discardActiveObject();
            fabricCanvas.renderAll();

            // Update state
            setSelectedObject(null);
            setSelectedImage(null);
          }
        }
        return;
      }

      // Handle path completion/cancellation
      if (isDrawingPathRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (fabricCanvas) completePath(fabricCanvas);
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (fabricCanvas) cancelPath(fabricCanvas);
          return;
        }
      }

      // Handle undo/redo
      if (meta && isZ && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((meta && isZ && e.shiftKey) || (meta && isY)) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fabricCanvas]);

  // Expose canvas command handler via ref
  useEffect(() => {
    if (onCanvasCommandRef) {
      onCanvasCommandRef.current = handleCanvasCommand;
    }
  }, [onCanvasCommandRef, fabricCanvas]);

  // Expose undo/redo handlers via history ref
  useEffect(() => {
    if (onCanvasHistoryRef) {
      onCanvasHistoryRef.current = { undo: handleUndo, redo: handleRedo };
    }
  }, [onCanvasHistoryRef, fabricCanvas]);

  // Expose export handler via export ref
  useEffect(() => {
    if (onCanvasExportRef) {
      onCanvasExportRef.current = handleExportClick;
    }
  }, [onCanvasExportRef]);

  // Get artboard objects (FabricRect objects marked as artboards)
  const getArtboards = () => {
    if (!fabricCanvas) return [];
    return fabricCanvas.getObjects().filter((obj: FabricObject) =>
      (obj instanceof FabricRect && (obj as any).isArtboard) || obj instanceof FabricImage
    ) as (FabricRect | FabricImage)[];
  };

  const handleCanvasColorChange = (color: string) => {
    if (!fabricCanvas) return;
    // Keep canvas background transparent so grid is always visible
    // The grid is rendered on the container div, so we don't change canvas background
    fabricCanvas.backgroundColor = 'transparent';
    fabricCanvas.renderAll();
  };

  // Expose color change handler via ref
  useEffect(() => {
    if (onCanvasColorRef) {
      onCanvasColorRef.current = handleCanvasColorChange;
    }
  }, [onCanvasColorRef, fabricCanvas]);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            ref={containerRef}
            className="relative w-full h-screen overflow-hidden"
            style={{
              backgroundColor: initialCanvasColor || '#F4F4F6',
              backgroundImage: showGrid ? 'radial-gradient(circle, #d1d1d6 1px, transparent 1px)' : 'none',
              backgroundSize: showGrid ? '24px 24px' : undefined,
              backgroundPosition: showGrid ? `${gridOffset.x}px ${gridOffset.y}px` : undefined,
            }}
          >
            <canvas ref={canvasRef} className="absolute inset-0 cursor-default" />
            {/* Video play/pause overlay — shown when a video is selected */}
            {videoControlsRect && fabricCanvas && (() => {
              const active = fabricCanvas.getActiveObject();
              const videoEl = active && (active as any).__isVideo ? (active as any).__videoElement as HTMLVideoElement : null;
              if (!videoEl) return null;
              const isPlaying = !videoEl.paused;
              return (
                <div
                  ref={videoControlsRef}
                  className="absolute z-[55] flex items-center justify-center rounded-lg px-2 py-1.5 shadow-lg"
                  style={{
                    left: videoControlsRect.left,
                    top: videoControlsRect.top,
                    width: videoControlsRect.width,
                    height: videoControlsRect.height,
                    backgroundColor: '#000000',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPlaying) {
                        videoEl.pause();
                        (active as any).__isPlaying = false;
                        setVideoPlayingState(false);
                      } else {
                        videoEl.play().then(() => {
                          (active as any).__isPlaying = true;
                          setVideoPlayingState(true);
                        }).catch(() => {});
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/20 transition-colors"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </div>
              );
            })()}
            {isImagePending && (
              <div
                className="pointer-events-none absolute z-[55]"
                style={{
                  left: placeholderPosition.left,
                  top: placeholderPosition.top,
                }}
              >
                <Skeleton
                  animate="blink"
                  className="rounded-none bg-[#d4d4d8] shadow-lg shadow-black/10"
                  style={{
                    width: `${placeholderSize.width}px`,
                    height: `${placeholderSize.height}px`,
                  }}
                />
              </div>
            )}

            {/* Hidden file input for image upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload image"
            />
            {/* Hidden file input for node image upload */}
            <input
              ref={nodeImageFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleNodeImageFileChange}
              className="hidden"
              aria-label="Upload image to node"
            />

            {/* Toolbar for all modes */}
            <Toolbar
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              activeToolbarButton={activeToolbarButton}
              setActiveToolbarButton={setActiveToolbarButton}
              activeShape={activeShape}
              setActiveShape={setActiveShape}
              isToolbarExpanded={isToolbarExpanded}
              setIsToolbarExpanded={setIsToolbarExpanded}
              onAddText={handleAddText}
              onAddStickyNote={handleAddStickyNote}
              onActivateBrush={handleActivateBrush}
              onAddTimer={handleAddTimer}
              onAddVote={handleAddVote}
              onAddKanban={handleAddKanban}
              onAddMindMap={handleAddMindMap}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              onUploadClick={handleUploadClick}
              penSubTool={penSubTool}
              setPenSubTool={setPenSubTool}
              layout={toolbarLayout}
              mode={toolbarMode}
            />

            {/* Layers sidebar (controlled by isLayersOpen state) */}
            {showLayersPanel && fabricCanvas && (
              <LayersPanel
                canvas={fabricCanvas}
                onRequestClose={() => setIsLayersOpen(false)}
                open={isLayersOpen}
              />
            )}

          </div>
        </ContextMenuTrigger>

        {/* Right-click context menu */}
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={(e) => {
              if (!fabricCanvas) return;
              const many = fabricCanvas.getActiveObjects();
              if (many && many.length > 1) {
                // Remove objects from canvas
                many.forEach(obj => fabricCanvas.remove(obj));

                // Create group
                const group = new FabricGroup(many, {
                  canvas: fabricCanvas
                } as any);

                // Name the group
                const existingGroups = fabricCanvas.getObjects().filter((obj: FabricObject) =>
                  obj instanceof FabricGroup && (obj as any).name?.startsWith('Group')
                );
                const groupNumber = existingGroups.length;
                (group as any).name = `Group ${groupNumber + 1}`;

                // Add group to canvas
                fabricCanvas.add(group);
                fabricCanvas.setActiveObject(group);
                fabricCanvas.requestRenderAll();
                fabricCanvas.fire('object:modified', { target: group } as any);
              }
            }}
          >
            Group
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              if (!fabricCanvas) return;
              const active = fabricCanvas.getActiveObject();
              if (active && active instanceof FabricGroup) {
                const group = active as FabricGroup;
                const items = (group as any)._objects?.slice() as FabricObject[] || [];

                if (items.length === 0) return;

                // Get group's transform
                const groupLeft = group.left || 0;
                const groupTop = group.top || 0;
                const groupScaleX = group.scaleX || 1;
                const groupScaleY = group.scaleY || 1;
                const groupAngle = group.angle || 0;

                // Destroy the group properly
                (group as any)._restoreObjectsState?.();
                fabricCanvas.remove(group);

                // Restore each item with proper transformations
                items.forEach(item => {
                  // Get item's position relative to group
                  const itemLeft = (item.left || 0) * groupScaleX;
                  const itemTop = (item.top || 0) * groupScaleY;

                  // Apply group rotation if any
                  if (groupAngle !== 0) {
                    const rad = (groupAngle * Math.PI) / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    const rotatedX = itemLeft * cos - itemTop * sin;
                    const rotatedY = itemLeft * sin + itemTop * cos;

                    item.set({
                      left: groupLeft + rotatedX,
                      top: groupTop + rotatedY,
                      scaleX: (item.scaleX || 1) * groupScaleX,
                      scaleY: (item.scaleY || 1) * groupScaleY,
                      angle: (item.angle || 0) + groupAngle,
                      group: undefined,
                      visible: true,
                      evented: true,
                      selectable: true
                    });
                  } else {
                    item.set({
                      left: groupLeft + itemLeft,
                      top: groupTop + itemTop,
                      scaleX: (item.scaleX || 1) * groupScaleX,
                      scaleY: (item.scaleY || 1) * groupScaleY,
                      group: undefined,
                      visible: true,
                      evented: true,
                      selectable: true
                    });
                  }

                  // Clean up group references
                  (item as any).group = undefined;
                  (item as any).parent = undefined;

                  item.setCoords();
                  fabricCanvas.add(item);
                });

                fabricCanvas.discardActiveObject();
                fabricCanvas.requestRenderAll();
                fabricCanvas.fire('object:modified', { target: items[0] } as any);
              }
            }}
          >
            Ungroup
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              if (!fabricCanvas) return;
              const objs = fabricCanvas.getActiveObjects();
              if (!objs || objs.length === 0) return;
              objs.forEach((o) => (fabricCanvas as any).bringObjectForward(o));
              fabricCanvas.fire('object:modified', { target: objs[0] } as any);
              fabricCanvas.requestRenderAll();
            }}
          >
            Bring Forward
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              if (!fabricCanvas) return;
              const objs = fabricCanvas.getActiveObjects();
              if (!objs || objs.length === 0) return;
              objs.forEach((o) => (fabricCanvas as any).sendObjectBackwards(o));
              fabricCanvas.fire('object:modified', { target: objs[0] } as any);
              fabricCanvas.requestRenderAll();
            }}
          >
            Send Backward
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              if (!fabricCanvas) return;
              const objs = fabricCanvas.getActiveObjects();
              if (!objs || objs.length === 0) return;
              objs.forEach((o) => (fabricCanvas as any).bringObjectToFront(o));
              fabricCanvas.fire('object:modified', { target: objs[0] } as any);
              fabricCanvas.requestRenderAll();
            }}
          >
            Bring to Front
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              if (!fabricCanvas) return;
              const objs = fabricCanvas.getActiveObjects();
              if (!objs || objs.length === 0) return;
              objs.forEach((o) => (fabricCanvas as any).sendObjectToBack(o));
              fabricCanvas.fire('object:modified', { target: objs[0] } as any);
              fabricCanvas.requestRenderAll();
            }}
          >
            Send to Back
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {/* Inspector Sidebar - Hidden when object is selected (shown in ChatSidebar Tools tab instead) */}
      {false && selectedObject && (
        <InspectorSidebar
          selectedObject={selectedObject}
          canvas={fabricCanvas}
          isClosing={isSidebarClosing}
          onClose={() => {
            if (fabricCanvas) {
              fabricCanvas.discardActiveObject();
              fabricCanvas.requestRenderAll();
            }
            setIsSidebarClosing(true);
            setTimeout(() => {
              setSelectedImage(null);
              setSelectedObject(null);
              setIsEditingPath(false);
              setIsSidebarClosing(false);
            }, 300);
          }}
          onImageEdit={handleEditComplete}
          onCanvasCommand={handleCanvasCommand}
          onEnterPathEditMode={(path) => {
            if (path && (path as any).__pathPoints) {
              setEditingPathPoints([...(path as any).__pathPoints]);
              setIsEditingPath(true);
              isEditingPathRef.current = true;
              selectedPathRef.current = path;
            }
          }}
          onExitPathEditMode={() => {
            setIsEditingPath(false);
            isEditingPathRef.current = false;
            selectedPathRef.current = null;
          }}
        />
      )}

      {/* Path Editor */}
      {isEditingPath && selectedObject && selectedObject.type === 'path' && (
        <PathEditor
          canvas={fabricCanvas}
          path={selectedObject as FabricPath}
          isActive={isEditingPath}
          onPointsChange={(points) => {
            setEditingPathPoints(points);
            if (selectedObject && (selectedObject as any).__pathPoints) {
              (selectedObject as any).__pathPoints = points;
              updatePathFromPoints(selectedObject, points);
              if (fabricCanvas) {
                fabricCanvas.renderAll();
              }
            }
          }}
          onClose={() => {
            setIsEditingPath(false);
            isEditingPathRef.current = false;
            selectedPathRef.current = null;
          }}
        />
      )}

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={(open) => {
        setIsExportDialogOpen(open);
        if (!open) {
          setExportPreview(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export</DialogTitle>
            <DialogDescription>
              Choose export format and what to export
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Preview */}
            {exportPreview && (
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Preview</Label>
                <div className="border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center" style={{ minHeight: '200px', maxHeight: '300px' }}>
                  <img
                    src={exportPreview}
                    alt="Export preview"
                    className="max-w-full max-h-[300px] object-contain"
                  />
                </div>
              </div>
            )}

            {/* Format Selection */}
            <div className="grid gap-3">
              <Label className="text-sm font-medium">Format</Label>
              <RadioGroup value={exportFormat} onValueChange={(value) => setExportFormat(value as 'png' | 'jpg' | 'svg')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="png" id="png" />
                  <Label htmlFor="png" className="font-normal cursor-pointer">PNG (High Quality)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="jpg" id="jpg" />
                  <Label htmlFor="jpg" className="font-normal cursor-pointer">JPG/JPEG (Compressed)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="svg" id="svg" />
                  <Label htmlFor="svg" className="font-normal cursor-pointer">SVG (Vector)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Export Type Selection */}
            <div className="grid gap-3">
              <Label className="text-sm font-medium">Export</Label>
              <RadioGroup value={exportType} onValueChange={(value) => {
                const newType = value as 'canvas' | 'artboard' | 'selected';
                setExportType(newType);
                if (newType === 'selected') {
                  generateExportPreview();
                } else {
                  setExportPreview(null);
                }
              }}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="canvas" id="canvas" />
                  <Label htmlFor="canvas" className="font-normal cursor-pointer">Entire Canvas</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="artboard"
                    id="artboard"
                    disabled={getArtboards().length === 0}
                  />
                  <Label
                    htmlFor="artboard"
                    className={`font-normal cursor-pointer ${getArtboards().length === 0 ? 'opacity-50' : ''}`}
                  >
                    Artboard {getArtboards().length === 0 && '(No artboard found)'}
                  </Label>
                </div>
                {(selectedObject instanceof FabricImage || (selectedObject instanceof FabricRect && (selectedObject as any).isArtboard)) && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="selected" id="selected" />
                    <Label htmlFor="selected" className="font-normal cursor-pointer">
                      Selected {selectedObject instanceof FabricImage ? 'Image' : 'Artboard'}
                    </Label>
                  </div>
                )}
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsExportDialogOpen(false);
              setExportPreview(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleExportConfirm}
              className="bg-[hsl(var(--sidebar-ring))] hover:bg-[hsl(var(--sidebar-ring))]/90 text-white"
            >
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
