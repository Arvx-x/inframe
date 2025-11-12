import type { AgentAction } from "@/app/lib/agent/canvas-schema";

type FabricCanvas = any; // typed via fabric, kept any to avoid import weight here

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

type ExecutorDeps = {
  createTextbox?: (text: string, options: any) => any;
};

export function executeActions(
  fabricCanvas: FabricCanvas,
  actions: AgentAction[],
  deps?: ExecutorDeps,
): { inverseActions: AgentAction[] } {
  const inverseActions: AgentAction[] = [];
  if (!fabricCanvas || !Array.isArray(actions) || actions.length === 0) {
    return { inverseActions };
  }

  const canvasWidth = fabricCanvas.width || 0;
  const canvasHeight = fabricCanvas.height || 0;
  const objects = fabricCanvas.getObjects();

  const getObjById = (id: string) => {
    const idx = parseInt(id.replace("obj_", ""));
    return Number.isFinite(idx) ? objects[idx] : undefined;
  };

  for (const action of actions) {
    if (action.type === "move") {
      const targets = (action.objectIds && action.objectIds.length > 0)
        ? action.objectIds.map(getObjById).filter(Boolean)
        : objects;

      targets.forEach((obj: any) => {
        const prevLeft = obj.left || 0;
        const prevTop = obj.top || 0;

        const width = (obj.width || 0) * (obj.scaleX || 1);
        const height = (obj.height || 0) * (obj.scaleY || 1);

        const left = clamp(action.params.left, 0, Math.max(0, canvasWidth - width));
        const top = clamp(action.params.top, 0, Math.max(0, canvasHeight - height));

        obj.set({ left, top });
        obj.setCoords?.();

        inverseActions.push({
          type: "move",
          objectIds: [objects.indexOf(obj)].map(i => `obj_${i}`),
          params: { left: prevLeft, top: prevTop },
        } as AgentAction);
      });
    } else if (action.type === "resize") {
      (action.objectIds || []).forEach((id) => {
        const obj = getObjById(id);
        if (!obj) return;
        const prevScaleX = obj.scaleX || 1;
        const prevScaleY = obj.scaleY || 1;
        const scaleX = clamp(action.params.scaleX, 0.05, 10);
        const scaleY = clamp(action.params.scaleY, 0.05, 10);
        obj.set({ scaleX, scaleY });
        obj.setCoords?.();
        inverseActions.push({ type: "resize", objectIds: [id], params: { scaleX: prevScaleX, scaleY: prevScaleY } } as AgentAction);
      });
    } else if (action.type === "align") {
      const targets = (action.objectIds && action.objectIds.length > 0)
        ? action.objectIds.map(getObjById).filter(Boolean)
        : objects;

      targets.forEach((obj: any) => {
        const prevLeft = obj.left || 0;
        const prevTop = obj.top || 0;
        const objWidth = (obj.width || 0) * (obj.scaleX || 1);
        const objHeight = (obj.height || 0) * (obj.scaleY || 1);

        let left = prevLeft;
        let top = prevTop;
        if (action.params.horizontal === "center") left = ((canvasWidth) - objWidth) / 2;
        if (action.params.horizontal === "left") left = 20;
        if (action.params.horizontal === "right") left = (canvasWidth) - objWidth - 20;
        if (action.params.vertical === "center") top = ((canvasHeight) - objHeight) / 2;
        if (action.params.vertical === "top") top = 20;
        if (action.params.vertical === "bottom") top = (canvasHeight) - objHeight - 20;

        obj.set({ left, top });
        obj.setCoords?.();
        inverseActions.push({ type: "move", objectIds: [objects.indexOf(obj)].map(i => `obj_${i}`), params: { left: prevLeft, top: prevTop } } as AgentAction);
      });
    } else if (action.type === "add_text") {
      const text = action.params.text || "Text";
      const options = {
        fontSize: action.params.fontSize || 32,
        fontFamily: "Inter",
        fontWeight: "400",
        fill: "#111827",
        editable: true,
        left: clamp(action.params.left ?? ((canvasWidth) / 2 - 100), 0, canvasWidth),
        top: clamp(action.params.top ?? 50, 0, canvasHeight),
      };
      let textbox: any = null;
      if (deps?.createTextbox) {
        textbox = deps.createTextbox(text, options);
      } else if ((window as any)?.fabric?.Textbox) {
        // Fallback if global fabric is present
        const FallbackTextbox = (window as any).fabric.Textbox;
        textbox = new FallbackTextbox(text, options);
      }
      if (textbox) {
        fabricCanvas.add(textbox);
        textbox.setCoords?.();
        const newIndex = fabricCanvas.getObjects().length - 1;
        inverseActions.push({ type: "delete", objectIds: [`obj_${newIndex}`] } as AgentAction);
      }
    } else if (action.type === "delete") {
      (action.objectIds || []).forEach((id) => {
        const idx = parseInt(id.replace("obj_", ""));
        const obj = objects[idx];
        if (!obj) return;
        const snapshot = { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, text: (obj as any).text } as any;
        fabricCanvas.remove(obj);
        // Inverse as re-add text only (minimal). For rich objects, prefer full JSON snapshot approach in future.
        if (typeof snapshot.text === "string") {
          inverseActions.push({ type: "add_text", params: { text: snapshot.text, left: snapshot.left, top: snapshot.top, fontSize: 32 } } as AgentAction);
        }
      });
    } else if (action.type === "group") {
      const spacing = clamp(action.params?.spacing ?? 20, 0, 400);
      const targets = (action.objectIds || []).map(getObjById).filter(Boolean);
      if (targets.length === 0) continue;
      const prevPositions: Array<{ id: string; left: number; top: number }> = [];
      targets.forEach((obj: any) => {
        prevPositions.push({ id: `obj_${objects.indexOf(obj)}`, left: obj.left || 0, top: obj.top || 0 });
      });
      const sortedTargets = [...targets].sort((a: any, b: any) => (a.left || 0) - (b.left || 0));
      let currentX = sortedTargets[0].left || 0;
      const baseTop = sortedTargets[0].top || 0;
      sortedTargets.forEach((obj: any) => {
        const scaledWidth = typeof obj.getScaledWidth === 'function' ? obj.getScaledWidth() : (obj.width || 0) * (obj.scaleX || 1);
        obj.set({ left: currentX, top: baseTop });
        obj.setCoords?.();
        currentX += scaledWidth + spacing;
      });
      prevPositions.forEach((p) => {
        inverseActions.push({ type: "move", objectIds: [p.id], params: { left: p.left, top: p.top } } as AgentAction);
      });
    } else if (action.type === "set_fill") {
      (action.objectIds || []).forEach((id) => {
        const obj = getObjById(id);
        if (!obj) return;
        const prevFill = obj.fill || "#000000";
        const prevOpacity = obj.opacity ?? 1;
        obj.set({ fill: action.params.fill });
        if (action.params.opacity !== undefined) {
          obj.set({ opacity: action.params.opacity });
        }
        obj.setCoords?.();
        inverseActions.push({
          type: "set_fill",
          objectIds: [id],
          params: { fill: prevFill, opacity: prevOpacity }
        } as AgentAction);
      });
    } else if (action.type === "set_stroke") {
      (action.objectIds || []).forEach((id) => {
        const obj = getObjById(id);
        if (!obj) return;
        const prevStroke = obj.stroke || "transparent";
        const prevStrokeWidth = obj.strokeWidth || 0;
        const prevStrokeOpacity = obj.strokeOpacity ?? 1;
        obj.set({ stroke: action.params.stroke });
        if (action.params.strokeWidth !== undefined) {
          obj.set({ strokeWidth: action.params.strokeWidth });
        }
        if (action.params.strokeOpacity !== undefined) {
          obj.set({ strokeOpacity: action.params.strokeOpacity });
        }
        obj.setCoords?.();
        inverseActions.push({
          type: "set_stroke",
          objectIds: [id],
          params: { stroke: prevStroke, strokeWidth: prevStrokeWidth, strokeOpacity: prevStrokeOpacity }
        } as AgentAction);
      });
    } else if (action.type === "set_opacity") {
      (action.objectIds || []).forEach((id) => {
        const obj = getObjById(id);
        if (!obj) return;
        const prevOpacity = obj.opacity ?? 1;
        obj.set({ opacity: clamp(action.params.opacity, 0, 1) });
        obj.setCoords?.();
        inverseActions.push({
          type: "set_opacity",
          objectIds: [id],
          params: { opacity: prevOpacity }
        } as AgentAction);
      });
    } else if (action.type === "set_text_style") {
      (action.objectIds || []).forEach((id) => {
        const obj = getObjById(id);
        if (!obj || obj.type !== "textbox") return;
        const prevFill = obj.fill || "#000000";
        const prevFontSize = obj.fontSize || 32;
        const prevFontFamily = obj.fontFamily || "Inter";
        const prevFontWeight = obj.fontWeight || "400";
        const prevTextAlign = obj.textAlign || "left";
        if (action.params.fill !== undefined) obj.set({ fill: action.params.fill });
        if (action.params.fontSize !== undefined) obj.set({ fontSize: clamp(action.params.fontSize, 8, 200) });
        if (action.params.fontFamily !== undefined) obj.set({ fontFamily: action.params.fontFamily });
        if (action.params.fontWeight !== undefined) obj.set({ fontWeight: action.params.fontWeight });
        if (action.params.textAlign !== undefined) obj.set({ textAlign: action.params.textAlign });
        obj.setCoords?.();
        inverseActions.push({
          type: "set_text_style",
          objectIds: [id],
          params: {
            fill: prevFill,
            fontSize: prevFontSize,
            fontFamily: prevFontFamily,
            fontWeight: prevFontWeight,
            textAlign: prevTextAlign
          }
        } as AgentAction);
      });
    }
  }

  fabricCanvas.renderAll();
  return { inverseActions };
}


