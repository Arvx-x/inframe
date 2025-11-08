"use client";

import { useEffect, useRef, useState } from "react";
import { FabricObject, Image as FabricImage, Textbox as FabricTextbox, filters } from "fabric";
import { Pipette } from "lucide-react";

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
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
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
  const size = 140; // overall size
  const ringWidth = 12; // hue ring
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const svCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragModeRef = useRef<'ring' | 'triangle' | null>(null);

  const init = hexToRgb(initialColor);
  const initHsv = rgbToHsv(init.r, init.g, init.b);
  const [hue, setHue] = useState<number>(initHsv.h);
  const [sat, setSat] = useState<number>(initHsv.s);
  const [val, setVal] = useState<number>(initHsv.v);
  const hueRef = useRef<number>(initHsv.h);

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

  // Apply color live to selection
  useEffect(() => {
    const { r, g, b } = hsvToRgb(hue, sat, val);
    const hex = rgbToHex(r, g, b);
    onChangeHex?.(hex);

    if (!selectedObject || !canvas) return;
    // Only apply fill color to shapes and text, not images
    // Images should not have color fill applied to them - they keep their original appearance
    if (selectedObject instanceof FabricImage) {
      // Do not apply any color fill or filters to images
      // Images maintain their original appearance
      return;
    } else {
      // Apply fill color to shapes and text
      selectedObject.set({ fill: hex });
      canvas.renderAll();
    }
  }, [hue, sat, val, selectedObject, canvas]);

  const { r, g, b } = hsvToRgb(hue, sat, val);
  const hex = rgbToHex(r, g, b);
  // HSL readouts for UI
  const l = val - (val * sat) / 2;
  const sHsl = l === 0 || l === 1 ? 0 : (val - l) / Math.min(l, 1 - l);

  return (
    <div className="px-3 pt-1.5 pb-1 border-b border-[#E5E5E5] bg-white">
      {/* Header row mimicking inspector style */}
      <div className="flex items-center justify-between mb-1.5">
        <button className="w-5 h-5 flex items-center justify-center border border-[#CFCFCF] rounded hover:bg-[#F0F0F0] transition-colors">
          <Pipette className="w-3.5 h-3.5 text-[#6E6E6E]" />
        </button>
        <div className="w-5 h-5 rounded border border-[#CFCFCF]" style={{ backgroundColor: hex }} />
      </div>

      <div ref={containerRef} className="relative mx-auto" style={{ width: size, height: size }}>
        <canvas ref={wheelCanvasRef} className="absolute inset-0" style={{ pointerEvents: "none" }} />
        <canvas ref={svCanvasRef} className="absolute inset-0" style={{ pointerEvents: "none" }} />
      </div>

      {/* HSL and Hex row - side by side */}
      <div className="flex items-start justify-between" style={{ marginTop: '6px' }}>
        {/* H S L readouts - left side */}
        <div className="grid grid-cols-1 gap-0 text-[10px] text-[#161616] leading-tight" style={{ marginTop: '-16px' }}>
          <div>H: {Math.round(hue)}</div>
          <div>S: {Math.round(sHsl * 100)}</div>
          <div>L: {Math.round(l * 100)}</div>
        </div>

        {/* Hex input - right side */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#6E6E6E]">#:</span>
          <input
            value={hex.replace('#','').toUpperCase()}
            onChange={(e) => {
              const v = `#${e.target.value.replace(/[^0-9A-Fa-f]/g,'').slice(0,6)}`;
              const rgb = hexToRgb(v);
              const { h, s, v: vv } = rgbToHsv(rgb.r, rgb.g, rgb.b);
              setHue(h);
              setSat(s);
              setVal(vv);
            }}
            className="h-5 w-20 text-[10px] font-mono border border-[#E5E5E5] rounded px-1 bg-white text-[#161616]"
          />
        </div>
      </div>

      {/* Opacity slider */}
      <div style={{ marginTop: '6px' }}>
        <div className="text-[10px] text-[#161616] mb-0.5">Opacity</div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-full border border-[#CFCFCF] bg-white" />
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
            className="flex-1 h-1.5 bg-[linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_50%,#ccc_50%,#ccc_75%,transparent_75%,transparent)] bg-[length:8px_8px] rounded appearance-none"
          />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#161616]">
              {selectedObject?.opacity ? Math.round(selectedObject.opacity * 100) : 100} %
            </span>
            <svg className="w-3 h-3 text-[#6E6E6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}


