'use client';

import { useEffect, useRef } from 'react';
import { Canvas as FabricCanvas, Circle as FabricCircle, Line as FabricLine, Path as FabricPath } from 'fabric';

interface PathPoint {
  x: number;
  y: number;
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
}

interface PathEditorProps {
  canvas: FabricCanvas | null;
  path: FabricPath | null;
  isActive: boolean;
  onPointsChange: (points: PathPoint[]) => void;
  onClose: () => void;
}

export function PathEditor({ canvas, path, isActive, onPointsChange, onClose }: PathEditorProps) {
  const handlesRef = useRef<any[]>([]);
  const controlLinesRef = useRef<any[]>([]);
  const pointsRef = useRef<PathPoint[]>([]);
  const selectedPointIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragTypeRef = useRef<'point' | 'cp1' | 'cp2' | null>(null);
  const dragPointIndexRef = useRef<number | null>(null);
  const hoveredPointIndexRef = useRef<number | null>(null);

  // Parse path data to get points
  useEffect(() => {
    if (!canvas || !path || !isActive) {
      clearHandles();
      return;
    }

    // Get points from stored data or parse from path
    let points: PathPoint[] = [];
    if ((path as any).__pathPoints) {
      points = [...(path as any).__pathPoints];
    } else {
      // Parse from path data
      const pathData = path.path;
      if (Array.isArray(pathData)) {
        // Fabric.js stores path as array of commands
        let currentX = 0;
        let currentY = 0;
        for (const cmd of pathData) {
          if (cmd[0] === 'M') {
            currentX = cmd[1];
            currentY = cmd[2];
            points.push({ x: currentX, y: currentY });
          } else if (cmd[0] === 'L') {
            currentX = cmd[1];
            currentY = cmd[2];
            points.push({ x: currentX, y: currentY });
          } else if (cmd[0] === 'C') {
            // C command: [cp1x, cp1y, cp2x, cp2y, x, y]
            if (points.length > 0) {
              const prev = points[points.length - 1];
              prev.cp2x = cmd[1];
              prev.cp2y = cmd[2];
            }
            currentX = cmd[5];
            currentY = cmd[6];
            points.push({
              x: currentX,
              y: currentY,
              cp1x: cmd[3],
              cp1y: cmd[4],
            });
          }
        }
      }
    }

    pointsRef.current = points;
    renderHandles(canvas, path, points);
  }, [canvas, path, isActive]);

  const clearHandles = () => {
    if (!canvas) return;
    handlesRef.current.forEach(handle => canvas.remove(handle));
    controlLinesRef.current.forEach(line => canvas.remove(line));
    handlesRef.current = [];
    controlLinesRef.current = [];
    canvas.renderAll();
  };

  const renderHandles = (canvas: FabricCanvas, path: FabricPath, points: PathPoint[]) => {
    clearHandles();

    // Get path transform matrix to convert local coordinates to canvas coordinates
    const pathTransform = path.calcTransformMatrix();
    const pathLeft = path.left || 0;
    const pathTop = path.top || 0;

    points.forEach((point, index) => {
      // Convert path coordinates to canvas coordinates using transform matrix
      const canvasX = pathLeft + point.x;
      const canvasY = pathTop + point.y;
      
      // Anchor point handle - highlight if hovered
      const isHovered = hoveredPointIndexRef.current === index;
      const handle = new FabricCircle({
        left: canvasX,
        top: canvasY,
        radius: isHovered ? 8 : 6,
        fill: isHovered ? '#0EA5E9' : '#18A0FB',
        stroke: '#ffffff',
        strokeWidth: 2,
        selectable: false,
        evented: true,
        originX: 'center',
        originY: 'center',
        excludeFromExport: true,
      });
      (handle as any).__pointIndex = index;
      (handle as any).__handleType = 'point';
      canvas.add(handle);
      handlesRef.current.push(handle);

      // Control handles if they exist
      if (point.cp1x !== undefined && point.cp1y !== undefined) {
        const cp1CanvasX = pathLeft + point.cp1x;
        const cp1CanvasY = pathTop + point.cp1y;
        
        const cp1Handle = new FabricCircle({
          left: cp1CanvasX,
          top: cp1CanvasY,
          radius: 4,
          fill: '#FF6B6B',
          stroke: '#ffffff',
          strokeWidth: 1.5,
          selectable: false,
          evented: true,
          originX: 'center',
          originY: 'center',
          excludeFromExport: true,
        });
        (cp1Handle as any).__pointIndex = index;
        (cp1Handle as any).__handleType = 'cp1';
        canvas.add(cp1Handle);
        handlesRef.current.push(cp1Handle);

        // Control line
        const cp1Line = new FabricLine(
          [canvasX, canvasY, cp1CanvasX, cp1CanvasY],
          {
            stroke: '#999',
            strokeWidth: 1,
            strokeDashArray: [3, 3],
            selectable: false,
            evented: false,
            excludeFromExport: true,
          }
        );
        canvas.add(cp1Line);
        controlLinesRef.current.push(cp1Line);
      }

      if (point.cp2x !== undefined && point.cp2y !== undefined) {
        const cp2CanvasX = pathLeft + point.cp2x;
        const cp2CanvasY = pathTop + point.cp2y;
        
        const cp2Handle = new FabricCircle({
          left: cp2CanvasX,
          top: cp2CanvasY,
          radius: 4,
          fill: '#4ECDC4',
          stroke: '#ffffff',
          strokeWidth: 1.5,
          selectable: false,
          evented: true,
          originX: 'center',
          originY: 'center',
          excludeFromExport: true,
        });
        (cp2Handle as any).__pointIndex = index;
        (cp2Handle as any).__handleType = 'cp2';
        canvas.add(cp2Handle);
        handlesRef.current.push(cp2Handle);

        // Control line
        const cp2Line = new FabricLine(
          [canvasX, canvasY, cp2CanvasX, cp2CanvasY],
          {
            stroke: '#999',
            strokeWidth: 1,
            strokeDashArray: [3, 3],
            selectable: false,
            evented: false,
            excludeFromExport: true,
          }
        );
        canvas.add(cp2Line);
        controlLinesRef.current.push(cp2Line);
      }
    });

    canvas.renderAll();
  };

  // Helper to find closest point on path segment
  const findClosestSegment = (points: PathPoint[], x: number, y: number, pathLeft: number, pathTop: number) => {
    let minDist = Infinity;
    let closestSegmentIndex = -1;
    let closestT = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      // Convert to canvas coordinates
      const x1 = pathLeft + p1.x;
      const y1 = pathTop + p1.y;
      const x2 = pathLeft + p2.x;
      const y2 = pathTop + p2.y;
      
      // Find closest point on line segment
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lengthSq = dx * dx + dy * dy;
      
      if (lengthSq === 0) continue;
      
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSq));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
      
      if (dist < minDist && dist < 10) { // 10px threshold
        minDist = dist;
        closestSegmentIndex = i;
        closestT = t;
      }
    }
    
    return { segmentIndex: closestSegmentIndex, t: closestT };
  };

  // Mouse event handlers
  useEffect(() => {
    if (!canvas || !path || !isActive) return;

    const handleMouseDown = (opt: any) => {
      const target = opt.target;
      const pointer = canvas.getPointer(opt.e);
      
      // Check if clicking on a handle
      if (target && handlesRef.current.includes(target)) {
        isDraggingRef.current = true;
        dragTypeRef.current = (target as any).__handleType;
        dragPointIndexRef.current = (target as any).__pointIndex;
        selectedPointIndexRef.current = (target as any).__handleType === 'point' ? (target as any).__pointIndex : null;
        canvas.selection = false;
        canvas.defaultCursor = 'move';
        opt.e.preventDefault();
        return;
      }
      
      // Check if clicking on path to add a point
      if (target === path || !target) {
        const pathLeft = path.left || 0;
        const pathTop = path.top || 0;
        const pathX = pointer.x - pathLeft;
        const pathY = pointer.y - pathTop;
        
        // Find closest segment
        const { segmentIndex, t } = findClosestSegment(pointsRef.current, pointer.x, pointer.y, pathLeft, pathTop);
        
        if (segmentIndex >= 0 && t > 0.1 && t < 0.9) {
          // Add point at this position
          const p1 = pointsRef.current[segmentIndex];
          const p2 = pointsRef.current[segmentIndex + 1];
          
          // Interpolate position
          const newPoint: PathPoint = {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
          };
          
          // Insert new point
          const newPoints = [...pointsRef.current];
          newPoints.splice(segmentIndex + 1, 0, newPoint);
          pointsRef.current = newPoints;
          
          updatePath(canvas, path, newPoints);
          renderHandles(canvas, path, newPoints);
          onPointsChange(newPoints);
          opt.e.preventDefault();
        }
      }
    };

    const handleMouseMove = (opt: any) => {
      const pointer = canvas.getPointer(opt.e);
      const pathLeft = path.left || 0;
      const pathTop = path.top || 0;
      
      if (isDraggingRef.current && dragPointIndexRef.current !== null) {
        // Convert canvas coordinates to path coordinates (relative to path origin)
        const pathX = pointer.x - pathLeft;
        const pathY = pointer.y - pathTop;

        const pointIndex = dragPointIndexRef.current;
        const points = [...pointsRef.current];
        const point = points[pointIndex];

        if (dragTypeRef.current === 'point') {
          // Move anchor point
          point.x = pathX;
          point.y = pathY;
        } else if (dragTypeRef.current === 'cp1') {
          // Move control handle 1
          point.cp1x = pathX;
          point.cp1y = pathY;
        } else if (dragTypeRef.current === 'cp2') {
          // Move control handle 2
          point.cp2x = pathX;
          point.cp2y = pathY;
        }

        pointsRef.current = points;
        updatePath(canvas, path, points);
        renderHandles(canvas, path, points);
      } else {
        // Check for hover on handles
        const target = opt.target;
        let hoverChanged = false;
        if (target && handlesRef.current.includes(target) && (target as any).__handleType === 'point') {
          const newHoverIndex = (target as any).__pointIndex;
          if (hoveredPointIndexRef.current !== newHoverIndex) {
            hoveredPointIndexRef.current = newHoverIndex;
            hoverChanged = true;
          }
        } else if (hoveredPointIndexRef.current !== null) {
          hoveredPointIndexRef.current = null;
          hoverChanged = true;
        }
        
        if (hoverChanged) {
          renderHandles(canvas, path, pointsRef.current);
        }
      }
    };

    const handleMouseUp = (opt: any) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        onPointsChange(pointsRef.current);
        canvas.selection = true;
        canvas.defaultCursor = 'default';
      }
    };

    // Prevent path selection when in edit mode
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    
    // Disable path selection
    if (path) {
      path.selectable = false;
      path.evented = true; // Allow clicking on path
    }

    // Handle keyboard for deleting points
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
      
      // Delete key to remove selected point
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPointIndexRef.current !== null) {
        const points = [...pointsRef.current];
        if (points.length > 2) { // Keep at least 2 points
          points.splice(selectedPointIndexRef.current, 1);
          pointsRef.current = points;
          selectedPointIndexRef.current = null;
          updatePath(canvas, path, points);
          renderHandles(canvas, path, points);
          onPointsChange(points);
          e.preventDefault();
        }
      }
      
      // Escape to exit edit mode
      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      if (path) {
        path.selectable = true;
      }
    };
  }, [canvas, path, isActive, onPointsChange, onClose]);

  const updatePath = (canvas: FabricCanvas, path: FabricPath, points: PathPoint[]) => {
    // Convert points to SVG path string
    let pathString = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (curr.cp1x !== undefined && curr.cp1y !== undefined && 
          prev.cp2x !== undefined && prev.cp2y !== undefined) {
        pathString += ` C ${prev.cp2x} ${prev.cp2y}, ${curr.cp1x} ${curr.cp1y}, ${curr.x} ${curr.y}`;
      } else {
        pathString += ` L ${curr.x} ${curr.y}`;
      }
    }

    path.set({ path: pathString });
    (path as any).__pathPoints = points;
    path.setCoords();
    canvas.renderAll();
  };

  return null; // This component doesn't render UI, it manipulates canvas objects
}

