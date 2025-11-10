import { useMemo, useState, useEffect, useRef } from "react";
import { FabricImage, FabricObject } from "fabric";
import { Button } from "@/app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { toast } from "sonner";

type ToolKey =
  | "crop"
  | "quickFx"
  | "adjustments"
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
}

export function EditSpace({
  tool,
  isImage,
  cropRatio,
  handleCropRatioChange,
  adjustments,
  selectedObject,
  canvas,
  onImageEdit
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

  // Crop preview state
  const [cropPreviewSrc, setCropPreviewSrc] = useState<string>("");
  const cropContainerRef = useRef<HTMLDivElement | null>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const [selCenter, setSelCenter] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [isDragging, setIsDragging] = useState(false);

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

  // For all tools except crop, only show the selected image preview (no expanded tool UI)
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


