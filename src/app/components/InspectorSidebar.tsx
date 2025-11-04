import { useEffect, useState, useRef } from "react";
import { Copy, Trash2, Lock, MoreHorizontal, FlipHorizontal, FlipVertical, ChevronLeft, RotateCw, RotateCcw, Undo, Redo, HelpCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/utils";
import { FabricObject, FabricImage, Textbox as FabricTextbox, Rect as FabricRect, Circle as FabricCircle, Line as FabricLine } from "fabric";
import { Properties } from "@/app/components/Properties";
import { Shapes } from "@/app/components/Shapes";

interface InspectorSidebarProps {
  selectedObject: FabricObject | null;
  canvas: any;
  onClose: () => void;
  isClosing?: boolean;
}

export const InspectorSidebar = ({ selectedObject, canvas, onClose, isClosing = false }: InspectorSidebarProps) => {
  const [properties, setProperties] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    opacity: 100,
    fill: "#000000",
    stroke: "#000000",
    strokeWidth: 0,
    strokePosition: "inside",
    cornerRadius: 0,
    radius: 0,
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: "400",
    textAlign: "left",
    lineHeight: 1.2,
    letterSpacingPx: 0,
  });

  const [activeTab, setActiveTab] = useState<"tools" | "adjustments" | "properties">("properties");
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [cropRatio, setCropRatio] = useState("default");
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Handle sidebar resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(200, Math.min(600, newWidth));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!selectedObject) return;

    const updateProperties = () => {
      const obj = selectedObject;
      const width = obj.getScaledWidth() || 0;
      const height = obj.getScaledHeight() || 0;

      setProperties({
        x: Math.round(obj.left || 0),
        y: Math.round(obj.top || 0),
        width: Math.round(width),
        height: Math.round(height),
        rotation: Math.round(obj.angle || 0),
        opacity: Math.round((obj.opacity || 1) * 100),
        fill: obj.fill?.toString() || "#000000",
        stroke: obj.stroke?.toString() || "#000000",
        strokeWidth: obj.strokeWidth || 0,
        strokePosition: (obj as any).strokePosition || "inside",
        cornerRadius: (obj as any).rx || 0,
        radius: (obj as FabricCircle).radius || 0,
        fontSize: (obj as FabricTextbox).fontSize || 16,
        fontFamily: (obj as FabricTextbox).fontFamily || "Inter",
        fontWeight: (obj as FabricTextbox).fontWeight?.toString() || "400",
        textAlign: (obj as FabricTextbox).textAlign || "left",
        lineHeight: (obj as FabricTextbox).lineHeight || 1.2,
        letterSpacingPx: (() => {
          const fs = (obj as FabricTextbox).fontSize || 16;
          const cs = (obj as FabricTextbox).charSpacing || 0; // fabric: thousandths of em
          return Math.round((cs / 1000) * fs);
        })(),
      });

      if (lockAspectRatio) {
        setAspectRatio(width / height);
      }
    };

    updateProperties();

    const handleModified = () => updateProperties();
    const handleScaling = () => updateProperties();
    const handleRotating = () => updateProperties();
    const handleMoving = () => updateProperties();

    selectedObject.on('modified', handleModified);
    selectedObject.on('scaling', handleScaling);
    selectedObject.on('rotating', handleRotating);
    selectedObject.on('moving', handleMoving);

    return () => {
      selectedObject.off('modified', handleModified);
      selectedObject.off('scaling', handleScaling);
      selectedObject.off('rotating', handleRotating);
      selectedObject.off('moving', handleMoving);
    };
  }, [selectedObject, lockAspectRatio]);

  const updateObject = (updates: Partial<typeof properties>) => {
    if (!selectedObject || !canvas) return;

    if (updates.x !== undefined) selectedObject.set({ left: updates.x });
    if (updates.y !== undefined) selectedObject.set({ top: updates.y });
    
    if (updates.width !== undefined) {
      const currentWidth = selectedObject.getScaledWidth();
      const scale = updates.width / (selectedObject.width || 1);
      selectedObject.set({ scaleX: scale });
      
      if (lockAspectRatio) {
        const newHeight = updates.width / aspectRatio;
        const scaleY = newHeight / (selectedObject.height || 1);
        selectedObject.set({ scaleY });
        setProperties(prev => ({ ...prev, height: Math.round(newHeight) }));
      }
    }
    
    if (updates.height !== undefined && !lockAspectRatio) {
      const scale = updates.height / (selectedObject.height || 1);
      selectedObject.set({ scaleY: scale });
    }
    
    if (updates.rotation !== undefined) selectedObject.set({ angle: updates.rotation });
    if (updates.opacity !== undefined) selectedObject.set({ opacity: updates.opacity / 100 });
    if (updates.fill !== undefined) selectedObject.set({ fill: updates.fill });
    if (updates.stroke !== undefined) selectedObject.set({ stroke: updates.stroke });
    if (updates.strokeWidth !== undefined) selectedObject.set({ strokeWidth: updates.strokeWidth });
    if (updates.strokePosition !== undefined) selectedObject.set({ strokePosition: updates.strokePosition });
    if (updates.cornerRadius !== undefined && (selectedObject instanceof FabricRect)) {
      selectedObject.set({ rx: updates.cornerRadius, ry: updates.cornerRadius });
    }
    
    if (updates.radius !== undefined && (selectedObject instanceof FabricCircle)) {
      const scale = updates.radius / ((selectedObject as FabricCircle).radius || 1);
      selectedObject.set({ scaleX: scale, scaleY: scale });
    }
    
    if (selectedObject instanceof FabricTextbox) {
      if (updates.fontSize !== undefined) selectedObject.set({ fontSize: updates.fontSize });
      if (updates.fontFamily !== undefined) selectedObject.set({ fontFamily: updates.fontFamily });
      if (updates.fontWeight !== undefined) selectedObject.set({ fontWeight: updates.fontWeight });
      if (updates.textAlign !== undefined) selectedObject.set({ textAlign: updates.textAlign as any });
      if (updates.lineHeight !== undefined) selectedObject.set({ lineHeight: updates.lineHeight });
      if (updates.letterSpacingPx !== undefined) {
        const fs = updates.fontSize !== undefined ? updates.fontSize : (selectedObject.fontSize || 16);
        const px = updates.letterSpacingPx;
        const charSpacing = Math.round(((px || 0) / fs) * 1000);
        selectedObject.set({ charSpacing });
      }
    }

    canvas.renderAll();
    setProperties(prev => ({ ...prev, ...updates }));
  };

  const handleDuplicate = () => {
    if (!selectedObject || !canvas) return;
    selectedObject.clone().then((cloned: FabricObject) => {
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
    });
  };

  const handleDelete = () => {
    if (!selectedObject || !canvas) return;
    canvas.remove(selectedObject);
    canvas.renderAll();
    onClose();
  };

  const handleFlipX = () => {
    if (!selectedObject || !canvas) return;
    selectedObject.set({ flipX: !selectedObject.flipX });
    canvas.renderAll();
  };

  const handleFlipY = () => {
    if (!selectedObject || !canvas) return;
    selectedObject.set({ flipY: !selectedObject.flipY });
    canvas.renderAll();
  };

  const handleCropRatioChange = (ratio: string) => {
    setCropRatio(ratio);
    if (!selectedObject || !canvas) return;

    if (ratio === "default") {
      // Remove aspect ratio constraint
      selectedObject.set({ lockUniScaling: false });
      setLockAspectRatio(false);
    } else {
      // Parse ratio and apply aspect ratio constraint
      const [widthRatio, heightRatio] = ratio.split(':').map(Number);
      const targetRatio = widthRatio / heightRatio;
      
      // Calculate new dimensions maintaining aspect ratio
      const currentWidth = selectedObject.getScaledWidth();
      const currentHeight = selectedObject.getScaledHeight();
      const currentRatio = currentWidth / currentHeight;
      
      let newWidth = currentWidth;
      let newHeight = currentHeight;
      
      if (currentRatio > targetRatio) {
        // Current is wider than target, adjust width
        newWidth = currentHeight * targetRatio;
      } else {
        // Current is taller than target, adjust height
        newHeight = currentWidth / targetRatio;
      }
      
      // Apply the new dimensions
      const scaleX = newWidth / (selectedObject.width || 1);
      const scaleY = newHeight / (selectedObject.height || 1);
      
      selectedObject.set({ 
        scaleX, 
        scaleY,
        lockUniScaling: true 
      });
      
      setLockAspectRatio(true);
      setAspectRatio(targetRatio);
    }
    
    canvas.renderAll();
  };

  // Only show for images and shapes
  const isImage = selectedObject instanceof FabricImage;
  const isRect = selectedObject instanceof FabricRect;
  const isCircle = selectedObject instanceof FabricCircle;
  const isLine = selectedObject instanceof FabricLine;
  const isShape = isRect || isCircle || isLine;
  
  if (!selectedObject || (!isImage && !isShape)) return null;

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "fixed top-12 right-0 bg-[#F7F7F7] border-l border-[#E5E5E5] z-50 flex flex-col transition-all duration-300 ease-in-out shadow-lg",
        isResizing && "transition-none"
      )}
      style={{ 
        height: 'calc(100vh - 48px)',
        width: `${sidebarWidth}px`,
        transform: 'translateX(0)',
        animation: isClosing ? 'slideOutToRight 0.3s ease-in forwards' : 'slideInFromRight 0.3s ease-out'
      }}
    >
      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/40 transition-colors z-10"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      />
      
      {/* Content */}
      {isImage ? (
        <Properties 
          selectedObject={selectedObject}
          canvas={canvas}
          properties={properties}
          updateObject={updateObject}
          cropRatio={cropRatio}
          handleCropRatioChange={handleCropRatioChange}
        />
      ) : (
        <Shapes
          selectedObject={selectedObject}
          canvas={canvas}
          properties={properties}
          updateObject={updateObject}
        />
      )}

    </div>
  );
};
