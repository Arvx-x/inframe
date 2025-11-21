"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FabricObject, Image as FabricImage, Textbox as FabricTextbox, filters, Gradient } from "fabric";
import { Pipette, Palette, Plus, Trash2, MoveHorizontal, ChevronDown, Droplet, Square, Sparkles, Sliders } from "lucide-react";
import { useProjectColors } from "@/app/contexts/ProjectColorsContext";

interface ColorsProps {
  selectedObject: FabricObject | null;
  canvas: any;
  initialColor?: string; // hex like #RRGGBB
  onChangeHex?: (hex: string) => void;
}

// Utility conversions
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return { r: R, g: G, b: B };
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = 60 * (((g - b) / d) % 6); break;
      case g: h = 60 * ((b - r) / d + 2); break;
      default: h = 60 * ((r - g) / d + 4); break;
    }
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

// Colors component renders: hue wheel ring and inner SV triangle with live preview
export default function Colors({ selectedObject, canvas, initialColor = "#18A0FB", onChangeHex }: ColorsProps) {
  const { projectColors } = useProjectColors();
  const size = 130; // overall size (slightly larger for better visibility)
  const ringWidth = 11; // hue ring
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const svCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragModeRef = useRef<'ring' | 'triangle' | null>(null);
  const shouldApplyRef = useRef<boolean>(false);

  const parsed = hexToRgb(initialColor);
  const initialHsv = parsed ? rgbToHsv(parsed.r, parsed.g, parsed.b) : { h: 200, s: 0.8, v: 0.8 };
  const [hue, setHue] = useState<number>(initialHsv.h);
  const [sat, setSat] = useState<number>(initialHsv.s);
  const [val, setVal] = useState<number>(initialHsv.v);
  const hueRef = useRef<number>(initialHsv.h);

  // Fill type state
  const [fillType, setFillType] = useState<'solid' | 'linear' | 'radial' | 'angular'>('solid');

  // Gradient state
  const [gradientStops, setGradientStops] = useState<Array<{ offset: number; color: string }>>([
    { offset: 0, color: '#FF6B6B' },
    { offset: 1, color: '#4ECDC4' }
  ]);
  const [selectedStop, setSelectedStop] = useState<number>(0);
  const [gradientAngle, setGradientAngle] = useState<number>(0);

  // Color adjustments state
  const [adjustments, setAdjustments] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
  });

  // Keep ref in sync with state
  useEffect(() => {
    hueRef.current = hue;
  }, [hue]);

  const center = size / 2;
  const innerRadius = center - ringWidth; // triangle fits in this circle

  // Draw hue wheel ring
  useEffect(() => {
    const canvasEl = wheelCanvasRef.current;
    if (!canvasEl) return;
    canvasEl.width = size;
    canvasEl.height = size;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);

    for (let angle = 0; angle < 360; angle += 1) {
      const start = (angle - 1) * (Math.PI / 180);
      const end = angle * (Math.PI / 180);
      const { r, g, b } = hsvToRgb(angle, 1, 1);
      ctx.beginPath();
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = ringWidth;
      ctx.arc(center, center, center - ringWidth / 2, start, end);
      ctx.stroke();
    }

    // indicator for hue
    const rad = (hue * Math.PI) / 180;
    const rx = center + (center - ringWidth / 2) * Math.cos(rad);
    const ry = center + (center - ringWidth / 2) * Math.sin(rad);
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.arc(rx, ry, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [hue]);

  // Triangle vertices for SV space
  // Standard HSV triangle: top-left = white (S=0, V=1), top-right = full color (S=1, V=1), bottom = black (V=0)
  // The triangle rotates so the top-right (full color) vertex aligns with the hue selector
  function triangleVertices(currentHue: number) {
    // Triangle size - fits inside inner circle (circumscribed)
    // For an equilateral triangle to be circumscribed by a circle of radius r, 
    // the triangle side length = r * sqrt(3)
    // The distance from center to vertex = r (innerRadius)
    const r = innerRadius;

    // Base triangle vertices (unrotated, pointing up with top-right at 0°)
    // Top-right vertex at (r, 0) relative to center - this will point to hue selector
    // Top-left vertex rotated -120° from top-right
    // Bottom vertex rotated -240° from top-right

    // Rotate triangle so top-right vertex aligns with hue selector
    const hueRad = (currentHue * Math.PI) / 180;

    // Calculate vertices relative to center, then rotate
    const rotatePoint = (x: number, y: number, angle: number) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: center + x * cos - y * sin,
        y: center + x * sin + y * cos
      };
    };

    // Top-right vertex (full color) at 0° relative to center, then rotated by hue
    const topRightRel = { x: r, y: 0 };
    // Top-left vertex (white) at -120° relative to center
    const topLeftRel = {
      x: r * Math.cos(-2 * Math.PI / 3),
      y: r * Math.sin(-2 * Math.PI / 3)
    };
    // Bottom vertex (black) at -240° relative to center
    const bottomRel = {
      x: r * Math.cos(-4 * Math.PI / 3),
      y: r * Math.sin(-4 * Math.PI / 3)
    };

    // Rotate all vertices by hue angle
    const topRight = rotatePoint(topRightRel.x, topRightRel.y, hueRad);
    const topLeft = rotatePoint(topLeftRel.x, topLeftRel.y, hueRad);
    const bottom = rotatePoint(bottomRel.x, bottomRel.y, hueRad);

    return { topLeft, topRight, bottom };
  }

  function drawSVTriangle() {
    const canvasEl = svCanvasRef.current;
    if (!canvasEl) return;
    canvasEl.width = size;
    canvasEl.height = size;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);

    const { topLeft, topRight, bottom } = triangleVertices(hue);

    // Draw triangle pixel by pixel for accurate colors
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Check if point is inside triangle using barycentric coordinates
        const denom = (topRight.y - bottom.y) * (topLeft.x - bottom.x) + (bottom.x - topRight.x) * (topLeft.y - bottom.y);
        if (Math.abs(denom) < 0.001) continue;

        const w1 = ((topRight.y - bottom.y) * (x - bottom.x) + (bottom.x - topRight.x) * (y - bottom.y)) / denom;
        const w2 = ((bottom.y - topLeft.y) * (x - bottom.x) + (topLeft.x - bottom.x) * (y - bottom.y)) / denom;
        const w3 = 1 - w1 - w2;

        if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
          // Inside triangle
          // Map barycentric coordinates to S and V
          // topLeft (w1=1): S=0, V=1 (white)
          // topRight (w2=1): S=1, V=1 (full color)
          // bottom (w3=1): V=0 (black)

          // Saturation: 0 at topLeft, 1 at topRight
          const s = w2;
          // Value: 1 at top, 0 at bottom
          const v = w1 + w2; // Sum of top weights

          // Convert HSV to RGB
          const { r, g, b } = hsvToRgb(hue, s, v);
          const idx = (y * size + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Draw triangle border
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.closePath();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw cursor based on current sat,val
    // Map S and V to barycentric coordinates
    // S=0, V=1 -> topLeft (w1=1)
    // S=1, V=1 -> topRight (w2=1)
    // V=0 -> bottom (w3=1)
    const w1 = val * (1 - sat); // White component
    const w2 = val * sat; // Full color component
    const w3 = 1 - val; // Black component

    const px = topLeft.x * w1 + topRight.x * w2 + bottom.x * w3;
    const py = topLeft.y * w1 + topRight.y * w2 + bottom.y * w3;

    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  useEffect(() => {
    drawSVTriangle();
  }, [hue, sat, val]);

  // Handle interactions
  // Unified pointer handling on container: choose ring vs triangle by hit-test
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getCoordinates = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return {
        x: clientX - rect.left - center,
        y: clientY - rect.top - center,
        radius: 0
      };
    };

    const handleMove = (clientX: number, clientY: number) => {
      const coords = getCoordinates(clientX, clientY);
      coords.radius = Math.sqrt(coords.x * coords.x + coords.y * coords.y);

      // Expanded hit area for ring - easier to grab (wider tolerance)
      const ringTolerance = 8; // Extra pixels for easier grabbing
      const outer = center + ringTolerance;
      const inner = center - ringWidth - ringTolerance;

      // If we're in drag mode, stick to that mode
      if (isDraggingRef.current && dragModeRef.current === 'ring') {
        // Always update hue when dragging ring, regardless of position
        const angle = Math.atan2(coords.y, coords.x);
        let deg = (angle * 180) / Math.PI;
        if (deg < 0) deg += 360;
        setHue(deg);
        return;
      }

      if (isDraggingRef.current && dragModeRef.current === 'triangle') {
        // Always update triangle when dragging triangle
        const px = coords.x + center;
        const py = coords.y + center;
        const currentHue = hueRef.current;
        const { topLeft, topRight, bottom } = triangleVertices(currentHue);

        const denom = (topRight.y - bottom.y) * (topLeft.x - bottom.x) + (bottom.x - topRight.x) * (topLeft.y - bottom.y);
        if (Math.abs(denom) < 0.001) return;

        const w1 = ((topRight.y - bottom.y) * (px - bottom.x) + (bottom.x - topRight.x) * (py - bottom.y)) / denom;
        const w2 = ((bottom.y - topLeft.y) * (px - bottom.x) + (topLeft.x - bottom.x) * (py - bottom.y)) / denom;
        const w3 = 1 - w1 - w2;

        if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
          const vNew = clamp(w1 + w2, 0, 1);
          const sNew = vNew > 0.001 ? clamp(w2 / vNew, 0, 1) : 0;
          setSat(sNew);
          setVal(vNew);
        }
        return;
      }

      // Initial hit detection (not dragging yet)
      if (coords.radius >= inner && coords.radius <= outer) {
        // On or near the hue ring
        const angle = Math.atan2(coords.y, coords.x);
        let deg = (angle * 180) / Math.PI;
        if (deg < 0) deg += 360;
        setHue(deg);
        return;
      }

      // Inside: treat as triangle selection
      const px = coords.x + center;
      const py = coords.y + center;
      const currentHue = hueRef.current;
      const { topLeft, topRight, bottom } = triangleVertices(currentHue);

      const denom = (topRight.y - bottom.y) * (topLeft.x - bottom.x) + (bottom.x - topRight.x) * (topLeft.y - bottom.y);
      if (Math.abs(denom) < 0.001) return;

      const w1 = ((topRight.y - bottom.y) * (px - bottom.x) + (bottom.x - topRight.x) * (py - bottom.y)) / denom;
      const w2 = ((bottom.y - topLeft.y) * (px - bottom.x) + (topLeft.x - bottom.x) * (py - bottom.y)) / denom;
      const w3 = 1 - w1 - w2;

      if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
        const vNew = clamp(w1 + w2, 0, 1);
        const sNew = vNew > 0.001 ? clamp(w2 / vNew, 0, 1) : 0;
        setSat(sNew);
        setVal(vNew);
      }
    };

    const onDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Enable applying color due to user interaction
      shouldApplyRef.current = true;
      const coords = getCoordinates(e.clientX, e.clientY);
      coords.radius = Math.sqrt(coords.x * coords.x + coords.y * coords.y);

      // Determine drag mode based on initial click position
      const ringTolerance = 8;
      const outer = center + ringTolerance;
      const inner = center - ringWidth - ringTolerance;

      if (coords.radius >= inner && coords.radius <= outer) {
        isDraggingRef.current = true;
        dragModeRef.current = 'ring';
        handleMove(e.clientX, e.clientY);
      } else {
        // Check if inside triangle
        const px = coords.x + center;
        const py = coords.y + center;
        const currentHue = hueRef.current;
        const { topLeft, topRight, bottom } = triangleVertices(currentHue);
        const denom = (topRight.y - bottom.y) * (topLeft.x - bottom.x) + (bottom.x - topRight.x) * (topLeft.y - bottom.y);
        if (Math.abs(denom) > 0.001) {
          const w1 = ((topRight.y - bottom.y) * (px - bottom.x) + (bottom.x - topRight.x) * (py - bottom.y)) / denom;
          const w2 = ((bottom.y - topLeft.y) * (px - bottom.x) + (topLeft.x - bottom.x) * (py - bottom.y)) / denom;
          const w3 = 1 - w1 - w2;
          if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
            isDraggingRef.current = true;
            dragModeRef.current = 'triangle';
            handleMove(e.clientX, e.clientY);
          }
        }
      }
    };

    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      handleMove(e.clientX, e.clientY);
    };

    const onUp = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
      isDraggingRef.current = false;
      dragModeRef.current = null;
    };

    // Use document-level events during drag for better tracking
    const onDocumentMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    };

    const onDocumentUp = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
      }
      isDraggingRef.current = false;
      dragModeRef.current = null;
    };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onMove);
    document.addEventListener("mousemove", onDocumentMove);
    el.addEventListener("mouseup", onUp);
    document.addEventListener("mouseup", onDocumentUp);
    el.addEventListener("mouseleave", onUp); // Reset on leave

    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mousemove", onMove);
      document.removeEventListener("mousemove", onDocumentMove);
      el.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseup", onDocumentUp);
      el.removeEventListener("mouseleave", onUp);
    };
  }, []);

  // Apply gradient to object
  const applyGradient = useCallback(() => {
    if (!selectedObject || !canvas || selectedObject instanceof FabricImage) return;

    const width = selectedObject.width || 100;
    const height = selectedObject.height || 100;

    let gradient;

    if (fillType === 'linear') {
      const angleRad = (gradientAngle * Math.PI) / 180;
      const x1 = width / 2 + Math.cos(angleRad) * width / 2;
      const y1 = height / 2 + Math.sin(angleRad) * height / 2;
      const x2 = width / 2 - Math.cos(angleRad) * width / 2;
      const y2 = height / 2 - Math.sin(angleRad) * height / 2;

      gradient = new Gradient({
        type: 'linear',
        coords: { x1, y1, x2, y2 },
        colorStops: gradientStops.map(stop => ({
          offset: stop.offset,
          color: stop.color
        }))
      });
    } else if (fillType === 'radial') {
      gradient = new Gradient({
        type: 'radial',
        coords: {
          x1: width / 2,
          y1: height / 2,
          x2: width / 2,
          y2: height / 2,
          r1: 0,
          r2: Math.max(width, height) / 2
        },
        colorStops: gradientStops.map(stop => ({
          offset: stop.offset,
          color: stop.color
        }))
      });
    }

    if (gradient) {
      selectedObject.set({ fill: gradient });
      canvas.renderAll();
    }
  }, [selectedObject, canvas, fillType, gradientAngle, gradientStops]);

  // Apply color live to selection (only after user interaction)
  useEffect(() => {
    const { r, g, b } = hsvToRgb(hue, sat, val);
    const hex = rgbToHex(r, g, b);
    if (shouldApplyRef.current) {
      onChangeHex?.(hex);
    }

    if (!selectedObject || !canvas) return;
    // Only apply fill color to shapes and text, not images
    // Images should not have color fill applied to them - they keep their original appearance
    if (selectedObject instanceof FabricImage) {
      // Do not apply any color fill or filters to images
      // Images maintain their original appearance
      return;
    } else {
      if (shouldApplyRef.current && fillType === 'solid') {
        // Apply fill color to shapes and text only for solid fill
        selectedObject.set({ fill: hex });
        canvas.renderAll();
      }
    }
  }, [hue, sat, val, selectedObject, canvas, fillType]);

  // Apply gradient when gradient settings change
  useEffect(() => {
    if (fillType !== 'solid' && shouldApplyRef.current) {
      applyGradient();
    }
  }, [fillType, gradientStops, gradientAngle, applyGradient]);

  // Reset apply flag when selection changes
  useEffect(() => {
    shouldApplyRef.current = false;
  }, [selectedObject]);

  const { r, g, b } = hsvToRgb(hue, sat, val);
  const hex = rgbToHex(r, g, b);
  // HSL readouts for UI
  const l = val - (val * sat) / 2;
  const sHsl = l === 0 || l === 1 ? 0 : (val - l) / Math.min(l, 1 - l);

  // Generate AI-inspired color suggestions
  const generateColorSuggestions = () => {
    const suggestions = [];
    // Complementary color
    const compHue = (hue + 180) % 360;
    const comp = hsvToRgb(compHue, sat, val);
    suggestions.push({ color: rgbToHex(comp.r, comp.g, comp.b), label: "Complementary" });

    // Analogous colors
    const analog1 = hsvToRgb((hue + 30) % 360, sat, val);
    suggestions.push({ color: rgbToHex(analog1.r, analog1.g, analog1.b), label: "Analogous" });

    const analog2 = hsvToRgb((hue - 30 + 360) % 360, sat, val);
    suggestions.push({ color: rgbToHex(analog2.r, analog2.g, analog2.b), label: "Analogous" });

    // Triadic colors
    const triad1 = hsvToRgb((hue + 120) % 360, sat, val);
    suggestions.push({ color: rgbToHex(triad1.r, triad1.g, triad1.b), label: "Triadic" });

    const triad2 = hsvToRgb((hue + 240) % 360, sat, val);
    suggestions.push({ color: rgbToHex(triad2.r, triad2.g, triad2.b), label: "Triadic" });

    // Lighter and darker variations
    const lighter = hsvToRgb(hue, Math.max(0, sat - 0.2), Math.min(1, val + 0.2));
    suggestions.push({ color: rgbToHex(lighter.r, lighter.g, lighter.b), label: "Lighter" });

    const darker = hsvToRgb(hue, Math.min(1, sat + 0.1), Math.max(0, val - 0.2));
    suggestions.push({ color: rgbToHex(darker.r, darker.g, darker.b), label: "Darker" });

    return suggestions;
  };

  const colorSuggestions = generateColorSuggestions();

  return (
    <div className="px-3 py-2.5 bg-white">
      {/* Header with compact color preview and picker button */}
      <div className="flex items-center justify-between mb-2.5">
        {/* Small current color preview - left side */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded border border-slate-300 transition-all duration-200 hover:scale-110 cursor-pointer"
            style={{
              backgroundColor: fillType === 'solid' ? hex : undefined,
              backgroundImage: fillType !== 'solid'
                ? `linear-gradient(${gradientAngle}deg, ${gradientStops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`
                : undefined
            }}
            title={fillType === 'solid' ? `Current: ${hex.toUpperCase()}` : 'Gradient'}
          />
          <div>
            <div className="text-[11px] font-mono font-semibold text-slate-800">
              {fillType === 'solid' ? hex.toUpperCase() : `${fillType} gradient`}
            </div>
            {fillType === 'solid' && (
              <div className="text-[10px] text-slate-400">
                {Math.round(hue)}° {Math.round(sHsl * 100)}% {Math.round(l * 100)}%
              </div>
            )}
          </div>
        </div>

        {/* Eyedropper button - right side */}
        <button className="p-2 flex items-center justify-center border border-slate-300 rounded hover:bg-slate-50 transition-colors">
          <Pipette className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Color wheel, Hex input & Opacity - combined card */}
      <div className="mb-2.5 p-2.5 bg-[#F4F4F6] rounded-lg border border-[#E5E5E5] space-y-2.5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Droplet className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Color Picker</span>
        </div>

        {/* Color wheel */}
        <div className="flex justify-center">
          <div ref={containerRef} className="relative" style={{ width: size, height: size }}>
            <canvas ref={wheelCanvasRef} className="absolute inset-0" style={{ pointerEvents: "none" }} />
            <canvas ref={svCanvasRef} className="absolute inset-0" style={{ pointerEvents: "none" }} />
          </div>
        </div>

        {/* Hex input */}
        <div>
          <label className="block text-[11px] font-medium text-slate-700 mb-1.5">Hex Code</label>
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded border border-slate-300 hover:border-slate-400 transition-colors focus-within:border-blue-500">
            <span className="text-[11px] font-mono text-slate-500">#</span>
            <input
              value={hex.replace('#', '').toUpperCase()}
              onChange={(e) => {
                const v = `#${e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6)}`;
                const rgb = hexToRgb(v);
                if (!rgb) return;
                const { h, s, v: vv } = rgbToHsv(rgb.r, rgb.g, rgb.b);
                setHue(h);
                setSat(s);
                setVal(vv);
                shouldApplyRef.current = true;
              }}
              className="flex-1 text-[11px] font-mono font-semibold text-slate-800 outline-none bg-transparent"
              placeholder="FFFFFF"
            />
          </div>
        </div>

        {/* Opacity slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-medium text-slate-700">Opacity</label>
            <span className="text-[11px] font-mono font-medium text-slate-600">
              {selectedObject?.opacity ? Math.round(selectedObject.opacity * 100) : 100}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={selectedObject?.opacity ? Math.round(selectedObject.opacity * 100) : 100}
            onChange={(e) => {
              if (!selectedObject || !canvas) return;
              const pct = Number(e.target.value);
              selectedObject.set({ opacity: pct / 100 });
              canvas.renderAll();
            }}
            className="w-full h-2 bg-slate-200 rounded appearance-none cursor-pointer opacity-slider"
            style={{
              backgroundImage: `linear-gradient(to right, ${hex}00 0%, ${hex} 100%)`
            }}
          />
        </div>
      </div>

      {/* Project Colors - card */}
      <div className="mb-2.5 p-2.5 bg-[#F4F4F6] rounded-lg border border-[#E5E5E5]">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Project Colors</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {projectColors.map((color, idx) => (
            <button
              key={idx}
              onClick={() => {
                const rgb = hexToRgb(color);
                if (!rgb) return;
                const { h, s, v: vv } = rgbToHsv(rgb.r, rgb.g, rgb.b);
                setHue(h);
                setSat(s);
                setVal(vv);
                shouldApplyRef.current = true;
              }}
              className="aspect-square rounded border border-slate-300 hover:border-slate-400 transition-all hover:scale-105"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Fill Type Selector - card */}
      <div className="mb-2.5 p-2.5 bg-[#F4F4F6] rounded-lg border border-[#E5E5E5]">
        <div className="flex items-center gap-2 mb-2">
          <Square className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Fill Type</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(['solid', 'linear', 'radial', 'angular'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setFillType(type);
                if (type !== 'solid') {
                  applyGradient();
                }
              }}
              className={`px-2 py-1.5 text-[10px] font-medium rounded border transition-colors ${fillType === type
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Gradient Controls - shown only for gradient fill types */}
      {fillType !== 'solid' && (
        <div className="mb-2.5 p-2.5 bg-[#F4F4F6] rounded-lg border border-[#E5E5E5]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Gradient Stops</span>
            </div>
            <button
              onClick={() => {
                const newOffset = gradientStops.length > 0
                  ? (gradientStops[gradientStops.length - 1].offset + 0.5) / 1.5
                  : 0.5;
                setGradientStops([...gradientStops, { offset: Math.min(newOffset, 1), color: hex }]);
              }}
              className="p-1.5 border border-slate-300 rounded hover:bg-slate-50 transition-colors"
              title="Add stop"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>

          {/* Visual gradient preview bar */}
          <div className="mb-2.5 relative h-7 rounded border border-slate-300 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(to right, ${gradientStops
                  .sort((a, b) => a.offset - b.offset)
                  .map(s => `${s.color} ${s.offset * 100}%`)
                  .join(', ')})`
              }}
            />
            {/* Gradient stop indicators */}
            {gradientStops.map((stop, idx) => (
              <div
                key={idx}
                className={`absolute top-0 w-2 h-full cursor-pointer ${selectedStop === idx ? 'bg-blue-500' : 'bg-white'
                  } border-x border-slate-400 opacity-80 hover:opacity-100`}
                style={{ left: `calc(${stop.offset * 100}% - 4px)` }}
                onClick={() => setSelectedStop(idx)}
              />
            ))}
          </div>

          {/* Gradient angle slider for linear */}
          {fillType === 'linear' && (
            <div className="mb-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-medium text-slate-700">Angle</label>
                <span className="text-[10px] font-mono text-slate-600">{Math.round(gradientAngle)}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={gradientAngle}
                onChange={(e) => {
                  setGradientAngle(Number(e.target.value));
                  applyGradient();
                }}
                className="w-full h-2 bg-slate-200 rounded appearance-none cursor-pointer"
              />
            </div>
          )}

          {/* Gradient stops list */}
          <div className="space-y-2">
            {gradientStops.map((stop, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded border-2 cursor-pointer ${selectedStop === idx ? 'border-blue-500' : 'border-slate-300'
                    }`}
                  style={{ backgroundColor: stop.color }}
                  onClick={() => setSelectedStop(idx)}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={stop.offset * 100}
                  onChange={(e) => {
                    const newStops = [...gradientStops];
                    newStops[idx].offset = Number(e.target.value) / 100;
                    setGradientStops(newStops);
                    applyGradient();
                  }}
                  className="flex-1 h-1.5 bg-slate-200 rounded appearance-none cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-600 w-9">{Math.round(stop.offset * 100)}%</span>
                {gradientStops.length > 2 && (
                  <button
                    onClick={() => {
                      setGradientStops(gradientStops.filter((_, i) => i !== idx));
                      if (selectedStop >= gradientStops.length - 1) {
                        setSelectedStop(Math.max(0, gradientStops.length - 2));
                      }
                    }}
                    className="p-1 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Color picker for selected gradient stop */}
          <div className="mt-2.5">
            <label className="block text-[10px] font-medium text-slate-700 mb-1.5">Stop Color</label>
            <input
              type="color"
              value={gradientStops[selectedStop]?.color || '#000000'}
              onChange={(e) => {
                const newStops = [...gradientStops];
                newStops[selectedStop].color = e.target.value;
                setGradientStops(newStops);
                applyGradient();
              }}
              className="w-full h-7 rounded border border-slate-300 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Color Adjustments Section */}
      <div className="mb-2.5 p-2.5 bg-[#F4F4F6] rounded-lg border border-[#E5E5E5]">
        <div className="flex items-center gap-2 mb-2">
          <Sliders className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[12px] font-medium text-[#161616] tracking-wide leading-tight">Color Adjustments</span>
        </div>

        {/* Brightness */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium text-slate-700">Brightness</label>
            <span className="text-[10px] font-mono text-slate-600">{adjustments.brightness}</span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={adjustments.brightness}
            onChange={(e) => {
              const value = Number(e.target.value);
              setAdjustments({ ...adjustments, brightness: value });
              // Apply brightness by adjusting HSV value
              const newVal = clamp(val + value / 200, 0, 1);
              setVal(newVal);
              shouldApplyRef.current = true;
            }}
            className="w-full h-2 bg-slate-200 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Contrast */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium text-slate-700">Contrast</label>
            <span className="text-[10px] font-mono text-slate-600">{adjustments.contrast}</span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={adjustments.contrast}
            onChange={(e) => setAdjustments({ ...adjustments, contrast: Number(e.target.value) })}
            className="w-full h-2 bg-slate-200 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Saturation */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium text-slate-700">Saturation</label>
            <span className="text-[10px] font-mono text-slate-600">{adjustments.saturation}</span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={adjustments.saturation}
            onChange={(e) => {
              const value = Number(e.target.value);
              setAdjustments({ ...adjustments, saturation: value });
              // Apply saturation adjustment
              const newSat = clamp(sat + value / 100, 0, 1);
              setSat(newSat);
              shouldApplyRef.current = true;
            }}
            className="w-full h-2 bg-slate-200 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Temperature */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium text-slate-700">Temperature</label>
            <span className="text-[10px] font-mono text-slate-600">{adjustments.temperature}</span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={adjustments.temperature}
            onChange={(e) => {
              const value = Number(e.target.value);
              setAdjustments({ ...adjustments, temperature: value });
              // Apply temperature by adjusting hue (warmer = more red, cooler = more blue)
              const newHue = (hue + value / 5 + 360) % 360;
              setHue(newHue);
              shouldApplyRef.current = true;
            }}
            className="w-full h-2 bg-slate-200 rounded appearance-none cursor-pointer"
          />
        </div>

        {/* Reset adjustments button */}
        <button
          onClick={() => {
            setAdjustments({ brightness: 0, contrast: 0, saturation: 0, temperature: 0 });
          }}
          className="w-full mt-1.5 px-2 py-1.5 text-[10px] font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded hover:bg-slate-100 transition-colors"
        >
          Reset Adjustments
        </button>
      </div>

      <style jsx>{`
        .opacity-slider::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid ${hex};
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }
        .opacity-slider::-webkit-slider-thumb:hover {
          border-width: 2.5px;
        }
        .opacity-slider::-moz-range-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid ${hex};
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }
        .opacity-slider::-moz-range-thumb:hover {
          border-width: 2.5px;
        }
      `}</style>
    </div>
  );
}


