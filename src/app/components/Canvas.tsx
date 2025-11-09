'use client';

import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Image as FabricImage, Textbox as FabricTextbox, Rect as FabricRect, Circle as FabricCircle, Line as FabricLine, filters, Point, Object as FabricObject, Group as FabricGroup, ActiveSelection as FabricActiveSelection } from "fabric";
import { Button } from "@/app/components/ui/button";
import { Download, RotateCcw, ImagePlus, Crop, Trash2, Save, Share, Layers as LayersIcon, Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from "lucide-react";
import { toast } from "sonner";
import { InspectorSidebar } from "@/app/components/InspectorSidebar";
import { Toolbar } from "@/app/components/Toolbar";
// use local Next.js API route for canvas commands
import { executeActions } from "@/app/lib/agent/executor";
import type { AgentAction } from "@/app/lib/agent/canvas-schema";
import LayersPanel from "@/app/components/LayersPanel";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/app/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { Label } from "@/app/components/ui/label";

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

export default function Canvas({ generatedImageUrl, onClear, onCanvasCommandRef, onCanvasHistoryRef, onHistoryAvailableChange, onCanvasExportRef, onCanvasColorRef, initialCanvasColor = "#F4F4F6" }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const isPanningRef = useRef(false);
  const [activeTool, setActiveTool] = useState<"pointer" | "hand">("pointer");
  const activeToolRef = useRef<"pointer" | "hand">("pointer");
  const activeToolbarButtonRef = useRef<'pointer' | 'hand' | 'text' | 'shape' | 'upload' | 'reference' | 'selector' | 'artboard' | 'pen' | 'colorPicker' | 'brush' | 'move' | 'layers' | 'grid' | 'ruler' | 'eraser' | 'eye' | 'zoomIn' | 'zoomOut'>('pointer');
  const [activeShape, setActiveShape] = useState<"rect" | "circle" | "line">("circle");
  const activeShapeRef = useRef<"rect" | "circle" | "line">("circle");
  const [activeToolbarButton, setActiveToolbarButton] = useState<
    'pointer' | 'hand' | 'text' | 'shape' | 'upload' | 'reference' | 'selector' | 'artboard' | 'pen' | 'colorPicker' | 'brush' | 'move' | 'layers' | 'grid' | 'ruler' | 'eraser' | 'eye' | 'zoomIn' | 'zoomOut'
  >('pointer');
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [isSidebarClosing, setIsSidebarClosing] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg'>('png');
  const [exportType, setExportType] = useState<'canvas' | 'artboard'>('canvas');
  const isDrawingShapeRef = useRef(false);
  const isDrawingTextRef = useRef(false);
  const isDrawingArtboardRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawingShapeRef = useRef<FabricRect | FabricCircle | FabricLine | null>(null);
  const drawingArtboardRef = useRef<FabricRect | null>(null);
  const drawingTextBoxRef = useRef<FabricRect | null>(null);
  const drawingTextLabelRef = useRef<FabricTextbox | null>(null);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const setHistoryAvailability = () => {
    if (onHistoryAvailableChange) {
      onHistoryAvailableChange((undoStackRef.current?.length || 0) > 0);
    }
  };
  const undoStackRef = useRef<AgentAction[][]>([]);
  const redoStackRef = useRef<AgentAction[][]>([]);


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
        }
        
        canvas.renderAll();
      }
    });
    canvas.on('mouse:up', () => {
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
      }
    });

    canvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0];
      if (obj && obj instanceof (FabricImage as any)) {
        setSelectedImage(obj as FabricImage);
      }
    });

    canvas.on('selection:cleared', () => {
      setSelectedImage(null);
    });


    setFabricCanvas(canvas);

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
    const isArtboardTool = activeToolbarButton === 'artboard';
    if (isShapeTool || isArtboardTool) {
      fabricCanvas.defaultCursor = 'crosshair';
      fabricCanvas.hoverCursor = 'crosshair';
    } else {
      fabricCanvas.defaultCursor = isPointer ? 'default' : 'grab';
      fabricCanvas.hoverCursor = isPointer ? 'move' : 'grab';
    }
    
    fabricCanvas.selection = isPointer && !isShapeTool && !isArtboardTool;
    fabricCanvas.skipTargetFind = !isPointer || isShapeTool || isArtboardTool;
    
    if (!isPointer) {
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      setSelectedImage(null);
    }
  }, [activeTool, activeToolbarButton, fabricCanvas]);

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

      img.set({
        left: (fabricCanvas.width! - img.getScaledWidth()) / 2,
        top: (fabricCanvas.height! - img.getScaledHeight()) / 2,
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
        name: 'Image',
      });

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();

      setSelectedImage(img);
      toast.success("Image uploaded onto canvas");
    }).catch(() => {
      toast.error("Failed to upload image");
    }).finally(() => {
      URL.revokeObjectURL(url);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  const handleExport = (format: 'png' | 'jpg', exportType: 'canvas' | 'artboard') => {
    if (!fabricCanvas) return;

    let dataURL: string;
    let filename: string;
    const timestamp = Date.now();
    const multiplier = 4; // Ultra high quality export (4x resolution)

    if (exportType === 'artboard') {
      // Export artboard with all objects on it
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
      
      // Get artboard bounding box
      const artboardBounds = artboard.getBoundingRect();
      
      // Use Fabric's built-in cropping to export just the artboard region
      // This includes everything rendered within that region
      try {
        // Store original background
        const originalBg = fabricCanvas.backgroundColor as string | undefined;
        
        // Temporarily set white background if needed
        if (!originalBg || originalBg === 'transparent') {
          fabricCanvas.backgroundColor = '#ffffff';
          fabricCanvas.renderAll();
        }
        
        // Export the cropped region with ultra high quality
        dataURL = fabricCanvas.toDataURL({
          format: format === 'jpg' ? 'jpeg' : 'png',
          quality: 1, // Maximum quality for both PNG and JPG
          multiplier: multiplier, // 4x resolution
          left: artboardBounds.left,
          top: artboardBounds.top,
          width: artboardBounds.width,
          height: artboardBounds.height,
        });
        
        filename = `artboard-export-${timestamp}.${format === 'jpg' ? 'jpg' : 'png'}`;
        
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataURL;
        link.click();
        
        // Restore original background
        fabricCanvas.backgroundColor = originalBg || 'transparent';
        fabricCanvas.renderAll();
        
        toast.success("Artboard exported!");
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

  const handleExportClick = () => {
    setIsExportDialogOpen(true);
  };

  const handleExportConfirm = () => {
    handleExport(exportFormat, exportType);
    setIsExportDialogOpen(false);
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative w-full h-screen overflow-hidden bg-[#F4F4F6]">
          <canvas ref={canvasRef} className="absolute inset-0 cursor-default" />
          
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
            leftOffset={isLayersOpen ? 272 : 8}
          />

          {/* Layers floating button */}
          <div className="pointer-events-auto fixed bottom-4 left-2 z-[60]">
            <button
              type="button"
              onClick={() => setIsLayersOpen((o) => !o)}
              aria-label="Layers"
              className="w-12 h-12 rounded-full bg-white text-[#111827] shadow-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] flex items-center justify-center transition-colors"
            >
              <LayersIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Layers sidebar (always mounted for slide animation) */}
          {fabricCanvas && (
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
        onImageEdit={handleEditComplete}
      />
    )}

    {/* Export Dialog */}
    <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Choose export format and what to export
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Format Selection */}
          <div className="grid gap-3">
            <Label className="text-sm font-medium">Format</Label>
            <RadioGroup value={exportFormat} onValueChange={(value) => setExportFormat(value as 'png' | 'jpg')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="png" id="png" />
                <Label htmlFor="png" className="font-normal cursor-pointer">PNG (High Quality)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="jpg" id="jpg" />
                <Label htmlFor="jpg" className="font-normal cursor-pointer">JPG/JPEG (Compressed)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Export Type Selection */}
          <div className="grid gap-3">
            <Label className="text-sm font-medium">Export</Label>
            <RadioGroup value={exportType} onValueChange={(value) => setExportType(value as 'canvas' | 'artboard')}>
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
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
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
