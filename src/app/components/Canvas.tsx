'use client';

import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Image as FabricImage, Textbox as FabricTextbox, Rect as FabricRect, Circle as FabricCircle, Line as FabricLine, filters, Point, Object as FabricObject } from "fabric";
import { Button } from "@/app/components/ui/button";
import { Slider } from "@/app/components/ui/slider";
import { Download, RotateCcw, ImagePlus, SlidersHorizontal, Droplet, Crop, Trash2, Filter, Check, X, Wand2, Save, Share } from "lucide-react";
import { toast } from "sonner";
import ImageEditPanel from "@/app/components/ImageEditPanel";
import EditImagePanel from "@/app/components/EditImagePanel";
import { InspectorSidebar } from "@/app/components/InspectorSidebar";
import { Toolbar } from "@/app/components/Toolbar";
// use local Next.js API route for canvas commands
import { executeActions } from "@/app/lib/agent/executor";
import type { AgentAction } from "@/app/lib/agent/canvas-schema";

interface CanvasProps {
  generatedImageUrl: string | null;
  onClear: () => void;
  onCanvasCommandRef?: React.MutableRefObject<((command: string) => Promise<string>) | null>;
  onCanvasHistoryRef?: React.MutableRefObject<{ undo: () => void; redo: () => void } | null>;
  onHistoryAvailableChange?: (available: boolean) => void;
  onCanvasExportRef?: React.MutableRefObject<(() => void) | null>;
  onCanvasColorRef?: React.MutableRefObject<((color: string) => void) | null>;
  initialCanvasColor?: string;
}

export default function Canvas({ generatedImageUrl, onClear, onCanvasCommandRef, onCanvasHistoryRef, onHistoryAvailableChange, onCanvasExportRef, onCanvasColorRef, initialCanvasColor = "#f5f5f5" }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [selectedImage, setSelectedImage] = useState<FabricImage | null>(null);
  const [editPanelPosition, setEditPanelPosition] = useState({ x: 0, y: 0 });
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showAIEditPanel, setShowAIEditPanel] = useState(false);
  const [topToolbarPosition, setTopToolbarPosition] = useState({ x: 0, y: 0 });
  const [showTopToolbar, setShowTopToolbar] = useState(false);
  const [showOpacityPanel, setShowOpacityPanel] = useState(false);
  const [showBlurPanel, setShowBlurPanel] = useState(false);
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
  const isPanningRef = useRef(false);
  const [activeTool, setActiveTool] = useState<"pointer" | "hand">("pointer");
  const activeToolRef = useRef<"pointer" | "hand">("pointer");
  const activeToolbarButtonRef = useRef<'pointer' | 'hand' | 'text' | 'shape' | 'upload' | 'reference' | 'selector' | 'artboard' | 'pen' | 'colorPicker' | 'brush' | 'move' | 'layers' | 'grid' | 'ruler' | 'eraser' | 'eye' | 'zoomIn' | 'zoomOut'>('pointer');
  const [activeShape, setActiveShape] = useState<"rect" | "circle" | "line">("rect");
  const activeShapeRef = useRef<"rect" | "circle" | "line">("rect");
  const [activeToolbarButton, setActiveToolbarButton] = useState<
    'pointer' | 'hand' | 'text' | 'shape' | 'upload' | 'reference' | 'selector' | 'artboard' | 'pen' | 'colorPicker' | 'brush' | 'move' | 'layers' | 'grid' | 'ruler' | 'eraser' | 'eye' | 'zoomIn' | 'zoomOut'
  >('pointer');
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [isSidebarClosing, setIsSidebarClosing] = useState(false);
  const isDrawingShapeRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawingShapeRef = useRef<FabricRect | FabricCircle | FabricLine | null>(null);
  const setHistoryAvailability = () => {
    if (onHistoryAvailableChange) {
      onHistoryAvailableChange((undoStackRef.current?.length || 0) > 0);
    }
  };
  const undoStackRef = useRef<AgentAction[][]>([]);
  const redoStackRef = useRef<AgentAction[][]>([]);
  
  // Magnetic snapping helpers
  const [guideLines, setGuideLines] = useState<Array<{ x?: number; y?: number; vertical?: boolean; snapX?: number; snapY?: number }>>([]);
  const [viewportVersion, setViewportVersion] = useState(0); // Force re-render when viewport changes
  const MAGNETIC_ZONE = 20; // pixels - distance where magnetic pull starts
  const SNAP_THRESHOLD = 3; // pixels - where actual alignment happens (for visual guides)
  const MAX_SNAP_PULL = 0.85; // maximum pull strength at closest proximity
  const MIN_SNAP_PULL = 0.4; // minimum pull strength at edge of magnetic zone


  // Initialize canvas (browser-only)
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: canvasRef.current.parentElement?.clientWidth || window.innerWidth,
      height: canvasRef.current.parentElement?.clientHeight || window.innerHeight,
      backgroundColor: initialCanvasColor,
    });

    // Enable panning with middle mouse drag (or left-drag when Hand tool active)
    canvas.on('mouse:down', (opt: any) => {
      const e = opt.e as MouseEvent;
      const isMiddleButton = e.button === 1 || (e.buttons & 4) === 4;
      const isLeftButton = e.button === 0 || (e.buttons & 1) === 1;
      const useHandTool = activeToolRef.current === 'hand';
      
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
            fill: 'rgba(0,0,0,0)',
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
            fill: 'rgba(0,0,0,0)',
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
        }
        
        canvas.renderAll();
        return;
      }
      
      if (isMiddleButton || (useHandTool && isLeftButton)) {
        isPanningRef.current = true;
        canvas.setCursor('grabbing');
        canvas.selection = false;
      }
    });
    canvas.on('mouse:move', (opt: any) => {
      if (isPanningRef.current) {
        const e = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
        vpt[4] += e.movementX;
        vpt[5] += e.movementY;
        canvas.setViewportTransform(vpt);
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
        }
        
        canvas.renderAll();
      }
    });
    canvas.on('mouse:up', () => {
      isPanningRef.current = false;
      canvas.setCursor(activeToolRef.current === 'hand' ? 'grab' : 'default');
      canvas.selection = activeToolRef.current === 'pointer';
      
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
    });

    // Selection tracking for InspectorSidebar (supports images and text)
    const syncSelection = () => {
      const active = canvas.getActiveObject();
      
      if (!active && selectedObject) {
        // User deselected - trigger closing animation
        setIsSidebarClosing(true);
        setTimeout(() => {
          setSelectedObject(null);
          setSelectedImage(null);
          setIsSidebarClosing(false);
        }, 300); // Match animation duration
      } else {
        setSelectedObject(active || null);
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
      } else {
        const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
        // natural scroll: swipe moves content; move viewport opposite of scroll
        vpt[4] -= e.deltaX;
        vpt[5] -= e.deltaY;
        canvas.setViewportTransform(vpt);
      }
      e.preventDefault();
      e.stopPropagation();
    });

    // Handle selection events
    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0];
      if (obj && obj instanceof (FabricImage as any)) {
        setSelectedImage(obj as FabricImage);
        updateEditPanelPosition(obj, canvas);
        setShowEditPanel(false);
      }
    });

    canvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0];
      if (obj && obj instanceof (FabricImage as any)) {
        setSelectedImage(obj as FabricImage);
        updateEditPanelPosition(obj, canvas);
        setShowEditPanel(false);
      }
    });

    canvas.on('selection:cleared', () => {
      setSelectedImage(null);
      setShowEditPanel(false);
      setShowAIEditPanel(false);
      setShowTopToolbar(false);
      setShowOpacityPanel(false);
      setShowBlurPanel(false);
    });

    canvas.on('object:moving', (e) => {
      if (e.target && e.target instanceof (FabricImage as any) && selectedImage) {
        updateEditPanelPosition(e.target, canvas);
      }
      
      // Magnetic snapping
      const obj = e.target as FabricObject;
      if (!obj) return;
      
      const activeObj = obj;
      const activeObjBounds = activeObj.getBoundingRect();
      const activeObjCenter = {
        x: activeObjBounds.left + activeObjBounds.width / 2,
        y: activeObjBounds.top + activeObjBounds.height / 2
      };
      
      const allObjects = canvas.getObjects();
      const guideLines: Array<{ x?: number; y?: number; vertical?: boolean; snapX?: number; snapY?: number }> = [];
      let bestSnapX: number | null = null;
      let bestSnapY: number | null = null;
      let bestSnapDistanceX = Infinity;
      let bestSnapDistanceY = Infinity;
      let bestXGuide: any = null;
      let bestYGuide: any = null;
      
      // Helper function to calculate magnetic pull strength based on distance
      const calculatePullStrength = (distance: number): number => {
        if (distance > MAGNETIC_ZONE) return 0;
        if (distance <= SNAP_THRESHOLD) return MAX_SNAP_PULL;
        // Linear interpolation between MIN and MAX based on distance
        const normalized = 1 - (distance - SNAP_THRESHOLD) / (MAGNETIC_ZONE - SNAP_THRESHOLD);
        return MIN_SNAP_PULL + (MAX_SNAP_PULL - MIN_SNAP_PULL) * normalized;
      };
      
      // Check against all other objects
      for (const obj of allObjects) {
        if (obj === activeObj || !obj.visible) continue;
        
        const objBounds = obj.getBoundingRect();
        const objCenter = {
          x: objBounds.left + objBounds.width / 2,
          y: objBounds.top + objBounds.height / 2
        };
        
        const objLeft = objBounds.left;
        const objRight = objBounds.left + objBounds.width;
        const objTop = objBounds.top;
        const objBottom = objBounds.top + objBounds.height;
        
        const activeLeft = activeObjBounds.left;
        const activeRight = activeObjBounds.left + activeObjBounds.width;
        const activeTop = activeObjBounds.top;
        const activeBottom = activeObjBounds.top + activeObjBounds.height;
        
        // Check for center alignment (vertical and horizontal)
        const centerXDist = Math.abs(activeObjCenter.x - objCenter.x);
        if (centerXDist < MAGNETIC_ZONE) {
          const snapXValue = objCenter.x - activeObjBounds.width / 2;
          if (centerXDist < bestSnapDistanceX || (centerXDist === bestSnapDistanceX && !bestXGuide)) {
            bestSnapX = snapXValue;
            bestSnapDistanceX = centerXDist;
            bestXGuide = { x: objCenter.x, vertical: true, snapX: objCenter.x, snapY: activeObjCenter.y };
          }
          if (centerXDist < MAGNETIC_ZONE && !guideLines.some(g => g.x === objCenter.x && g.vertical)) {
            guideLines.push({ x: objCenter.x, vertical: true, snapX: objCenter.x, snapY: activeObjCenter.y });
          }
        }
        
        const centerYDist = Math.abs(activeObjCenter.y - objCenter.y);
        if (centerYDist < MAGNETIC_ZONE) {
          const snapYValue = objCenter.y - activeObjBounds.height / 2;
          if (centerYDist < bestSnapDistanceY || (centerYDist === bestSnapDistanceY && !bestYGuide)) {
            bestSnapY = snapYValue;
            bestSnapDistanceY = centerYDist;
            bestYGuide = { y: objCenter.y, snapX: activeObjCenter.x, snapY: objCenter.y };
          }
          if (centerYDist < MAGNETIC_ZONE && !guideLines.some(g => g.y === objCenter.y)) {
            guideLines.push({ y: objCenter.y, snapX: activeObjCenter.x, snapY: objCenter.y });
          }
        }
        
        // Check for edge alignment (left, right, top, bottom)
        const leftDist = Math.abs(activeLeft - objLeft);
        if (leftDist < MAGNETIC_ZONE) {
          if (leftDist < bestSnapDistanceX || (leftDist === bestSnapDistanceX && !bestXGuide)) {
            bestSnapX = objLeft;
            bestSnapDistanceX = leftDist;
            bestXGuide = { x: objLeft, vertical: true };
          }
          if (leftDist < MAGNETIC_ZONE && !guideLines.some(g => g.x === objLeft && g.vertical)) {
            guideLines.push({ x: objLeft, vertical: true });
          }
        }
        
        const rightDist = Math.abs(activeRight - objRight);
        if (rightDist < MAGNETIC_ZONE) {
          const snapXValue = objRight - activeObjBounds.width;
          if (rightDist < bestSnapDistanceX || (rightDist === bestSnapDistanceX && !bestXGuide)) {
            bestSnapX = snapXValue;
            bestSnapDistanceX = rightDist;
            bestXGuide = { x: objRight, vertical: true };
          }
          if (rightDist < MAGNETIC_ZONE && !guideLines.some(g => g.x === objRight && g.vertical)) {
            guideLines.push({ x: objRight, vertical: true });
          }
        }
        
        const topDist = Math.abs(activeTop - objTop);
        if (topDist < MAGNETIC_ZONE) {
          if (topDist < bestSnapDistanceY || (topDist === bestSnapDistanceY && !bestYGuide)) {
            bestSnapY = objTop;
            bestSnapDistanceY = topDist;
            bestYGuide = { y: objTop };
          }
          if (topDist < MAGNETIC_ZONE && !guideLines.some(g => g.y === objTop)) {
            guideLines.push({ y: objTop });
          }
        }
        
        const bottomDist = Math.abs(activeBottom - objBottom);
        if (bottomDist < MAGNETIC_ZONE) {
          const snapYValue = objBottom - activeObjBounds.height;
          if (bottomDist < bestSnapDistanceY || (bottomDist === bestSnapDistanceY && !bestYGuide)) {
            bestSnapY = snapYValue;
            bestSnapDistanceY = bottomDist;
            bestYGuide = { y: objBottom };
          }
          if (bottomDist < MAGNETIC_ZONE && !guideLines.some(g => g.y === objBottom)) {
            guideLines.push({ y: objBottom });
          }
        }
        
        // Check for center alignment with edges
        const centerToLeftDist = Math.abs(activeObjCenter.x - objLeft);
        if (centerToLeftDist < MAGNETIC_ZONE) {
          const snapXValue = objLeft - activeObjBounds.width / 2;
          if (centerToLeftDist < bestSnapDistanceX || (centerToLeftDist === bestSnapDistanceX && !bestXGuide)) {
            bestSnapX = snapXValue;
            bestSnapDistanceX = centerToLeftDist;
            bestXGuide = { x: objLeft, vertical: true };
          }
          if (centerToLeftDist < MAGNETIC_ZONE && !guideLines.some(g => g.x === objLeft && g.vertical)) {
            guideLines.push({ x: objLeft, vertical: true });
          }
        }
        
        const centerToRightDist = Math.abs(activeObjCenter.x - objRight);
        if (centerToRightDist < MAGNETIC_ZONE) {
          const snapXValue = objRight - activeObjBounds.width / 2;
          if (centerToRightDist < bestSnapDistanceX || (centerToRightDist === bestSnapDistanceX && !bestXGuide)) {
            bestSnapX = snapXValue;
            bestSnapDistanceX = centerToRightDist;
            bestXGuide = { x: objRight, vertical: true };
          }
          if (centerToRightDist < MAGNETIC_ZONE && !guideLines.some(g => g.x === objRight && g.vertical)) {
            guideLines.push({ x: objRight, vertical: true });
          }
        }
        
        const centerToTopDist = Math.abs(activeObjCenter.y - objTop);
        if (centerToTopDist < MAGNETIC_ZONE) {
          const snapYValue = objTop - activeObjBounds.height / 2;
          if (centerToTopDist < bestSnapDistanceY || (centerToTopDist === bestSnapDistanceY && !bestYGuide)) {
            bestSnapY = snapYValue;
            bestSnapDistanceY = centerToTopDist;
            bestYGuide = { y: objTop };
          }
          if (centerToTopDist < MAGNETIC_ZONE && !guideLines.some(g => g.y === objTop)) {
            guideLines.push({ y: objTop });
          }
        }
        
        const centerToBottomDist = Math.abs(activeObjCenter.y - objBottom);
        if (centerToBottomDist < MAGNETIC_ZONE) {
          const snapYValue = objBottom - activeObjBounds.height / 2;
          if (centerToBottomDist < bestSnapDistanceY || (centerToBottomDist === bestSnapDistanceY && !bestYGuide)) {
            bestSnapY = snapYValue;
            bestSnapDistanceY = centerToBottomDist;
            bestYGuide = { y: objBottom };
          }
          if (centerToBottomDist < MAGNETIC_ZONE && !guideLines.some(g => g.y === objBottom)) {
            guideLines.push({ y: objBottom });
          }
        }
      }
      
      // Apply magnetic snapping with distance-based pull strength
      if (bestSnapX !== null && bestSnapDistanceX <= MAGNETIC_ZONE) {
        const currentX = activeObj.get('left') || 0;
        const pullStrength = calculatePullStrength(bestSnapDistanceX);
        const newX = currentX + (bestSnapX - currentX) * pullStrength;
        activeObj.set({ left: newX });
      }
      if (bestSnapY !== null && bestSnapDistanceY <= MAGNETIC_ZONE) {
        const currentY = activeObj.get('top') || 0;
        const pullStrength = calculatePullStrength(bestSnapDistanceY);
        const newY = currentY + (bestSnapY - currentY) * pullStrength;
        activeObj.set({ top: newY });
      }
      
      // Store guide lines for rendering
      setGuideLines(guideLines);
      
      // Render guide lines (we'll implement custom rendering next)
      canvas.renderAll();
    });

    // Clear guide lines when object movement ends
    canvas.on('object:modified', () => {
      setGuideLines([]);
    });

    canvas.on('object:scaling', (e) => {
      if (e.target && e.target instanceof (FabricImage as any) && selectedImage) {
        updateEditPanelPosition(e.target, canvas);
      }
    });

    // Track viewport changes for guide line rendering (on zoom/pan)
    let lastVpt = canvas.viewportTransform;
    let lastZoom = canvas.getZoom();
    
    const checkViewportChange = () => {
      const currentVpt = canvas.viewportTransform;
      const currentZoom = canvas.getZoom();
      if (currentVpt && lastVpt) {
        // Check for pan (translation) or zoom changes
        const panChanged = Math.abs(currentVpt[4] - lastVpt[4]) > 0.1 || 
                          Math.abs(currentVpt[5] - lastVpt[5]) > 0.1;
        const zoomChanged = Math.abs(currentZoom - lastZoom) > 0.01;
        
        if (panChanged || zoomChanged) {
          setViewportVersion(prev => prev + 1);
          lastVpt = currentVpt;
          lastZoom = currentZoom;
        }
      }
    };
    
    canvas.on('mouse:up', checkViewportChange);
    canvas.on('mouse:wheel', checkViewportChange);

    // Show top toolbar on double click on an image
    canvas.on('mouse:down', (evt: any) => {
      const isDouble = (evt?.e as MouseEvent)?.detail === 2;
      const target = evt?.target;
      if (isDouble && target && target instanceof (FabricImage as any)) {
        setSelectedImage(target as FabricImage);
        setShowTopToolbar(true);
        positionTopToolbar(null, canvas);
        setShowEditPanel(false);
        setShowAIEditPanel(false);
        setShowOpacityPanel(false);
        setShowBlurPanel(false);
      }
    });

    // Explicit dblclick handler to ensure consistent behavior
    canvas.on('mouse:dblclick', (evt: any) => {
      const target = evt?.target;
      if (target && target instanceof (FabricImage as any)) {
        setSelectedImage(target as FabricImage);
        setShowTopToolbar(true);
        positionTopToolbar(null, canvas);
        setShowEditPanel(false);
        setShowAIEditPanel(false);
        setShowOpacityPanel(false);
        setShowBlurPanel(false);
      }
    });

    setFabricCanvas(canvas);

    const handleResize = () => {
      const parent = canvasRef.current?.parentElement;
      const width = parent?.clientWidth || window.innerWidth;
      const height = parent?.clientHeight || window.innerHeight;
      canvas.setWidth(width);
      canvas.setHeight(height);
      canvas.renderAll();
      if (showTopToolbar) {
        positionTopToolbar(null, canvas);
      }
    };

    const ro = new ResizeObserver(() => handleResize());
    if (canvasRef.current?.parentElement) ro.observe(canvasRef.current.parentElement);

    window.addEventListener('resize', handleResize);

    return () => {
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

  // Apply tool mode to canvas behavior and cursors
  useEffect(() => {
    if (!fabricCanvas) return;
    const isPointer = activeTool === 'pointer';
    const isShapeTool = activeToolbarButton === 'shape';
    
    // Set cursor based on active tool
    if (isShapeTool) {
      fabricCanvas.defaultCursor = 'crosshair';
      fabricCanvas.hoverCursor = 'crosshair';
    } else {
      fabricCanvas.defaultCursor = isPointer ? 'default' : 'grab';
      fabricCanvas.hoverCursor = isPointer ? 'move' : 'grab';
    }
    
    fabricCanvas.selection = isPointer && !isShapeTool;
    fabricCanvas.skipTargetFind = !isPointer || isShapeTool;
    
    if (!isPointer) {
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      setSelectedImage(null);
      setShowTopToolbar(false);
      setShowEditPanel(false);
      setShowAIEditPanel(false);
      setShowOpacityPanel(false);
      setShowBlurPanel(false);
    }
  }, [activeTool, activeToolbarButton, fabricCanvas]);

  const handleAddActiveShape = () => {
    if (activeShape === 'rect') return handleAddRect();
    if (activeShape === 'circle') return handleAddCircle();
    return handleAddLine();
  };

  // Helper function to update edit panel position (adjacent to image)
  const updateEditPanelPosition = (obj: any, canvas: FabricCanvas) => {
    const objBounds = obj.getBoundingRect();
    const canvasElement = canvas.getElement();
    const canvasRect = canvasElement.getBoundingClientRect();
    const panelWidth = 320; // matches w-80
    const gap = 0;

    const objectRight = canvasRect.left + objBounds.left + objBounds.width;
    const objectLeft = canvasRect.left + objBounds.left;
    const availableRight = window.innerWidth - objectRight - 16;

    // Prefer placing the panel to the right of the image; if not enough space, place to the left
    const canPlaceRight = availableRight >= panelWidth + gap;
    const left = canPlaceRight
      ? objectRight + gap
      : Math.max(16, objectLeft - panelWidth - gap);

    const top = canvasRect.top + objBounds.top; // align to object top
    
    setEditPanelPosition({
      x: left,
      y: top,
    });
  };

  // Position top toolbar fixed at top center of the canvas
  const positionTopToolbar = (_obj: any, canvas: FabricCanvas) => {
    const canvasElement = canvas.getElement();
    const canvasRect = canvasElement.getBoundingClientRect();
    const containerRect = canvasElement.parentElement?.getBoundingClientRect() || canvasRect;
    const toolbarWidth = 280;
    // Center relative to the canvas container, not the viewport
    const centeredLeft = containerRect.width / 2 - toolbarWidth / 2;
    const left = Math.max(16, Math.min(centeredLeft, containerRect.width - toolbarWidth - 16));
    // Pin near the top inside the container
    const top = 12;
    setTopToolbarPosition({ x: left, y: top });
    if (showEditPanel) {
      setEditPanelPosition({ x: left, y: top + 40 + 8 });
    }
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

      img.set({
        left: (fabricCanvas.width! - img.getScaledWidth()) / 2,
        top: (fabricCanvas.height! - img.getScaledHeight()) / 2,
        selectable: true,
      });

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
      
      setSelectedImage(img);
      updateEditPanelPosition(img, fabricCanvas);
      
      toast.success("Image added to canvas");
    }).catch((error) => {
      console.error("Error loading image:", error);
      toast.error("Failed to load image");
    });
  }, [generatedImageUrl, fabricCanvas]);

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

  // Opacity control
  const handleOpacityChange = (value: number) => {
    if (!selectedImage || !fabricCanvas) return;
    selectedImage.set({ opacity: value });
    fabricCanvas.renderAll();
  };

  // Blur control via filters
  const handleBlurChange = (value: number) => {
    handleFilterChange('blur', value);
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
    const textbox = new FabricTextbox("Text", {
      fontSize: 32,
      fill: '#111827',
      editable: true,
    });
    const { left, top } = centerCoords(200, 40);
    textbox.set({ left, top });
    fabricCanvas.add(textbox);
    fabricCanvas.setActiveObject(textbox);
    fabricCanvas.renderAll();
  };

  const handleAddRect = () => {
    if (!fabricCanvas) return;
    const rect = new FabricRect({
      width: 200,
      height: 120,
      fill: 'rgba(0,0,0,0)',
      stroke: '#111827',
      strokeWidth: 2,
      rx: 8,
      ry: 8,
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
      fill: 'rgba(0,0,0,0)',
      stroke: '#111827',
      strokeWidth: 2,
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
    });
    fabricCanvas.add(line);
    fabricCanvas.setActiveObject(line);
    fabricCanvas.renderAll();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
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

      img.set({
        left: (fabricCanvas.width! - img.getScaledWidth()) / 2,
        top: (fabricCanvas.height! - img.getScaledHeight()) / 2,
        selectable: true,
      });

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();

      setSelectedImage(img);
      updateEditPanelPosition(img, fabricCanvas);
      toast.success("Image uploaded onto canvas");
    }).catch(() => {
      toast.error("Failed to upload image");
    }).finally(() => {
      URL.revokeObjectURL(url);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  const handleDownload = () => {
    if (!fabricCanvas) return;

    // Ensure exported image has a white background even though the editor shows a grid
    const originalBg = fabricCanvas.backgroundColor as string | undefined;
    (fabricCanvas as any).backgroundColor = '#ffffff';
    fabricCanvas.renderAll();
    fabricCanvas.renderAll();

    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });

    const link = document.createElement('a');
    link.download = `frame-creation-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    
    // Restore original background (transparent for grid visibility)
    (fabricCanvas as any).backgroundColor = (originalBg as string | undefined) || 'transparent';
    fabricCanvas.renderAll();
    fabricCanvas.renderAll();
    
    toast.success("Canvas downloaded!");
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
      setShowAIEditPanel(false);
    }).catch((error) => {
      console.error("Error loading edited image:", error);
      toast.error("Failed to load edited image");
    });
  };

  const handleNewProject = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = initialCanvasColor;
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
      return "Canvas not ready";
    }

    try {
      // Get current canvas state
      const objects = fabricCanvas.getObjects().map((obj, idx) => ({
        id: `obj_${idx}`,
        type: obj.type,
        left: obj.left || 0,
        top: obj.top || 0,
        width: obj.width || 0,
        height: obj.height || 0,
        scaleX: obj.scaleX || 1,
        scaleY: obj.scaleY || 1,
      }));

      const canvasState = {
        objects,
        canvasWidth: fabricCanvas.width || 0,
        canvasHeight: fabricCanvas.height || 0,
      };

      const res = await fetch('/api/canvas-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, canvasState })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Execute actions using executor and push inverse for undo
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
          // Clear redo on new action
          redoStackRef.current = [];
          setHistoryAvailability();
        }
      }

      return data?.message || "Done";
    } catch (error) {
      console.error('Canvas command error:', error);
      throw error;
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

  // Hotkeys for undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      const meta = e.metaKey || e.ctrlKey;
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

  // Expose undo/redo handlers via history ref
  useEffect(() => {
    if (onCanvasHistoryRef) {
      onCanvasHistoryRef.current = { undo: handleUndo, redo: handleRedo };
    }
  }, [onCanvasHistoryRef, fabricCanvas]);

  const handleCanvasColorChange = (color: string) => {
    if (!fabricCanvas) return;
    fabricCanvas.backgroundColor = color;
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
    <div className="relative w-full h-screen overflow-hidden bg-[#f5f5f5]">
      <canvas ref={canvasRef} className="absolute inset-0 cursor-default" />
      
      {/* Guide Lines Overlay */}
      {fabricCanvas && (() => {
        const vpt = fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0];
        const zoom = Math.sqrt(vpt[0] * vpt[0] + vpt[1] * vpt[1]);
        return (
          <svg 
            key={`guide-lines-${viewportVersion}`}
            className="absolute inset-0 pointer-events-none" 
            width={fabricCanvas.width} 
            height={fabricCanvas.height}
            style={{
              transform: `matrix(${vpt.join(',')})`,
              transformOrigin: '0 0'
            }}
          >
            {guideLines.map((guide: { x?: number; y?: number; vertical?: boolean; snapX?: number; snapY?: number }, index: number) => (
              guide.vertical && guide.x !== undefined ? (
                <g key={`vertical-${index}`}>
                  <line
                    x1={guide.x}
                    y1={0}
                    x2={guide.x}
                    y2={fabricCanvas.height}
                    stroke="#FF6B35"
                    strokeWidth={1 / zoom}
                  />
                  {/* Top marker */}
                  <line x1={guide.x - 3 / zoom} y1={0} x2={guide.x + 3 / zoom} y2={0} stroke="#FF6B35" strokeWidth={1 / zoom} />
                  <line x1={guide.x} y1={-3 / zoom} x2={guide.x} y2={3 / zoom} stroke="#FF6B35" strokeWidth={1 / zoom} />
                  {/* Bottom marker */}
                  <line x1={guide.x - 3 / zoom} y1={fabricCanvas.height} x2={guide.x + 3 / zoom} y2={fabricCanvas.height} stroke="#FF6B35" strokeWidth={1 / zoom} />
                  <line x1={guide.x} y1={fabricCanvas.height - 3 / zoom} x2={guide.x} y2={fabricCanvas.height + 3 / zoom} stroke="#FF6B35" strokeWidth={1 / zoom} />
                  {/* Cross marker at snap point */}
                  {guide.snapY !== undefined && (
                    <>
                      <line x1={guide.x - 6 / zoom} y1={guide.snapY} x2={guide.x + 6 / zoom} y2={guide.snapY} stroke="#FF6B35" strokeWidth={1 / zoom} />
                      <line x1={guide.x} y1={guide.snapY - 6 / zoom} x2={guide.x} y2={guide.snapY + 6 / zoom} stroke="#FF6B35" strokeWidth={1 / zoom} />
                    </>
                  )}
                </g>
              ) : !guide.vertical && guide.y !== undefined ? (
                <g key={`horizontal-${index}`}>
                  <line
                    x1={-200}
                    y1={guide.y}
                    x2={fabricCanvas.width - 200}
                    y2={guide.y}
                    stroke="#FF6B35"
                    strokeWidth={1 / zoom}
                  />
                  {/* Left marker */}
                  <line x1={-200} y1={guide.y - 3 / zoom} x2={-200} y2={guide.y + 3 / zoom} stroke="#FF6B35" strokeWidth={1 / zoom} />
                  <line x1={-200 - 3 / zoom} y1={guide.y} x2={-200 + 3 / zoom} y2={guide.y} stroke="#FF6B35" strokeWidth={1 / zoom} />
                  {/* Right marker */}
                  <line x1={fabricCanvas.width - 200} y1={guide.y - 3 / zoom} x2={fabricCanvas.width - 200} y2={guide.y + 3 / zoom} stroke="#FF6B35" strokeWidth={1 / zoom} />
                  <line x1={fabricCanvas.width - 200 - 3 / zoom} y1={guide.y} x2={fabricCanvas.width - 200 + 3 / zoom} y2={guide.y} stroke="#FF6B35" strokeWidth={1 / zoom} />
                  {/* Cross marker at snap point */}
                  {guide.snapX !== undefined && (
                    <>
                      <line x1={guide.snapX} y1={guide.y - 6 / zoom} x2={guide.snapX} y2={guide.y + 6 / zoom} stroke="#FF6B35" strokeWidth={1 / zoom} />
                      <line x1={guide.snapX - 6 / zoom} y1={guide.y} x2={guide.snapX + 6 / zoom} y2={guide.y} stroke="#FF6B35" strokeWidth={1 / zoom} />
                    </>
                  )}
                </g>
              ) : null
            ))}
          </svg>
        );
      })()}
      
      {/* Top Floating Toolbar (shows on image double-click) */}
      {selectedImage && showTopToolbar && (
        <div
          className="absolute z-50 bg-[hsl(var(--toolbar-bg))] border border-border rounded-xl shadow-[0_4px_12px_hsl(var(--shadow-medium))] px-2 py-1 flex items-center gap-1"
          style={{ left: `${topToolbarPosition.x}px`, top: `${topToolbarPosition.y}px`, width: 280, height: 40 }}
        >
          {/* AI Edit */}
          <Button
            variant="default"
            size="sm"
            className={`h-8 px-3 rounded-lg flex items-center gap-1.5 ${
              showAIEditPanel ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : ''
            }`}
            onClick={() => {
              setShowAIEditPanel(true);
              setShowEditPanel(false);
              setShowOpacityPanel(false);
              setShowBlurPanel(false);
            }}
            title="AI Edit"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span className="text-xs">Edit</span>
          </Button>

          {/* Adjustments */}
          <Button
            variant="secondary"
            size="sm"
            className={`h-8 px-2 rounded-lg flex items-center gap-1 ${
              showEditPanel ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : ''
            }`}
            onClick={() => {
              const willShow = !showEditPanel;
              setShowEditPanel(willShow);
              setShowAIEditPanel(false);
              setShowOpacityPanel(false);
              setShowBlurPanel(false);
              if (willShow) {
                setEditPanelPosition({ x: topToolbarPosition.x, y: topToolbarPosition.y + 40 + 8 });
              }
            }}
            title="Adjustments"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Button>

          {/* Opacity */}
          <Button
            variant="outline"
            size="sm"
            className={`h-8 px-2 rounded-lg ${
              showOpacityPanel ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : ''
            }`}
            onClick={() => {
              setShowOpacityPanel((v) => !v);
              setShowEditPanel(false);
              setShowBlurPanel(false);
            }}
            title="Opacity"
          >
            <Droplet className="w-4 h-4" />
          </Button>

          {/* Blur */}
          <Button
            variant="outline"
            size="sm"
            className={`h-8 px-2 rounded-lg ${
              showBlurPanel ? 'text-[hsl(var(--sidebar-ring))] bg-[hsl(var(--sidebar-ring)/0.12)]' : ''
            }`}
            onClick={() => {
              setShowBlurPanel((v) => !v);
              setShowEditPanel(false);
              setShowOpacityPanel(false);
            }}
            title="Blur"
          >
            <Filter className="w-4 h-4" />
          </Button>

          {/* Crop */}
          {!isCropping && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 rounded-lg"
              onClick={startCrop}
              title="Crop"
            >
              <Crop className="w-4 h-4" />
            </Button>
          )}
          {isCropping && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2 rounded-lg"
                onClick={applyCrop}
                title="Apply Crop"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 rounded-lg"
                onClick={cancelCrop}
                title="Cancel Crop"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Delete */}
          <Button
            variant="destructive"
            size="sm"
            className="h-8 px-2 rounded-lg"
            onClick={() => {
              if (!fabricCanvas || !selectedImage) return;
              fabricCanvas.remove(selectedImage);
              setSelectedImage(null);
              setShowTopToolbar(false);
              setShowEditPanel(false);
              setShowAIEditPanel(false);
              setShowOpacityPanel(false);
              setShowBlurPanel(false);
              fabricCanvas.renderAll();
            }}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* AI Edit Panel */}
      {selectedImage && showAIEditPanel && (
        <EditImagePanel
          position={editPanelPosition}
          imageElement={selectedImage.getElement() as HTMLImageElement}
          onEditComplete={handleEditComplete}
          onClose={() => setShowAIEditPanel(false)}
        />
      )}

      {/* Opacity Panel */}
      {selectedImage && showTopToolbar && showOpacityPanel && (
        <div
          className="absolute z-50 mt-2 bg-background border border-border rounded-xl shadow p-3 w-56"
          style={{ left: `${topToolbarPosition.x}px`, top: `${topToolbarPosition.y + 40 + 8}px` }}
        >
          <div className="flex items-center justify-between mb-2 text-xs">
            <span>Opacity</span>
            <span>{Math.round((selectedImage?.opacity ?? 1) * 100)}%</span>
          </div>
          <Slider
            value={[selectedImage?.opacity ?? 1]}
            onValueChange={([v]) => handleOpacityChange(v)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>
      )}

      {/* Blur Panel */}
      {selectedImage && showTopToolbar && showBlurPanel && (
        <div
          className="absolute z-50 mt-2 bg-background border border-border rounded-xl shadow p-3 w-56"
          style={{ left: `${topToolbarPosition.x}px`, top: `${topToolbarPosition.y + 40 + 8}px` }}
        >
          <div className="flex items-center justify-between mb-2 text-xs">
            <span>Blur</span>
            <span>{imageFilters.blur.toFixed(2)}</span>
          </div>
          <Slider
            value={[imageFilters.blur]}
            onValueChange={([v]) => handleBlurChange(v)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>
      )}

      {/* Left Toolbar (Vertical layout) */}
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
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        onUploadClick={handleUploadClick}
      />
      
      {/* Adjustments Panel (compact) */}
      {selectedImage && showTopToolbar && showEditPanel && (
        <ImageEditPanel
          position={editPanelPosition}
          filters={imageFilters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          compact
        />
      )}
      
      {/* (Removed old Bottom Action Bar; consolidated into Bottom Toolbar above) */}
    </div>
    {/* Inspector Sidebar (shows when any object is selected) */}
    {selectedObject && (
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
            setIsSidebarClosing(false);
          }, 300);
        }}
      />
    )}
    </>
  );
}
