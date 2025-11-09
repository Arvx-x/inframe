import { useEffect, useMemo, useState } from "react";
import { type Canvas as FabricCanvas, type Object as FabricObject, Group as FabricGroup, ActiveSelection as FabricActiveSelection } from "fabric";
import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, X, Layers as LayersIcon, GripVertical, Sparkles } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface LayersPanelProps {
  canvas: FabricCanvas;
  onRequestClose: () => void;
  open: boolean;
}

type LayerNode = {
  object: FabricObject;
  children?: LayerNode[];
  depth: number;
};

function getLabelForObject(obj: FabricObject): string {
  const base = (obj as any).name || obj.type || "Object";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export default function LayersPanel({ canvas, onRequestClose, open }: LayersPanelProps) {
  const [revision, setRevision] = useState(0);
  const [draggedObj, setDraggedObj] = useState<FabricObject | null>(null);
  const [dragOverObj, setDragOverObj] = useState<FabricObject | null>(null);
  const [activeTab, setActiveTab] = useState<"layers" | "inspo">("layers");

  useEffect(() => {
    const rerender = () => setRevision((n) => n + 1);
    const sub = () => {
      canvas.on("object:added", rerender);
      canvas.on("object:removed", rerender);
      canvas.on("object:modified", rerender);
      canvas.on("selection:created", rerender);
      canvas.on("selection:updated", rerender);
      canvas.on("selection:cleared", rerender);
    };
    sub();
    return () => {
      canvas.off("object:added", rerender);
      canvas.off("object:removed", rerender);
      canvas.off("object:modified", rerender);
      canvas.off("selection:created", rerender);
      canvas.off("selection:updated", rerender);
      canvas.off("selection:cleared", rerender);
    };
  }, [canvas]);

  useEffect(() => {
    // ensure a refresh when panel opens
    if (open) setRevision((n) => n + 1);
  }, [open]);

  const layers = useMemo<LayerNode[]>(() => {
    const toNode = (obj: FabricObject, depth: number): LayerNode => {
      if (obj instanceof FabricGroup) {
        const inner = (obj as any)._objects as FabricObject[] | undefined;
        return {
          object: obj,
          depth,
          children: (inner || []).map((o) => toNode(o, depth + 1)).reverse(),
        };
      }
      return { object: obj, depth };
    };
    const objects = canvas.getObjects();
    // Top-most first
    return [...objects].reverse().map((o) => toNode(o, 0));
  }, [canvas, revision]);

  const selectObject = (obj: FabricObject) => {
    canvas.discardActiveObject();
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
  };

  const toggleVisible = (obj: FabricObject) => {
    const newVisibility = !obj.visible;
    obj.set('visible', newVisibility);
    
    // If it's a group, toggle visibility of all children too
    if (obj instanceof FabricGroup) {
      const items = (obj as any)._objects as FabricObject[];
      if (items) {
        items.forEach(item => {
          item.set('visible', newVisibility);
        });
      }
    }
    
    canvas.requestRenderAll();
    setRevision(prev => prev + 1); // Force re-render to update icon
  };

  const toggleLock = (obj: FabricObject) => {
    obj.selectable = !obj.selectable;
    (obj as any).evented = !!obj.selectable;
    canvas.requestRenderAll();
  };

  const bringToFront = (obj: FabricObject) => {
    (canvas as any).bringObjectToFront(obj);
    canvas.fire('object:modified', { target: obj } as any);
    canvas.requestRenderAll();
  };
  const sendToBack = (obj: FabricObject) => {
    (canvas as any).sendObjectToBack(obj);
    canvas.fire('object:modified', { target: obj } as any);
    canvas.requestRenderAll();
  };
  const bringForward = (obj: FabricObject) => {
    (canvas as any).bringObjectForward(obj);
    canvas.fire('object:modified', { target: obj } as any);
    canvas.requestRenderAll();
  };
  const sendBackward = (obj: FabricObject) => {
    (canvas as any).sendObjectBackwards(obj);
    canvas.fire('object:modified', { target: obj } as any);
    canvas.requestRenderAll();
  };

  const active = canvas.getActiveObject();
  const canUngroup = !!active && active instanceof FabricGroup;
  const canGroup = !canUngroup && canvas.getActiveObjects().length > 1;

  const handleGroup = () => {
    const many = canvas.getActiveObjects();
    if (many.length > 1) {
      // Remove objects from canvas
      many.forEach(obj => canvas.remove(obj));
      
      // Create group
      const group = new FabricGroup(many, {
        canvas: canvas
      } as any);
      
      // Name the group
      const existingGroups = canvas.getObjects().filter((obj: FabricObject) => 
        obj instanceof FabricGroup && (obj as any).name?.startsWith('Group')
      );
      const groupNumber = existingGroups.length;
      (group as any).name = `Group ${groupNumber + 1}`;
      
      // Add group to canvas
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: group } as any);
    }
  };

  const handleUngroup = () => {
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
      canvas.remove(group);
      
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
        canvas.add(item);
      });
      
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: items[0] } as any);
    }
  };

  const handleDragStart = (e: React.DragEvent, obj: FabricObject) => {
    e.stopPropagation();
    setDraggedObj(obj);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, obj: FabricObject) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedObj && draggedObj !== obj) {
      setDragOverObj(obj);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDragOverObj(null);
  };

  const handleDrop = (e: React.DragEvent, targetObj: FabricObject) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedObj || draggedObj === targetObj) {
      setDraggedObj(null);
      setDragOverObj(null);
      return;
    }

    const objects = canvas.getObjects();
    const draggedIdx = objects.indexOf(draggedObj);
    const targetIdx = objects.indexOf(targetObj);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedObj(null);
      setDragOverObj(null);
      return;
    }

    // Move dragged object to target position
    canvas.remove(draggedObj);
    canvas.insertAt(draggedIdx < targetIdx ? targetIdx : targetIdx, draggedObj);
    canvas.fire('object:modified', { target: draggedObj } as any);
    canvas.requestRenderAll();

    setDraggedObj(null);
    setDragOverObj(null);
  };

  const handleDragEnd = () => {
    setDraggedObj(null);
    setDragOverObj(null);
  };

  const renderNode = (node: LayerNode) => {
    const obj = node.object;
    const isGroup = obj instanceof FabricGroup;
    const isActive = active === obj;
    const isDragging = draggedObj === obj;
    const isDragOver = dragOverObj === obj;
    return (
      <div key={(obj as any).__uid || `${obj.type}-${(obj as any).id || Math.random()}`} className="w-full">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, obj)}
          onDragOver={(e) => handleDragOver(e, obj)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, obj)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-move hover:bg-[#F3F4F6] ${isActive ? "bg-[#EEF2FF] border border-[#E0E7FF]" : ""} ${isDragging ? "opacity-50" : ""} ${isDragOver ? "border-t-2 border-t-[#18A0FB]" : ""}`}
          style={{ paddingLeft: 8 + node.depth * 16 }}
          onClick={() => selectObject(obj)}
        >
          <GripVertical className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
          <button className="p-1 rounded hover:bg-[#E5E7EB]" onClick={(e) => { e.stopPropagation(); toggleVisible(obj); }} aria-label="Toggle visibility">
            {obj.visible !== false ? <Eye className="w-4 h-4 text-[#6B7280]" /> : <EyeOff className="w-4 h-4 text-[#6B7280]" />}
          </button>
          <button className="p-1 rounded hover:bg-[#E5E7EB]" onClick={(e) => { e.stopPropagation(); toggleLock(obj); }} aria-label="Toggle lock">
            {obj.selectable !== false ? <Unlock className="w-4 h-4 text-[#6B7280]" /> : <Lock className="w-4 h-4 text-[#6B7280]" />}
          </button>
          <span className="text-xs text-[#111827] flex-1 truncate">{isGroup ? ((obj as any).name || "Group") : getLabelForObject(obj)}</span>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded hover:bg-[#E5E7EB]" onClick={(e) => { e.stopPropagation(); bringForward(obj); }} aria-label="Up">
              <ChevronUp className="w-4 h-4 text-[#6B7280]" />
            </button>
            <button className="p-1 rounded hover:bg-[#E5E7EB]" onClick={(e) => { e.stopPropagation(); sendBackward(obj); }} aria-label="Down">
              <ChevronDown className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>
        </div>
        {node.children && node.children.length > 0 && (
          <div className="mt-1">
            {node.children.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  const translateClass = open ? "translate-x-0" : "-translate-x-full pointer-events-none";

  // Sample inspiration images - in a real app, these would come from an API or database
  const inspirationImages = [
    { id: 1, url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&h=200&fit=crop", title: "Modern Design" },
    { id: 2, url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&h=200&fit=crop", title: "Creative Layout" },
    { id: 3, url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&h=200&fit=crop", title: "Minimalist Style" },
    { id: 4, url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&h=200&fit=crop", title: "Bold Colors" },
    { id: 5, url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&h=200&fit=crop", title: "Typography Focus" },
    { id: 6, url: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200&h=200&fit=crop", title: "Clean Design" },
  ];

  return (
    <div className={`fixed top-12 left-0 bottom-0 z-[80] w-[256px] border-r border-[#E5E7EB] bg-white shadow-lg flex flex-col transform transition-transform duration-300 ${translateClass}`}>
      <div className="border-b border-[#E5E7EB]">
        <div className="h-10 px-3 flex items-center justify-between">
          <div className="flex items-center gap-0 h-full">
            <button
              onClick={() => setActiveTab("layers")}
              className={cn(
                "px-3 h-full text-xs font-semibold transition-colors flex items-center",
                activeTab === "layers"
                  ? "text-[#161616]"
                  : "text-[#9CA3AF] hover:text-[#161616]"
              )}
            >
              Layers
            </button>
            <button
              onClick={() => setActiveTab("inspo")}
              className={cn(
                "px-3 h-full text-xs font-semibold transition-colors flex items-center",
                activeTab === "inspo"
                  ? "text-[#161616]"
                  : "text-[#9CA3AF] hover:text-[#161616]"
              )}
            >
              Inspo
            </button>
          </div>
          <button className="p-1 rounded hover:bg-[#F3F4F6]" onClick={onRequestClose} aria-label="Close layers">
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto overflow-x-hidden">
        {activeTab === "layers" && (
          <>
            <div className="px-2 py-2 flex items-center gap-2 border-b border-[#E5E7EB]">
              <button
                className={`h-7 px-2 text-xs rounded border ${canGroup ? "bg-[#111827] text-white border-[#111827]" : "bg-[#F3F4F6] text-[#9CA3AF] border-[#E5E7EB] cursor-not-allowed"}`}
                disabled={!canGroup}
                onClick={handleGroup}
              >
                Group
              </button>
              <button
                className={`h-7 px-2 text-xs rounded border ${canUngroup ? "bg-white text-[#111827] border-[#E5E7EB] hover:bg-[#F9FAFB]" : "bg-[#F3F4F6] text-[#9CA3AF] border-[#E5E7EB] cursor-not-allowed"}`}
                disabled={!canUngroup}
                onClick={handleUngroup}
              >
                Ungroup
              </button>
            </div>
            <div className="p-2 space-y-1">
              {layers.length === 0 ? (
                <div className="text-xs text-[#6B7280] px-2 py-6 text-center">No layers</div>
              ) : (
                layers.map((node) => renderNode(node))
              )}
            </div>
          </>
        )}

        {activeTab === "inspo" && (
          <div className="p-3">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6B7280]" />
              <span className="text-xs font-medium text-[#111827]">Inspiration</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {inspirationImages.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-square rounded border border-[#E5E7EB] overflow-hidden hover:border-blue-500 transition-colors cursor-pointer"
                >
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image fails to load
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23F3F4F6' width='200' height='200'/%3E%3Ctext fill='%239CA3AF' font-family='sans-serif' font-size='14' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-white truncate block">{img.title}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <p className="text-xs text-[#6B7280] mb-2">Browse design inspiration</p>
              <button className="h-7 px-3 text-xs rounded border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] transition-colors">
                Load More
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


