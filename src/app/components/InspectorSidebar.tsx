import { useEffect, useState, useRef } from "react";
import { Copy, Trash2, Lock, MoreHorizontal, FlipHorizontal, FlipVertical, ChevronLeft, RotateCw, Undo, Redo } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Slider } from "@/app/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Separator } from "@/app/components/ui/separator";
import { cn } from "@/app/lib/utils";
import { FabricObject, FabricImage, Textbox as FabricTextbox, Rect as FabricRect, Circle as FabricCircle } from "fabric";

interface InspectorSidebarProps {
  selectedObject: FabricObject | null;
  canvas: any;
  onClose: () => void;
}

export const InspectorSidebar = ({ selectedObject, canvas, onClose }: InspectorSidebarProps) => {
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
    cornerRadius: 0,
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: "400",
    textAlign: "left",
    lineHeight: 1.2,
    letterSpacingPx: 0,
  });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
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
        cornerRadius: (obj as any).rx || 0,
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
    if (updates.cornerRadius !== undefined && (selectedObject instanceof FabricRect)) {
      selectedObject.set({ rx: updates.cornerRadius, ry: updates.cornerRadius });
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

  if (!selectedObject) return null;

  const isImage = selectedObject instanceof FabricImage;
  const isText = selectedObject instanceof FabricTextbox;
  const isRect = selectedObject instanceof FabricRect;
  const isCircle = selectedObject instanceof FabricCircle;
  const isShape = isRect || isCircle;

  const elementType = isImage ? "Image" : isText ? "Text" : isShape ? "Shape" : "Object";

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "fixed top-0 right-0 h-screen bg-background/95 backdrop-blur-sm border-l border-border z-50 flex flex-col",
        isCollapsed && "w-12",
        isResizing && "transition-none",
        !isResizing && !isCollapsed && "transition-all duration-200 ease-in-out"
      )}
      style={{ 
        boxShadow: "0 0 16px rgba(0,0,0,0.06)",
        width: isCollapsed ? undefined : `${sidebarWidth}px`
      }}
    >
      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors z-10"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        />
      )}
      {isCollapsed ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="m-2"
        >
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </Button>
      ) : (
        <>
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-muted rounded flex items-center justify-center text-xs">
                {elementType[0]}
              </div>
              <div>
                <div className="text-sm font-medium">{elementType}</div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(properties.width)} × {Math.round(properties.height)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleDuplicate}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(true)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Transform */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Transform</h3>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">X</Label>
                  <Input
                    type="number"
                    value={properties.x}
                    onChange={(e) => updateObject({ x: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Y</Label>
                  <Input
                    type="number"
                    value={properties.y}
                    onChange={(e) => updateObject({ y: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">W</Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={() => setLockAspectRatio(!lockAspectRatio)}
                    >
                      <Lock className={cn("h-3 w-3", lockAspectRatio ? "text-primary" : "text-muted-foreground")} />
                    </Button>
                  </div>
                  <Input
                    type="number"
                    value={properties.width}
                    onChange={(e) => updateObject({ width: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">H</Label>
                  <Input
                    type="number"
                    value={properties.height}
                    onChange={(e) => updateObject({ height: Number(e.target.value) })}
                    className="h-8 text-xs"
                    disabled={lockAspectRatio}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Rotation</Label>
                <Input
                  type="number"
                  value={properties.rotation}
                  onChange={(e) => updateObject({ rotation: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={handleFlipX}>
                  <FlipHorizontal className="h-3 w-3 mr-1" />
                  Flip X
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={handleFlipY}>
                  <FlipVertical className="h-3 w-3 mr-1" />
                  Flip Y
                </Button>
              </div>
            </div>

            <Separator />

            {/* Fill & Stroke */}
            {!isImage && (
              <>
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fill & Stroke</h3>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Fill Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={properties.fill}
                        onChange={(e) => updateObject({ fill: e.target.value })}
                        className="h-8 w-12 p-1"
                      />
                      <Input
                        type="text"
                        value={properties.fill}
                        onChange={(e) => updateObject({ fill: e.target.value })}
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Opacity</Label>
                    <Slider
                      value={[properties.opacity]}
                      onValueChange={([value]) => updateObject({ opacity: value })}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-xs text-right text-muted-foreground">{properties.opacity}%</div>
                  </div>

                  {isShape && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Stroke Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={properties.stroke}
                            onChange={(e) => updateObject({ stroke: e.target.value })}
                            className="h-8 w-12 p-1"
                          />
                          <Input
                            type="text"
                            value={properties.stroke}
                            onChange={(e) => updateObject({ stroke: e.target.value })}
                            className="h-8 text-xs flex-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Stroke Width</Label>
                        <Input
                          type="number"
                          value={properties.strokeWidth}
                          onChange={(e) => updateObject({ strokeWidth: Number(e.target.value) })}
                          className="h-8 text-xs"
                          min={0}
                        />
                      </div>

                      {isRect && (
                        <div className="space-y-1">
                          <Label className="text-xs">Corner Radius</Label>
                          <Input
                            type="number"
                            value={properties.cornerRadius}
                            onChange={(e) => updateObject({ cornerRadius: Number(e.target.value) })}
                            className="h-8 text-xs"
                            min={0}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                <Separator />
              </>
            )}

            {/* Typography */}
            {isText && (
              <>
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Typography</h3>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Font Family</Label>
                    <Select value={properties.fontFamily} onValueChange={(value) => updateObject({ fontFamily: value })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inter">Inter</SelectItem>
                        <SelectItem value="Roboto">Roboto</SelectItem>
                        <SelectItem value="Poppins">Poppins</SelectItem>
                        <SelectItem value="Montserrat">Montserrat</SelectItem>
                        <SelectItem value="Lato">Lato</SelectItem>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Georgia">Georgia</SelectItem>
                        <SelectItem value="Courier New">Courier New</SelectItem>
                        <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Size</Label>
                      <Input
                        type="number"
                        value={properties.fontSize}
                        onChange={(e) => updateObject({ fontSize: Number(e.target.value) })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Weight</Label>
                      <Select value={properties.fontWeight} onValueChange={(value) => updateObject({ fontWeight: value })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="300">Light</SelectItem>
                          <SelectItem value="400">Regular</SelectItem>
                          <SelectItem value="500">Medium</SelectItem>
                          <SelectItem value="600">Semibold</SelectItem>
                          <SelectItem value="700">Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Alignment</Label>
                    <Select value={properties.textAlign} onValueChange={(value) => updateObject({ textAlign: value })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                        <SelectItem value="justify">Justify</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Line Height</Label>
                      <Input
                        type="number"
                        step="0.05"
                        min="0.5"
                        value={properties.lineHeight}
                        onChange={(e) => updateObject({ lineHeight: Number(e.target.value) })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Letter Spacing (px)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={properties.letterSpacingPx}
                        onChange={(e) => updateObject({ letterSpacingPx: Number(e.target.value) })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Text Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={properties.fill}
                        onChange={(e) => updateObject({ fill: e.target.value })}
                        className="h-8 w-12 p-1"
                      />
                      <Input
                        type="text"
                        value={properties.fill}
                        onChange={(e) => updateObject({ fill: e.target.value })}
                        className="h-8 text-xs flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Opacity</Label>
                    <Slider
                      value={[properties.opacity]}
                      onValueChange={([value]) => updateObject({ opacity: value })}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-xs text-right text-muted-foreground">{properties.opacity}%</div>
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* Image-specific opacity */}
            {isImage && (
              <>
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Appearance</h3>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Opacity</Label>
                    <Slider
                      value={[properties.opacity]}
                      onValueChange={([value]) => updateObject({ opacity: value })}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-xs text-right text-muted-foreground">{properties.opacity}%</div>
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* AI Suggestions */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Suggestions</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="text-xs">
                  Match palette
                </Button>
                <Button variant="outline" size="sm" className="text-xs">
                  Balance spacing
                </Button>
                {isText && (
                  <Button variant="outline" size="sm" className="text-xs">
                    Suggest fonts
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
