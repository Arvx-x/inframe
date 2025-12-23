'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FabricObject, FabricImage, filters } from "fabric";
import { 
  Activity, 
  Sun, 
  Contrast, 
  Droplet, 
  Thermometer, 
  Palette,
  ChevronDown,
  ChevronUp,
  Blend,
  Waves,
  Circle
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/utils";

interface ImageRasterControlsProps {
  selectedObject: FabricObject | null;
  canvas: any;
}

interface CurvePoint {
  x: number;
  y: number;
}

// Catmull-Rom spline interpolation for smooth professional curves
function catmullRomInterpolate(points: CurvePoint[], x: number): number {
  if (points.length < 2) return x;
  
  // Clamp x to valid range
  if (x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;
  
  // Find the segment containing x
  let i = 0;
  while (i < points.length - 1 && points[i + 1].x < x) i++;
  
  // Get 4 control points for Catmull-Rom (with boundary handling)
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[Math.min(points.length - 1, i + 1)];
  const p3 = points[Math.min(points.length - 1, i + 2)];
  
  // Calculate t parameter (0 to 1 within segment)
  const segmentWidth = p2.x - p1.x;
  if (segmentWidth === 0) return p1.y;
  const t = (x - p1.x) / segmentWidth;
  
  // Catmull-Rom spline coefficients
  const t2 = t * t;
  const t3 = t2 * t;
  
  // Catmull-Rom matrix multiplication
  const v = 0.5 * (
    (2 * p1.y) +
    (-p0.y + p2.y) * t +
    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
  );
  
  // Clamp output to valid range
  return Math.max(0, Math.min(1, v));
}

// Generate 256-entry lookup table from curve points (cached for performance)
function generateLUT(points: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  
  // Check if curve is identity (no change needed)
  const isIdentity = points.length === 2 && 
    points[0].x === 0 && points[0].y === 0 &&
    points[1].x === 1 && points[1].y === 1;
  
  for (let i = 0; i < 256; i++) {
    if (isIdentity) {
      lut[i] = i;
    } else {
      const x = i / 255;
      const y = catmullRomInterpolate(points, x);
      lut[i] = Math.round(y * 255);
    }
  }
  return lut;
}

// Check if a curve is identity (no modification)
function isIdentityCurve(points: CurvePoint[]): boolean {
  return points.length === 2 && 
    Math.abs(points[0].x) < 0.001 && Math.abs(points[0].y) < 0.001 &&
    Math.abs(points[1].x - 1) < 0.001 && Math.abs(points[1].y - 1) < 0.001;
}

// Cache for original image data - keyed by object reference
const originalImageCache = new WeakMap<FabricImage, ImageData>();

// Get or create cached original image data
function getOriginalImageData(img: FabricImage): ImageData | null {
  // Check cache first
  if (originalImageCache.has(img)) {
    const cached = originalImageCache.get(img)!;
    // Return a copy so we don't mutate the cached version
    const copy = new ImageData(
      new Uint8ClampedArray(cached.data),
      cached.width,
      cached.height
    );
    return copy;
  }
  
  // Get from element
  const element = img.getElement() as HTMLImageElement;
  if (!element || !element.complete) return null;
  
  const width = element.naturalWidth || element.width;
  const height = element.naturalHeight || element.height;
  if (width === 0 || height === 0) return null;
  
  const offCanvas = document.createElement('canvas');
  offCanvas.width = width;
  offCanvas.height = height;
  const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  
  ctx.drawImage(element, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  
  // Cache a copy
  const cachedData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );
  originalImageCache.set(img, cachedData);
  
  return imageData;
}

// Color Curves Interactive Editor Component
const ColorCurves = ({ 
  channel, 
  points, 
  onChange,
  color = "#3B82F6"
}: { 
  channel: 'rgb' | 'red' | 'green' | 'blue';
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  color?: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const width = 200;
  const height = 160;
  const padding = 12;
  const graphWidth = width - 2 * padding;
  const graphHeight = height - 2 * padding;

  // Draw the curves with histogram background hint
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear with slight background
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 0.5;
    
    // Vertical grid lines (quarters)
    for (let i = 0; i <= 4; i++) {
      const x = padding + (i / 4) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }
    
    // Horizontal grid lines (quarters)
    for (let i = 0; i <= 4; i++) {
      const y = padding + (i / 4) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw diagonal reference line (identity)
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, padding);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw the actual curve with anti-aliasing
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    // Sample the curve at high resolution for smooth rendering
    const samples = graphWidth * 2;
    for (let px = 0; px <= samples; px++) {
      const x = px / samples;
      const y = catmullRomInterpolate(points, x);
      const canvasX = padding + x * graphWidth;
      const canvasY = height - padding - y * graphHeight;
      
      if (px === 0) {
        ctx.moveTo(canvasX, canvasY);
      } else {
        ctx.lineTo(canvasX, canvasY);
      }
    }
    ctx.stroke();

    // Draw control points
    points.forEach((point, index) => {
      const canvasX = padding + point.x * graphWidth;
      const canvasY = height - padding - point.y * graphHeight;
      
      const isHovered = index === hoveredIndex;
      const isDragging = index === draggingIndex;
      const radius = isDragging ? 7 : isHovered ? 6 : 5;
      
      // Outer ring
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, radius + 1, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Inner fill
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, radius - 2, 0, Math.PI * 2);
      ctx.fillStyle = isDragging ? color : 'white';
      ctx.fill();
    });

    // Draw input/output value indicator when dragging
    if (draggingIndex !== null && points[draggingIndex]) {
      const point = points[draggingIndex];
      const inputVal = Math.round(point.x * 255);
      const outputVal = Math.round(point.y * 255);
      
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'left';
      ctx.fillText(`In: ${inputVal}  Out: ${outputVal}`, padding + 4, height - 4);
    }
  }, [points, color, hoveredIndex, draggingIndex]);

  const getPointFromEvent = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    
    const x = ((e.clientX - rect.left) * scaleX - padding) / graphWidth;
    const y = 1 - ((e.clientY - rect.top) * scaleY - padding) / graphHeight;
    
    return { 
      x: Math.max(0, Math.min(1, x)), 
      y: Math.max(0, Math.min(1, y)) 
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getPointFromEvent(e);
    if (!point) return;

    // Check if clicking on existing point
    const threshold = 0.06;
    const existingIndex = points.findIndex(p => 
      Math.abs(p.x - point.x) < threshold && Math.abs(p.y - point.y) < threshold
    );

    if (existingIndex !== -1) {
      setDraggingIndex(existingIndex);
    } else {
      // Add new point (not at endpoints)
      if (point.x > 0.02 && point.x < 0.98) {
        const newPoints = [...points, point].sort((a, b) => a.x - b.x);
        onChange(newPoints);
        const newIndex = newPoints.findIndex(p => 
          Math.abs(p.x - point.x) < 0.01 && Math.abs(p.y - point.y) < 0.01
        );
        setDraggingIndex(newIndex);
      }
    }
  }, [points, onChange, getPointFromEvent]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getPointFromEvent(e);
    if (!point) return;

    if (draggingIndex !== null) {
      const newPoints = [...points];
      const isFirst = draggingIndex === 0;
      const isLast = draggingIndex === points.length - 1;
      
      // Constrain endpoint X positions, but allow Y to move freely
      let newX = point.x;
      if (isFirst) {
        newX = 0;
      } else if (isLast) {
        newX = 1;
      } else {
        // Prevent crossing adjacent points
        const prevX = points[draggingIndex - 1]?.x ?? 0;
        const nextX = points[draggingIndex + 1]?.x ?? 1;
        newX = Math.max(prevX + 0.01, Math.min(nextX - 0.01, point.x));
      }
      
      newPoints[draggingIndex] = { x: newX, y: point.y };
      onChange(newPoints);
    } else {
      // Check for hover
      const threshold = 0.06;
      const hoverIndex = points.findIndex(p => 
        Math.abs(p.x - point.x) < threshold && Math.abs(p.y - point.y) < threshold
      );
      setHoveredIndex(hoverIndex !== -1 ? hoverIndex : null);
    }
  }, [draggingIndex, points, onChange, getPointFromEvent]);

  const handleMouseUp = useCallback(() => {
    setDraggingIndex(null);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getPointFromEvent(e);
    if (!point) return;

    // Check if clicking on existing point to remove it
    const threshold = 0.06;
    const existingIndex = points.findIndex(p => 
      Math.abs(p.x - point.x) < threshold && Math.abs(p.y - point.y) < threshold
    );

    // Don't remove first or last point
    if (existingIndex > 0 && existingIndex < points.length - 1) {
      const newPoints = points.filter((_, i) => i !== existingIndex);
      onChange(newPoints);
      setHoveredIndex(null);
    }
  }, [points, onChange, getPointFromEvent]);

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg border border-[#E5E5E5] cursor-crosshair shadow-sm"
        style={{ width: '100%', height: 'auto' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
};

// Slider component with real-time updates
const RasterSlider = ({
  label,
  icon: Icon,
  value,
  onChange,
  min = -100,
  max = 100,
  step = 1,
  unit = "",
  color = "#3B82F6"
}: {
  label: string;
  icon?: any;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  color?: string;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-[#6E6E6E]" />}
        <span className="text-[11px] text-[#161616]">{label}</span>
      </div>
      <span className="text-[11px] text-[#6E6E6E] font-mono tabular-nums">
        {value > 0 ? `+${value}` : value}{unit}
      </span>
    </div>
    <div className="relative">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-[#E5E5E5] rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
      {min < 0 && max > 0 && (
        <div 
          className="absolute top-1/2 w-0.5 h-3 bg-[#9CA3AF] -translate-y-1/2 pointer-events-none"
          style={{ left: `${((-min) / (max - min)) * 100}%` }}
        />
      )}
    </div>
  </div>
);

export const ImageRasterControls = ({ selectedObject, canvas }: ImageRasterControlsProps) => {
  const isImage = selectedObject instanceof FabricImage;
  
  // Curves state for each channel
  const [rgbCurve, setRgbCurve] = useState<CurvePoint[]>([
    { x: 0, y: 0 },
    { x: 1, y: 1 }
  ]);
  const [redCurve, setRedCurve] = useState<CurvePoint[]>([
    { x: 0, y: 0 },
    { x: 1, y: 1 }
  ]);
  const [greenCurve, setGreenCurve] = useState<CurvePoint[]>([
    { x: 0, y: 0 },
    { x: 1, y: 1 }
  ]);
  const [blueCurve, setBlueCurve] = useState<CurvePoint[]>([
    { x: 0, y: 0 },
    { x: 1, y: 1 }
  ]);
  
  // Active curve channel
  const [activeChannel, setActiveChannel] = useState<'rgb' | 'red' | 'green' | 'blue'>('rgb');
  
  // Levels state
  const [inputBlack, setInputBlack] = useState(0);
  const [inputWhite, setInputWhite] = useState(255);
  const [gamma, setGamma] = useState(1.0);
  const [outputBlack, setOutputBlack] = useState(0);
  const [outputWhite, setOutputWhite] = useState(255);
  
  // Color balance state
  const [shadowsCyanRed, setShadowsCyanRed] = useState(0);
  const [shadowsMagentaGreen, setShadowsMagentaGreen] = useState(0);
  const [shadowsYellowBlue, setShadowsYellowBlue] = useState(0);
  const [midtonesCyanRed, setMidtonesCyanRed] = useState(0);
  const [midtonesMagentaGreen, setMidtonesMagentaGreen] = useState(0);
  const [midtonesYellowBlue, setMidtonesYellowBlue] = useState(0);
  const [highlightsCyanRed, setHighlightsCyanRed] = useState(0);
  const [highlightsMagentaGreen, setHighlightsMagentaGreen] = useState(0);
  const [highlightsYellowBlue, setHighlightsYellowBlue] = useState(0);
  
  // Temperature & Tint
  const [temperature, setTemperature] = useState(0);
  const [tint, setTint] = useState(0);
  
  // HSL adjustments
  const [hue, setHue] = useState(0);
  const [saturationAdjust, setSaturationAdjust] = useState(0);
  const [lightnessAdjust, setLightnessAdjust] = useState(0);
  
  // Sharpening
  const [sharpen, setSharpen] = useState(0);
  const [clarity, setClarity] = useState(0);
  
  // Vignette
  const [vignetteAmount, setVignetteAmount] = useState(0);
  const [vignetteFeather, setVignetteFeather] = useState(50);
  
  // Section expansion state
  const [expandedSection, setExpandedSection] = useState<string | null>('curves');
  const [colorBalanceRange, setColorBalanceRange] = useState<'shadows' | 'midtones' | 'highlights'>('midtones');

  // Memoize LUT generation for performance
  const rgbLUT = useMemo(() => generateLUT(rgbCurve), [rgbCurve]);
  const redLUT = useMemo(() => generateLUT(redCurve), [redCurve]);
  const greenLUT = useMemo(() => generateLUT(greenCurve), [greenCurve]);
  const blueLUT = useMemo(() => generateLUT(blueCurve), [blueCurve]);

  // Check if curves are modified
  const curvesModified = useMemo(() => {
    return !isIdentityCurve(rgbCurve) || 
           !isIdentityCurve(redCurve) || 
           !isIdentityCurve(greenCurve) || 
           !isIdentityCurve(blueCurve);
  }, [rgbCurve, redCurve, greenCurve, blueCurve]);

  // Apply raster effects to image - real-time with minimal delay
  const applyRasterEffects = useCallback(() => {
    if (!isImage || !selectedObject || !canvas) return;
    
    const img = selectedObject as FabricImage;
    
    // Get original image data from cache
    const originalData = getOriginalImageData(img);
    if (!originalData) return;
    
    // Create working copy
    const workingData = new ImageData(
      new Uint8ClampedArray(originalData.data),
      originalData.width,
      originalData.height
    );
    const data = workingData.data;
    
    // 1. Apply color curves (LUT-based, professional grade)
    if (curvesModified) {
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        // Apply individual channel curves first
        r = redLUT[r];
        g = greenLUT[g];
        b = blueLUT[b];
        
        // Then apply master RGB curve
        data[i] = rgbLUT[r];
        data[i + 1] = rgbLUT[g];
        data[i + 2] = rgbLUT[b];
      }
    }
    
    // 2. Apply Levels (input/output levels + gamma)
    if (inputBlack !== 0 || inputWhite !== 255 || outputBlack !== 0 || outputWhite !== 255 || gamma !== 1.0) {
      const inputRange = Math.max(1, inputWhite - inputBlack);
      const outputRange = outputWhite - outputBlack;
      
      // Create levels LUT for efficiency
      const levelsLUT = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        let value = (i - inputBlack) / inputRange;
        value = Math.max(0, Math.min(1, value));
        if (gamma !== 1.0) {
          value = Math.pow(value, 1 / gamma);
        }
        value = outputBlack + value * outputRange;
        levelsLUT[i] = Math.round(Math.max(0, Math.min(255, value)));
      }
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = levelsLUT[data[i]];
        data[i + 1] = levelsLUT[data[i + 1]];
        data[i + 2] = levelsLUT[data[i + 2]];
      }
    }
    
    // 3. Apply Temperature/Tint
    if (temperature !== 0 || tint !== 0) {
      const tempFactor = temperature / 100;
      const tintFactor = tint / 100;
      
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        // Warm/cool temperature
        r = Math.max(0, Math.min(255, r + tempFactor * 30));
        b = Math.max(0, Math.min(255, b - tempFactor * 30));
        
        // Tint (green/magenta)
        g = Math.max(0, Math.min(255, g + tintFactor * 20));
        
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }
    
    // 4. Apply Color Balance
    const totalCyanRed = (shadowsCyanRed + midtonesCyanRed + highlightsCyanRed) / 3;
    const totalMagentaGreen = (shadowsMagentaGreen + midtonesMagentaGreen + highlightsMagentaGreen) / 3;
    const totalYellowBlue = (shadowsYellowBlue + midtonesYellowBlue + highlightsYellowBlue) / 3;
    
    if (totalCyanRed !== 0 || totalMagentaGreen !== 0 || totalYellowBlue !== 0) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, data[i] + totalCyanRed * 0.5));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + totalMagentaGreen * 0.5));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + totalYellowBlue * 0.5));
      }
    }
    
    // Create offscreen canvas and apply the processed data
    const offCanvas = document.createElement('canvas');
    offCanvas.width = workingData.width;
    offCanvas.height = workingData.height;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.putImageData(workingData, 0, 0);
    
    // Create new image element and update fabric image
    const newImgElement = new Image();
    newImgElement.crossOrigin = 'anonymous';
    newImgElement.onload = () => {
      // Preserve transform properties
      const props = {
        left: img.left,
        top: img.top,
        scaleX: img.scaleX,
        scaleY: img.scaleY,
        angle: img.angle,
        flipX: img.flipX,
        flipY: img.flipY,
        opacity: img.opacity
      };
      
      img.setElement(newImgElement);
      img.set(props);
      
      // Apply remaining filters that work better with Fabric's filter system
      const fabricFilters: any[] = [];
      
      // HSL adjustments
      if (hue !== 0) {
        fabricFilters.push(new filters.HueRotation({ rotation: hue / 360 }));
      }
      if (saturationAdjust !== 0) {
        fabricFilters.push(new filters.Saturation({ saturation: saturationAdjust / 100 }));
      }
      if (lightnessAdjust !== 0) {
        fabricFilters.push(new filters.Brightness({ brightness: lightnessAdjust / 200 }));
      }
      
      // Sharpen
      if (sharpen > 0) {
        const amount = sharpen / 50;
        fabricFilters.push(new filters.Convolute({ 
          matrix: [0, -amount, 0, -amount, 1 + 4 * amount, -amount, 0, -amount, 0] 
        }));
      }
      
      // Clarity
      if (clarity > 0) {
        const ca = clarity / 100;
        fabricFilters.push(new filters.Convolute({ 
          matrix: [-ca*0.5, -ca, -ca*0.5, -ca, 1 + 6*ca, -ca, -ca*0.5, -ca, -ca*0.5] 
        }));
      }
      
      img.filters = fabricFilters;
      img.applyFilters();
      canvas.requestRenderAll();
    };
    newImgElement.src = offCanvas.toDataURL('image/png');
  }, [
    isImage, selectedObject, canvas,
    rgbLUT, redLUT, greenLUT, blueLUT, curvesModified,
    temperature, tint, hue, saturationAdjust, lightnessAdjust,
    gamma, inputBlack, inputWhite, outputBlack, outputWhite,
    shadowsCyanRed, shadowsMagentaGreen, shadowsYellowBlue,
    midtonesCyanRed, midtonesMagentaGreen, midtonesYellowBlue,
    highlightsCyanRed, highlightsMagentaGreen, highlightsYellowBlue,
    sharpen, clarity
  ]);

  // Apply effects with debounce for real-time feel without overwhelming the browser
  useEffect(() => {
    // Small debounce to batch rapid changes
    const timeoutId = setTimeout(() => {
      applyRasterEffects();
    }, 16); // ~60fps
    return () => clearTimeout(timeoutId);
  }, [applyRasterEffects]);
  
  // Cache the original image when selection changes
  useEffect(() => {
    if (isImage && selectedObject) {
      // Pre-cache the original image data
      getOriginalImageData(selectedObject as FabricImage);
    }
  }, [isImage, selectedObject]);

  const getActiveCurve = () => {
    switch (activeChannel) {
      case 'red': return redCurve;
      case 'green': return greenCurve;
      case 'blue': return blueCurve;
      default: return rgbCurve;
    }
  };

  const setActiveCurve = (points: CurvePoint[]) => {
    switch (activeChannel) {
      case 'red': setRedCurve(points); break;
      case 'green': setGreenCurve(points); break;
      case 'blue': setBlueCurve(points); break;
      default: setRgbCurve(points); break;
    }
  };

  const getChannelColor = () => {
    switch (activeChannel) {
      case 'red': return '#EF4444';
      case 'green': return '#22C55E';
      case 'blue': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const resetCurrentCurve = () => {
    setActiveCurve([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  };

  if (!isImage) return null;

  const SectionHeader = ({ 
    id, 
    icon: Icon, 
    title 
  }: { 
    id: string; 
    icon: any; 
    title: string;
  }) => (
    <button
      onClick={() => setExpandedSection(expandedSection === id ? null : id)}
      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#F5F5F5] transition-colors rounded-xl"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-500" />
        <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">{title}</span>
      </div>
      {expandedSection === id ? (
        <ChevronUp className="w-4 h-4 text-[#6E6E6E]" />
      ) : (
        <ChevronDown className="w-4 h-4 text-[#6E6E6E]" />
      )}
    </button>
  );

  return (
    <div className="space-y-2.5">
      {/* Curves Section */}
      <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl">
        <SectionHeader id="curves" icon={Activity} title="Curves" />
        
        <div
          className={cn(
            "overflow-hidden transition-all",
            expandedSection === 'curves' 
              ? 'max-h-[500px] opacity-100' 
              : 'max-h-0 opacity-0'
          )}
          style={{ transition: 'max-height 250ms ease, opacity 200ms ease' }}
        >
          <div className="px-3 pb-3 space-y-3">
            {/* Channel Selector */}
            <div className="flex gap-1 p-1 bg-white rounded-lg border border-[#E5E5E5]">
              {(['rgb', 'red', 'green', 'blue'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setActiveChannel(ch)}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors",
                    activeChannel === ch
                      ? ch === 'rgb' 
                        ? 'bg-gray-800 text-white'
                        : ch === 'red'
                          ? 'bg-red-500 text-white'
                          : ch === 'green'
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-500 text-white'
                      : 'text-[#6E6E6E] hover:bg-gray-100'
                  )}
                >
                  {ch.toUpperCase()}
                </button>
              ))}
            </div>
            
            {/* Curve Editor */}
            <div className="flex justify-center">
              <ColorCurves
                channel={activeChannel}
                points={getActiveCurve()}
                onChange={setActiveCurve}
                color={getChannelColor()}
              />
            </div>
            
            <p className="text-[10px] text-[#9E9E9E] text-center">
              Click to add • Double-click to remove • Drag to adjust
            </p>
            
            {/* Reset curve button */}
            <Button
              variant="outline"
              size="sm"
              onClick={resetCurrentCurve}
              className="w-full h-7 text-[11px]"
            >
              Reset {activeChannel.toUpperCase()} Curve
            </Button>
          </div>
        </div>
      </div>

      {/* Levels Section */}
      <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl">
        <SectionHeader id="levels" icon={Contrast} title="Levels" />
        
        <div
          className={cn(
            "overflow-hidden transition-all",
            expandedSection === 'levels'
              ? 'max-h-[300px] opacity-100'
              : 'max-h-0 opacity-0'
          )}
          style={{ transition: 'max-height 250ms ease, opacity 200ms ease' }}
        >
          <div className="px-3 pb-3 space-y-3">
            <div className="space-y-2.5">
              <div className="text-[11px] text-[#6E6E6E]">Input Levels</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <RasterSlider
                    label="Black"
                    value={inputBlack}
                    onChange={setInputBlack}
                    min={0}
                    max={255}
                    color="#161616"
                  />
                </div>
                <div className="flex-1">
                  <RasterSlider
                    label="White"
                    value={inputWhite}
                    onChange={setInputWhite}
                    min={0}
                    max={255}
                    color="#F3F4F6"
                  />
                </div>
              </div>
              
              <RasterSlider
                label="Gamma"
                value={Math.round((gamma - 1) * 100)}
                onChange={(v) => setGamma(1 + v / 100)}
                min={-100}
                max={100}
                color="#6B7280"
              />
            </div>
            
            <div className="space-y-2.5">
              <div className="text-[11px] text-[#6E6E6E]">Output Levels</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <RasterSlider
                    label="Black"
                    value={outputBlack}
                    onChange={setOutputBlack}
                    min={0}
                    max={255}
                    color="#161616"
                  />
                </div>
                <div className="flex-1">
                  <RasterSlider
                    label="White"
                    value={outputWhite}
                    onChange={setOutputWhite}
                    min={0}
                    max={255}
                    color="#F3F4F6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Temperature & Tint Section */}
      <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl">
        <SectionHeader id="temperature" icon={Thermometer} title="Temperature & Tint" />
        
        <div
          className={cn(
            "overflow-hidden transition-all",
            expandedSection === 'temperature'
              ? 'max-h-[200px] opacity-100'
              : 'max-h-0 opacity-0'
          )}
          style={{ transition: 'max-height 250ms ease, opacity 200ms ease' }}
        >
          <div className="px-3 pb-3 space-y-3">
            <RasterSlider
              label="Temperature"
              icon={Thermometer}
              value={temperature}
              onChange={setTemperature}
              color="#F59E0B"
            />
            <RasterSlider
              label="Tint"
              icon={Droplet}
              value={tint}
              onChange={setTint}
              color="#A855F7"
            />
          </div>
        </div>
      </div>

      {/* Color Balance Section */}
      <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl">
        <SectionHeader id="colorBalance" icon={Blend} title="Color Balance" />
        
        <div
          className={cn(
            "overflow-hidden transition-all",
            expandedSection === 'colorBalance'
              ? 'max-h-[350px] opacity-100'
              : 'max-h-0 opacity-0'
          )}
          style={{ transition: 'max-height 250ms ease, opacity 200ms ease' }}
        >
          <div className="px-3 pb-3 space-y-3">
            {/* Range selector */}
            <div className="flex gap-1 p-1 bg-white rounded-lg border border-[#E5E5E5]">
              {(['shadows', 'midtones', 'highlights'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setColorBalanceRange(range)}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-colors capitalize",
                    colorBalanceRange === range
                      ? 'bg-blue-500 text-white'
                      : 'text-[#6E6E6E] hover:bg-gray-100'
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
            
            {/* Sliders based on selected range */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#9E9E9E]">Cyan</span>
                <span className="text-[10px] text-[#9E9E9E]">Red</span>
              </div>
              <RasterSlider
                label=""
                value={
                  colorBalanceRange === 'shadows' ? shadowsCyanRed :
                  colorBalanceRange === 'highlights' ? highlightsCyanRed :
                  midtonesCyanRed
                }
                onChange={(v) => {
                  if (colorBalanceRange === 'shadows') setShadowsCyanRed(v);
                  else if (colorBalanceRange === 'highlights') setHighlightsCyanRed(v);
                  else setMidtonesCyanRed(v);
                }}
                color="#EF4444"
              />
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#9E9E9E]">Magenta</span>
                <span className="text-[10px] text-[#9E9E9E]">Green</span>
              </div>
              <RasterSlider
                label=""
                value={
                  colorBalanceRange === 'shadows' ? shadowsMagentaGreen :
                  colorBalanceRange === 'highlights' ? highlightsMagentaGreen :
                  midtonesMagentaGreen
                }
                onChange={(v) => {
                  if (colorBalanceRange === 'shadows') setShadowsMagentaGreen(v);
                  else if (colorBalanceRange === 'highlights') setHighlightsMagentaGreen(v);
                  else setMidtonesMagentaGreen(v);
                }}
                color="#22C55E"
              />
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#9E9E9E]">Yellow</span>
                <span className="text-[10px] text-[#9E9E9E]">Blue</span>
              </div>
              <RasterSlider
                label=""
                value={
                  colorBalanceRange === 'shadows' ? shadowsYellowBlue :
                  colorBalanceRange === 'highlights' ? highlightsYellowBlue :
                  midtonesYellowBlue
                }
                onChange={(v) => {
                  if (colorBalanceRange === 'shadows') setShadowsYellowBlue(v);
                  else if (colorBalanceRange === 'highlights') setHighlightsYellowBlue(v);
                  else setMidtonesYellowBlue(v);
                }}
                color="#3B82F6"
              />
            </div>
          </div>
        </div>
      </div>

      {/* HSL Adjustments Section */}
      <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl">
        <SectionHeader id="hsl" icon={Palette} title="HSL Adjustments" />
        
        <div
          className={cn(
            "overflow-hidden transition-all",
            expandedSection === 'hsl'
              ? 'max-h-[250px] opacity-100'
              : 'max-h-0 opacity-0'
          )}
          style={{ transition: 'max-height 250ms ease, opacity 200ms ease' }}
        >
          <div className="px-3 pb-3 space-y-3">
            <RasterSlider
              label="Hue"
              value={hue}
              onChange={setHue}
              min={-180}
              max={180}
              unit="°"
              color="#EC4899"
            />
            <RasterSlider
              label="Saturation"
              icon={Droplet}
              value={saturationAdjust}
              onChange={setSaturationAdjust}
              color="#8B5CF6"
            />
            <RasterSlider
              label="Lightness"
              icon={Sun}
              value={lightnessAdjust}
              onChange={setLightnessAdjust}
              color="#F59E0B"
            />
          </div>
        </div>
      </div>

      {/* Sharpening Section */}
      <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl">
        <SectionHeader id="sharpen" icon={Waves} title="Sharpening" />
        
        <div
          className={cn(
            "overflow-hidden transition-all",
            expandedSection === 'sharpen'
              ? 'max-h-[200px] opacity-100'
              : 'max-h-0 opacity-0'
          )}
          style={{ transition: 'max-height 250ms ease, opacity 200ms ease' }}
        >
          <div className="px-3 pb-3 space-y-3">
            <RasterSlider
              label="Sharpen"
              value={sharpen}
              onChange={setSharpen}
              min={0}
              max={100}
              color="#3B82F6"
            />
            <RasterSlider
              label="Clarity"
              value={clarity}
              onChange={setClarity}
              min={0}
              max={100}
              color="#6366F1"
            />
          </div>
        </div>
      </div>

      {/* Vignette Section */}
      <div className="bg-[#F4F4F6] border border-[#E5E5E5] rounded-xl">
        <SectionHeader id="vignette" icon={Circle} title="Vignette" />
        
        <div
          className={cn(
            "overflow-hidden transition-all",
            expandedSection === 'vignette'
              ? 'max-h-[200px] opacity-100'
              : 'max-h-0 opacity-0'
          )}
          style={{ transition: 'max-height 250ms ease, opacity 200ms ease' }}
        >
          <div className="px-3 pb-3 space-y-3">
            <RasterSlider
              label="Amount"
              value={vignetteAmount}
              onChange={setVignetteAmount}
              min={-100}
              max={100}
              color="#1F2937"
            />
            <RasterSlider
              label="Feather"
              value={vignetteFeather}
              onChange={setVignetteFeather}
              min={0}
              max={100}
              color="#6B7280"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
