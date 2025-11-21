import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { FabricImage, FabricObject, Rect as FabricRect } from "fabric";
import { Button } from "@/app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { toast } from "sonner";
import { Brush, Eraser, Loader2, Check, X } from "lucide-react";

const BRUSH_CURSOR =
  'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAxOCAxOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSI5IiBjeT0iOSIgcj0iNyIgc3Ryb2tlPSIjMTk2NkZGIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9IiNCMENGRkYiIGZpbGwtb3BhY2l0eT0iMC45Ii8+PC9zdmc+") 4 4, crosshair';

type ToolKey =
  | "crop"
  | "quickFx"
  | "adjustments"
  | "removeBackground"
  | "creativeDirector"
  | "promptRemixer"
  | "styleTransfer"
  | "sceneReimagine"
  | "smartEdit"
  | "upscale"
  | null;

interface AdjustmentsValues {
  brightness: number;
  contrast: number;
  saturation: number;
  highlights: number;
  shadows: number;
  exposure: number;
  vibrance: number;
  blur: number;
  noise: number;
  pixelate: number;
  sepia: number;
  vintage: number;
  opacity: number;
}

interface AdjustmentsSetters {
  setBrightness: (v: number) => void;
  setContrast: (v: number) => void;
  setSaturation: (v: number) => void;
  setHighlights: (v: number) => void;
  setShadows: (v: number) => void;
  setExposure: (v: number) => void;
  setVibrance: (v: number) => void;
  setBlur: (v: number) => void;
  setNoise: (v: number) => void;
  setPixelate: (v: number) => void;
  setSepia: (v: number) => void;
  setVintage: (v: number) => void;
  setOpacity: (v: number) => void;
}

interface EditSpaceProps {
  tool: ToolKey;
  isImage: boolean;
  cropRatio: string;
  handleCropRatioChange: (ratio: string) => void;
  adjustments: AdjustmentsValues & AdjustmentsSetters;
  selectedObject: FabricObject | null;
  canvas: any;
  onImageEdit?: (newImageUrl: string) => void;
  onSmartEditSelectionChange?: (selection: {
    type: "rectangle";
    imageSize: { width: number; height: number };
    rect: { x: number; y: number; width: number; height: number };
    normalized: { x: number; y: number; width: number; height: number };
  } | null) => void;
  removeBgMode?: "quick" | "select";
  removeBgPreview?: string | null;
  onApplyRemoveBg?: () => void;
  onCancelRemoveBg?: () => void;
  isRemoveBgProcessing?: boolean;
  removeBgMask?: string | null;
  onRemoveBgMaskChange?: (mask: string | null) => void;
}

export function EditSpace({
  tool,
  isImage,
  cropRatio,
  handleCropRatioChange,
  adjustments,
  selectedObject,
  canvas,
  onImageEdit,
  onSmartEditSelectionChange,
  removeBgMode = "quick",
  removeBgPreview,
  onApplyRemoveBg,
  onCancelRemoveBg,
  isRemoveBgProcessing = false,
  removeBgMask,
  onRemoveBgMaskChange
}: EditSpaceProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const imgElement = useMemo(() => {
    if (!mounted) return null;
    try {
      // If a FabricImage is selected, use it
      if (selectedObject && typeof (selectedObject as any).getElement === 'function') {
        return (selectedObject as any).getElement() as HTMLImageElement;
      }
      // If canvas has an active object that's an image
      if (canvas && typeof canvas.getActiveObject === 'function') {
        const active = canvas.getActiveObject?.();
        if (active && typeof (active as any).getElement === 'function') {
          return (active as any).getElement() as HTMLImageElement;
        }
      }
      // Otherwise, search all canvas objects for the first image-like object
      if (canvas && typeof canvas.getObjects === 'function') {
        const objs: any[] = canvas.getObjects();
        const firstImg = objs.find((o) => (o && (typeof o.getElement === 'function' || o?.type === 'image')));
        if (firstImg) {
          if (typeof firstImg.getElement === 'function') {
            return firstImg.getElement() as HTMLImageElement;
          }
          // Fallback to internal element if exposed
          if (firstImg._element instanceof HTMLImageElement) {
            return firstImg._element as HTMLImageElement;
          }
        }
      }
    } catch {
      // ignore and return null
    }
    return null;
  }, [mounted, selectedObject, canvas]);

  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const skipMaskSyncRef = useRef(false);

  const clearMaskCanvas = useCallback(
    (notifyParent: boolean = true) => {
      const canvasEl = maskCanvasRef.current;
      if (canvasEl) {
        const ctx = canvasEl.getContext("2d");
        ctx?.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }
      if (notifyParent) {
        skipMaskSyncRef.current = true;
        onRemoveBgMaskChange?.(null);
      }
    },
    [onRemoveBgMaskChange]
  );

  useEffect(() => {
    if (removeBgMode !== "select") {
      clearMaskCanvas(false);
    }
  }, [removeBgMode, clearMaskCanvas]);

  useEffect(() => {
    if (skipMaskSyncRef.current) {
      skipMaskSyncRef.current = false;
      return;
    }
    if (!removeBgMask) {
      clearMaskCanvas(false);
      return;
    }
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, maskCanvasRef.current!.width, maskCanvasRef.current!.height);
      ctx.drawImage(img, 0, 0, maskCanvasRef.current!.width, maskCanvasRef.current!.height);
    };
    img.src = removeBgMask;
  }, [removeBgMask, clearMaskCanvas]);

  const commitMaskCanvas = useCallback(() => {
    if (!maskCanvasRef.current) return;
    skipMaskSyncRef.current = true;
    onRemoveBgMaskChange?.(maskCanvasRef.current.toDataURL("image/png"));
  }, [onRemoveBgMaskChange]);

  // Crop preview state
  const [cropPreviewSrc, setCropPreviewSrc] = useState<string>("");
  const cropContainerRef = useRef<HTMLDivElement | null>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const [selCenter, setSelCenter] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [isDragging, setIsDragging] = useState(false);

  // Smart Edit selection state
  const smartContainerRef = useRef<HTMLDivElement | null>(null);
  const smartImgRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const overlayRectRef = useRef<any | null>(null);
  const [selectionPreviewSrc, setSelectionPreviewSrc] = useState<string>("");

  // Reset selection when tool changes away from smartEdit
  useEffect(() => {
    if (tool !== "smartEdit") {
      setIsDrawing(false);
      setDrawRect(null);
      drawStartRef.current = null;
      onSmartEditSelectionChange?.(null);
      try {
        if (canvas && overlayRectRef.current) {
          canvas.remove(overlayRectRef.current);
          overlayRectRef.current = null;
          canvas.requestRenderAll?.();
        }
      } catch {}
    }
  }, [tool, onSmartEditSelectionChange]);

  useEffect(() => {
    if (
      tool !== "removeBackground" ||
      removeBgMode !== "select" ||
      removeBgPreview ||
      !canvas ||
      !selectedObject ||
      !(selectedObject instanceof FabricImage) ||
      !imgElement
    ) {
      return;
    }

    const imgObj = selectedObject as FabricImage;
    const naturalWidth = imgElement.naturalWidth || imgObj.width || 0;
    const naturalHeight = imgElement.naturalHeight || imgObj.height || 0;
    if (!naturalWidth || !naturalHeight) return;

    if (!maskCanvasRef.current) {
      maskCanvasRef.current = document.createElement("canvas");
    }
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas.width !== naturalWidth || maskCanvas.height !== naturalHeight) {
      maskCanvas.width = naturalWidth;
      maskCanvas.height = naturalHeight;
    }
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(37, 99, 235, 0.95)";
    ctx.lineWidth = Math.max(6, naturalWidth * 0.012);
    ctx.globalCompositeOperation = "source-over";

    const prevSelection = canvas.selection;
    const prevSkip = canvas.skipTargetFind;
    const prevDefaultCursor = canvas.defaultCursor;
    const prevHoverCursor = canvas.hoverCursor;
    const prevMoveCursor = (canvas as any).moveCursor;

    canvas.selection = false;
    canvas.skipTargetFind = true;
    canvas.defaultCursor = BRUSH_CURSOR;
    canvas.hoverCursor = BRUSH_CURSOR;
    (canvas as any).moveCursor = BRUSH_CURSOR;

    let isPainting = false;
    let lastPoint: { x: number; y: number } | null = null;

    const pointerToImage = (pointer: { x: number; y: number }) => {
      const bounds = imgObj.getBoundingRect();
      const within =
        pointer.x >= bounds.left &&
        pointer.x <= bounds.left + bounds.width &&
        pointer.y >= bounds.top &&
        pointer.y <= bounds.top + bounds.height;
      if (!within) return null;
      const normalizedX = (pointer.x - bounds.left) / bounds.width;
      const normalizedY = (pointer.y - bounds.top) / bounds.height;
      const cropWidth = imgObj.width || naturalWidth;
      const cropHeight = imgObj.height || naturalHeight;
      const cropX = imgObj.cropX || 0;
      const cropY = imgObj.cropY || 0;
      const x = Math.max(0, Math.min(naturalWidth, cropX + normalizedX * cropWidth));
      const y = Math.max(0, Math.min(naturalHeight, cropY + normalizedY * cropHeight));
      return { x, y };
    };

    const strokeTo = (point: { x: number; y: number }) => {
      ctx.beginPath();
      if (lastPoint) {
        ctx.moveTo(lastPoint.x, lastPoint.y);
      } else {
        ctx.moveTo(point.x, point.y);
      }
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPoint = point;
    };

    const handleMouseDown = (opt: any) => {
      const pointer = canvas.getPointer(opt.e);
      const point = pointerToImage(pointer);
      if (!point) return;
      isPainting = true;
      strokeTo(point);
    };

    const handleMouseMove = (opt: any) => {
      if (!isPainting) return;
      const pointer = canvas.getPointer(opt.e);
      const point = pointerToImage(pointer);
      if (!point) return;
      strokeTo(point);
    };

    const finishStroke = () => {
      if (!isPainting) return;
      isPainting = false;
      lastPoint = null;
      commitMaskCanvas();
    };

    const handleMouseUp = () => finishStroke();
    const handleMouseOut = () => finishStroke();

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);
    canvas.on("mouse:out", handleMouseOut);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
      canvas.off("mouse:out", handleMouseOut);
      canvas.selection = prevSelection;
      canvas.skipTargetFind = prevSkip;
      canvas.defaultCursor = prevDefaultCursor;
      canvas.hoverCursor = prevHoverCursor;
      (canvas as any).moveCursor = prevMoveCursor;
    };
  }, [
    tool,
    removeBgMode,
    removeBgPreview,
    canvas,
    selectedObject,
    imgElement,
    commitMaskCanvas
  ]);

  // Smart Edit: attach canvas listeners at top-level (guarded by tool)
  useEffect(() => {
    if (tool !== "smartEdit") return;
    if (!canvas || !imgElement || !selectedObject) return;
    const imgObj = (selectedObject as any);
    const prevSelection = canvas.selection;
    const prevSkip = canvas.skipTargetFind;
    const prevDefaultCursor = canvas.defaultCursor;
    const prevHoverCursor = canvas.hoverCursor;
    const prevMoveCursor = (canvas as any).moveCursor || 'move';
    const prevObjHoverCursor = imgObj.hoverCursor || undefined;
    const prevObjMoveCursor = imgObj.moveCursor || undefined;
    const prevSmartFlag = (canvas as any).__smartEditActive || false;
    const prevLockX = !!imgObj.lockMovementX;
    const prevLockY = !!imgObj.lockMovementY;
    const prevHasControls = !!imgObj.hasControls;

    // Mark canvas in Smart Edit mode (Canvas.tsx will respect this)
    (canvas as any).__smartEditActive = true;
    canvas.selection = false;
    canvas.skipTargetFind = true;
    canvas.defaultCursor = "crosshair";
    canvas.hoverCursor = "crosshair";
    (canvas as any).moveCursor = "crosshair";
    // Ensure image doesn't show move cursor
    imgObj.hoverCursor = "crosshair";
    imgObj.moveCursor = "crosshair";
    // Prevent image from moving or receiving events while selecting
    try {
      imgObj.set({
        lockMovementX: true,
        lockMovementY: true,
        hasControls: false,
      });
      imgObj.setCoords?.();
      canvas.requestRenderAll?.();
    } catch {}

    let isDown = false;
    let startX = 0;
    let startY = 0;

    const onMouseDown = (opt: any) => {
      if (!imgObj || typeof imgObj.getScaledWidth !== "function") return;
      const e = opt.e as MouseEvent;
      const pointer = canvas.getPointer(e);
      const angle = imgObj.angle || 0;
      if (Math.abs(((angle % 360) + 360) % 360) > 0.1) {
        toast.error("Smart Edit selection currently supports unrotated images only.");
        return;
      }
      const imgLeft = imgObj.left || 0;
      const imgTop = imgObj.top || 0;
      const imgRight = imgLeft + imgObj.getScaledWidth();
      const imgBottom = imgTop + imgObj.getScaledHeight();
      if (pointer.x < imgLeft || pointer.x > imgRight || pointer.y < imgTop || pointer.y > imgBottom) {
        return;
      }
      isDown = true;
      startX = Math.min(Math.max(pointer.x, imgLeft), imgRight);
      startY = Math.min(Math.max(pointer.y, imgTop), imgBottom);
      if (!overlayRectRef.current) {
        overlayRectRef.current = new FabricRect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: "rgba(59,130,246,0.12)",
          stroke: "#3B82F6",
          strokeWidth: 1,
          selectable: false,
          evented: false,
          strokeDashArray: [4, 3],
        });
        canvas.add(overlayRectRef.current);
      } else {
        overlayRectRef.current.set({ left: startX, top: startY, width: 0, height: 0 });
      }
      canvas.requestRenderAll();
    };

    const onMouseMove = (opt: any) => {
      if (!isDown || !overlayRectRef.current || !imgObj) return;
      const e = opt.e as MouseEvent;
      const pointer = canvas.getPointer(e);
      const imgLeft = imgObj.left || 0;
      const imgTop = imgObj.top || 0;
      const imgRight = imgLeft + imgObj.getScaledWidth();
      const imgBottom = imgTop + imgObj.getScaledHeight();
      const curX = Math.min(Math.max(pointer.x, imgLeft), imgRight);
      const curY = Math.min(Math.max(pointer.y, imgTop), imgBottom);
      const left = Math.min(startX, curX);
      const top = Math.min(startY, curY);
      const width = Math.abs(curX - startX);
      const height = Math.abs(curY - startY);
      overlayRectRef.current.set({ left, top, width, height });
      canvas.requestRenderAll();
    };

    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;
      if (!imgObj || !overlayRectRef.current) return;
      const rect = overlayRectRef.current;
      const width = rect.width || 0;
      const height = rect.height || 0;
      if (width < 2 || height < 2) return;
      const imgLeft = imgObj.left || 0;
      const imgTop = imgObj.top || 0;
      const scaleX = imgObj.scaleX || 1;
      const scaleY = imgObj.scaleY || 1;
      const naturalW = imgElement.naturalWidth || (imgObj.width || 0);
      const naturalH = imgElement.naturalHeight || (imgObj.height || 0);
      const pxX = Math.max(0, Math.round((rect.left - imgLeft) / scaleX + (imgObj.cropX || 0)));
      const pxY = Math.max(0, Math.round((rect.top - imgTop) / scaleY + (imgObj.cropY || 0)));
      const pxW = Math.max(1, Math.round((width) / scaleX));
      const pxH = Math.max(1, Math.round((height) / scaleY));
      const selection = {
        type: "rectangle" as const,
        imageSize: { width: naturalW, height: naturalH },
        rect: { x: pxX, y: pxY, width: pxW, height: pxH },
        normalized: {
          x: Math.min(1, Math.max(0, pxX / naturalW)),
          y: Math.min(1, Math.max(0, pxY / naturalH)),
          width: Math.min(1, Math.max(0, pxW / naturalW)),
          height: Math.min(1, Math.max(0, pxH / naturalH)),
        },
      };
      onSmartEditSelectionChange?.(selection);
      try {
        const off = document.createElement("canvas");
        off.width = Math.min(1024, selection.rect.width);
        off.height = Math.min(1024, selection.rect.height);
        const ctx = off.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            imgElement,
            selection.rect.x,
            selection.rect.y,
            selection.rect.width,
            selection.rect.height,
            0,
            0,
            off.width,
            off.height
          );
          const url = off.toDataURL("image/png");
          setSelectionPreviewSrc(url);
        }
      } catch {}
    };

    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:up", onMouseUp);

    return () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
      canvas.selection = prevSelection;
      canvas.skipTargetFind = prevSkip;
      canvas.defaultCursor = prevDefaultCursor;
      canvas.hoverCursor = prevHoverCursor;
      (canvas as any).moveCursor = prevMoveCursor;
      (canvas as any).__smartEditActive = prevSmartFlag;
      try {
        if (overlayRectRef.current) {
          canvas.remove(overlayRectRef.current);
          overlayRectRef.current = null;
          canvas.requestRenderAll?.();
        }
        // Restore image interactivity
        imgObj.set({
          lockMovementX: prevLockX,
          lockMovementY: prevLockY,
          hasControls: prevHasControls,
        });
        // restore cursors
        if (prevObjHoverCursor !== undefined) imgObj.hoverCursor = prevObjHoverCursor;
        if (prevObjMoveCursor !== undefined) imgObj.moveCursor = prevObjMoveCursor;
        imgObj.setCoords?.();
        canvas.requestRenderAll?.();
      } catch {}
    };
  }, [tool, canvas, imgElement, selectedObject, onSmartEditSelectionChange]);

  if (!tool) {
    return (
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[32vh]">
        <div className="px-0 py-3 h-full flex flex-col">
          <div className="text-[11px] text-[#9E9E9E] px-3 mb-2">Select a tool to edit here</div>
          <div className="relative flex-1 mx-3 rounded-lg border border-[#E5E5E5]
                          bg-[length:16px_16px]
                          bg-[linear-gradient(to_right,#EDEDED_1px,transparent_1px),linear-gradient(to_bottom,#EDEDED_1px,transparent_1px)]">
            {mounted && imgElement && (
              <img
                src={imgElement.src}
                alt="Selected preview"
                className="absolute inset-0 m-auto max-h-[70%] max-w-[70%] object-contain opacity-90 pointer-events-none"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tool === "removeBackground") {
    const displaySrc = removeBgPreview || imgElement?.src || "";
    return (
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[32vh]">
        <div className="px-0 py-3 h-full flex flex-col">
          <div
            className="relative flex-1 mx-3 rounded-lg border border-[#E5E5E5] bg-[#F8FAFC] overflow-hidden"
          >
            {displaySrc ? (
              <img
                src={displaySrc}
                alt="Background removal preview"
                className="absolute inset-0 w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#F8FAFC_25%,#E2E8F0_25%,#E2E8F0_50%,#F8FAFC_50%,#F8FAFC_75%,#E2E8F0_75%,#E2E8F0)] bg-[length:12px_12px]" />
            )}

            {removeBgMask && !removeBgPreview && (
              <img
                src={removeBgMask}
                alt=""
                className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-screen opacity-60"
              />
            )}

            <div className="absolute top-2 right-2 flex gap-1.5">
              {removeBgMode === "select" && !removeBgPreview && removeBgMask && (
                <button
                  type="button"
                  onClick={() => clearMaskCanvas()}
                  className="w-8 h-8 rounded-full bg-white/85 border border-white text-[#1D4ED8] shadow-sm flex items-center justify-center"
                  aria-label="Clear strokes"
                  title="Clear strokes"
                >
                  <Eraser className="w-3.5 h-3.5" />
                </button>
              )}
              {removeBgMode === "select" && !removeBgPreview && !removeBgMask && (
                <div className="w-8 h-8 rounded-full bg-white/70 border border-white shadow-sm flex items-center justify-center text-[#1D4ED8]">
                  <Brush className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            {isRemoveBgProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-sm z-10">
                <Loader2 className="w-4 h-4 animate-spin text-[#1D4ED8]" />
              </div>
            )}
          </div>

          <div className="px-3 pt-2 flex justify-end gap-1.5">
            {removeBgPreview ? (
              <>
                <Button
                  className="h-8 w-8 rounded-full"
                  size="sm"
                  onClick={() => {
                    onApplyRemoveBg?.();
                    clearMaskCanvas(false);
                  }}
                  aria-label="Apply cutout"
                  title="Apply cutout"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 rounded-full"
                  size="sm"
                  onClick={() => {
                    clearMaskCanvas();
                    onCancelRemoveBg?.();
                  }}
                  aria-label="Cancel preview"
                  title="Cancel preview"
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              removeBgMode === "select" &&
              !removeBgPreview &&
              removeBgMask && (
                <button
                  type="button"
                  onClick={() => clearMaskCanvas()}
                  className="h-8 w-8 rounded-full bg-white/85 border border-white text-[#1D4ED8] shadow-sm flex items-center justify-center"
                  aria-label="Clear strokes"
                  title="Clear strokes"
                >
                  <Eraser className="w-3.5 h-3.5" />
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // Smart Edit: selection happens on canvas; show cropped preview here
  if (tool === "smartEdit") {
    return (
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[32vh]">
        <div className="px-0 py-3 h-full flex flex-col">
          <div className="text-[11px] text-[#9E9E9E] px-3 mb-2">Smart Edit — Selected region preview</div>
          <div className="relative flex-1 mx-3 rounded-lg border border-[#E5E5E5]
                          bg-[length:16px_16px]
                          bg-[linear-gradient(to_right,#EDEDED_1px,transparent_1px),linear-gradient(to_bottom,#EDEDED_1px,transparent_1px)]">
            {selectionPreviewSrc ? (
              <img
                src={selectionPreviewSrc}
                alt="Selection preview"
                className="absolute inset-0 m-auto max-h-[70%] max-w-[70%] object-contain opacity-90 pointer-events-none"
              />
            ) : (
              mounted && imgElement && (
                <div className="absolute inset-0 m-auto h-full w-full flex items-center justify-center text-[11px] text-[#9E9E9E]">
                  Draw a selection on the canvas to preview
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // For all tools except crop and smartEdit, only show the selected image preview (no expanded tool UI)
  if (tool && tool !== "crop") {
    return (
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[32vh]">
        <div className="px-0 py-3 h-full flex flex-col">
          <div className="text-[11px] text-[#9E9E9E] px-3 mb-2">Preview</div>
          <div className="relative flex-1 mx-3 rounded-lg border border-[#E5E5E5]
                          bg-[length:16px_16px]
                          bg-[linear-gradient(to_right,#EDEDED_1px,transparent_1px),linear-gradient(to_bottom,#EDEDED_1px,transparent_1px)]">
            {mounted && imgElement && (
              <img
                src={imgElement.src}
                alt="Selected preview"
                className="absolute inset-0 m-auto max-h-[70%] max-w-[70%] object-contain opacity-90 pointer-events-none"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!isImage) {
    return (
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[32vh]">
        <div className="px-3 py-3 h-full flex items-center">
          <div className="text-[11px] text-[#9E9E9E]">Tools are available for images</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-[#E5E5E5] h-[32vh]">
      <div className="px-3 py-3 space-y-2.5 h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-track]:hidden [&::-webkit-scrollbar-thumb]:hidden">
        {tool === "crop" && (
          <div className="space-y-2.5">
            <div className="text-[12px] font-medium text-[#161616]">Crop</div>
            <div className="flex items-center gap-1.5">
              <Select value={cropRatio} onValueChange={handleCropRatioChange}>
                <SelectTrigger className="h-7 flex-1 text-[11px] border border-[#E5E5E5] bg-white hover:border-[#D1D1D1] focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded text-[#161616]">
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
            <div
              ref={cropContainerRef}
              onMouseDown={(e) => {
                setIsDragging(true);
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onMouseMove={(e) => {
                if (!isDragging || !cropContainerRef.current || !cropImgRef.current) return;
                const rect = cropContainerRef.current.getBoundingClientRect();
                const imgRect = cropImgRef.current.getBoundingClientRect();
                const cx = Math.min(Math.max(e.clientX, imgRect.left), imgRect.right);
                const cy = Math.min(Math.max(e.clientY, imgRect.top), imgRect.bottom);
                const nx = (cx - imgRect.left) / Math.max(1, imgRect.width);
                const ny = (cy - imgRect.top) / Math.max(1, imgRect.height);
                setSelCenter({ x: Math.min(Math.max(nx, 0), 1), y: Math.min(Math.max(ny, 0), 1) });
              }}
              className="relative h-[105px] rounded-lg border border-[#E5E5E5] overflow-hidden bg-[#FAFAFB]"
            >
              {imgElement && (
                <img
                  ref={cropImgRef}
                  src={imgElement.src}
                  alt="Crop source"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                />
              )}
              {/* Selection overlay */}
              <CropSelectionOverlay containerRef={cropContainerRef} imgRef={cropImgRef} selCenter={selCenter} ratio={cropRatio} />
            </div>
            {/* Live Preview */}
            {cropPreviewSrc && (
              <div className="w-full h-16 rounded-md border border-[#E5E5E5] overflow-hidden bg-white">
                <img src={cropPreviewSrc} alt="Crop preview" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="w-full flex items-center justify-center gap-1.5">
              <Button size="sm" className="h-8 w-20 text-[11px] rounded-lg">Crop</Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-20 text-[11px] rounded-lg bg-[#F5F5F5] text-[#5E5E5E] border border-[#E0E0E0] hover:bg-[#EDEDED]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function parseRatio(r: string): { w: number; h: number } {
  if (!r || r === "default") return { w: 1, h: 1 };
  const parts = r.split(":");
  const w = parseFloat(parts[0]);
  const h = parseFloat(parts[1]);
  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return { w: 1, h: 1 };
  return { w, h };
}

function CropSelectionOverlay({
  containerRef,
  imgRef,
  selCenter,
  ratio,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
  selCenter: { x: number; y: number };
  ratio: string;
}) {
  const [rectStyle, setRectStyle] = useState<{ left: number; top: number; width: number; height: number }>({ left: 0, top: 0, width: 0, height: 0 });
  const [previewUpdater, setPreviewUpdater] = useState(0);
  const [previewSrc, setPreviewSrc] = useState<string>("");
  useEffect(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;
    const imgBox = img.getBoundingClientRect();
    const ratioVal = parseRatio(ratio);
    const displayW = imgBox.width;
    const displayH = imgBox.height;
    if (displayW <= 0 || displayH <= 0) return;
    const displayAspect = displayW / displayH;
    const targetAspect = ratioVal.w / ratioVal.h;
    // selection size ~ 65% of shorter dimension
    let selW: number;
    let selH: number;
    if (targetAspect >= 1) {
      // wider than tall
      selW = Math.min(displayW, displayH * targetAspect) * 0.65;
      selH = selW / targetAspect;
    } else {
      selH = Math.min(displayH, displayW / targetAspect) * 0.65;
      selW = selH * targetAspect;
    }
    // center in image box using selCenter
    const cx = imgBox.left + selCenter.x * displayW;
    const cy = imgBox.top + selCenter.y * displayH;
    let left = cx - selW / 2;
    let top = cy - selH / 2;
    // clamp within image box
    if (left < imgBox.left) left = imgBox.left;
    if (top < imgBox.top) top = imgBox.top;
    if (left + selW > imgBox.right) left = imgBox.right - selW;
    if (top + selH > imgBox.bottom) top = imgBox.bottom - selH;
    // convert to container-local coordinates
    const cBox = container.getBoundingClientRect();
    setRectStyle({
      left: left - cBox.left,
      top: top - cBox.top,
      width: selW,
      height: selH,
    });
    // trigger preview update
    setPreviewUpdater((n) => n + 1);
  }, [containerRef, imgRef, selCenter, ratio]);

  // Generate preview and bubble up via CustomEvent on container (so parent can render)
  useEffect(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;
    const imgBox = img.getBoundingClientRect();
    const cBox = container.getBoundingClientRect();
    const scaleX = img.naturalWidth / Math.max(1, imgBox.width);
    const scaleY = img.naturalHeight / Math.max(1, imgBox.height);
    const selXDisp = rectStyle.left;
    const selYDisp = rectStyle.top;
    const selWDisp = rectStyle.width;
    const selHDisp = rectStyle.height;
    // selection in displayed coords relative to imgBox
    const relX = selXDisp - (imgBox.left - cBox.left);
    const relY = selYDisp - (imgBox.top - cBox.top);
    const cropX = Math.max(0, relX * scaleX);
    const cropY = Math.max(0, relY * scaleY);
    const cropW = Math.max(1, selWDisp * scaleX);
    const cropH = Math.max(1, selHDisp * scaleY);
    try {
      const off = document.createElement("canvas");
      off.width = Math.min(512, Math.round(cropW));
      off.height = Math.min(512, Math.round(cropH));
      const ctx = off.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        off.width,
        off.height
      );
      const data = off.toDataURL("image/png");
      setPreviewSrc(data);
      // dispatch event so parent can consume
      container.dispatchEvent(new CustomEvent("crop:preview", { detail: { data } }));
    } catch {
      // ignore
    }
  }, [rectStyle.left, rectStyle.top, rectStyle.width, rectStyle.height, containerRef, imgRef]);

  // Listen in parent to update its preview state
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { data: string };
      // no-op here; parent uses event
    };
    container.addEventListener("crop:preview", handler as EventListener);
    return () => {
      container.removeEventListener("crop:preview", handler as EventListener);
    };
  }, [containerRef]);

  return (
    <>
      <div
        className="absolute border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.3)] rounded-sm pointer-events-none"
        style={{ left: rectStyle.left, top: rectStyle.top, width: rectStyle.width, height: rectStyle.height }}
      >
        {/* rule of thirds */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          <div className="border-r border-white/40" />
          <div className="border-r border-white/40" />
          <div />
          <div className="border-r border-white/40 border-t border-white/40" />
          <div className="border-r border-white/40 border-t border-white/40" />
          <div className="border-t border-white/40" />
          <div className="border-r border-white/40 border-t border-white/40" />
          <div className="border-r border-white/40 border-t border-white/40" />
          <div className="border-t border-white/40" />
        </div>
      </div>
    </>
  );
}


