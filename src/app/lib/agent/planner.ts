import { z } from "zod";
import { AgentResponse } from "@/app/lib/agent/canvas-schema";

type RunOptions = {
  command: string;
  canvasState: any;
  modelHint?: "flash" | "pro";
  onEvent?: (evt: { type: "progress" | "tool" | "done"; data: any }) => void;
  memory?: any;
};


export async function runCanvasAgent(opts: RunOptions) {
  const { command, canvasState, onEvent, memory } = opts;
  const plan: any[] = [];

  const toBool = (v: any) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v.toLowerCase() === "true";
    return false;
  };
  const deriveActiveArtboardId = () => {
    const fromSummary = (canvasState as any)?.summary?.activeArtboardIds?.[0];
    if (fromSummary) return fromSummary;
    const first = (canvasState?.artboards || [])[0]?.id;
    return first || null;
  };
  const getTargetIds = (hint: Record<string, string>) => {
    const selected = (canvasState?.selectedObjectIds || []) as string[];
    const objects = (canvasState?.objects || []) as any[];
    const artboards = (canvasState?.artboards || []) as any[];
    const includeArtboard = toBool(hint.includeArtboard);
    const target = hint.target || "";
    if (target === "selection" && selected.length > 0) {
      return selected.slice();
    }
    const activeAbId = deriveActiveArtboardId();
    if ((target === "artboard" || !target) && activeAbId) {
      const ab = artboards.find((a: any) => a.id === activeAbId);
      if (ab) {
        const ids = ab.objectIds.slice();
        if (includeArtboard) ids.unshift(ab.id);
        return ids;
      }
    }
    // Fallback: all non-artboard objects
    return objects.filter((o: any) => !o.isArtboard).map((o: any) => o.id);
  };

  // Parse optional scope hint like: [target=artboard,includeArtboard=true] Actual command...
  let raw = command || "";
  let targetingHint = "";
  const scopeMatch = raw.match(/^\s*\[([^\]]+)\]\s*/);
  if (scopeMatch) {
    targetingHint = scopeMatch[1] || "";
    raw = raw.slice(scopeMatch[0].length);
  }
  const parsedHint: Record<string, string> = {};
  if (targetingHint) {
    targetingHint.split(",").forEach((pair) => {
      const [k, v] = pair.split("=").map((s) => (s || "").trim());
      if (k) parsedHint[k] = v ?? "true";
    });
  }
  const hintText = targetingHint
    ? `Targeting hint: ${JSON.stringify(parsedHint)}`
    : `Targeting hint: {}`;

  // Build detailed spatial context
  const activeAbId = deriveActiveArtboardId();
  const activeArtboard = activeAbId 
    ? (canvasState?.artboards || []).find((ab: any) => ab.id === activeAbId)
    : null;
  const spatialContext = activeArtboard 
    ? `Active Artboard: ${JSON.stringify({
        id: activeArtboard.id,
        name: activeArtboard.name,
        bounds: activeArtboard.boundingBox,
        size: activeArtboard.size,
        objectCount: activeArtboard.objectIds?.length || 0,
        objects: (canvasState?.objects || [])
          .filter((o: any) => activeArtboard.objectIds?.includes(o.id))
          .map((o: any) => ({
            id: o.id,
            name: o.name,
            type: o.type,
            position: { left: o.left, top: o.top },
            size: { width: o.scaledWidth || o.width, height: o.scaledHeight || o.height },
            bounds: o.boundingBox,
            center: o.center,
            fill: o.fill || null,
            stroke: o.stroke || null,
            strokeWidth: o.strokeWidth || 0,
            opacity: o.opacity ?? 1,
            fontSize: o.fontSize || null,
            fontFamily: o.fontFamily || null,
            fontWeight: o.fontWeight || null,
            textAlign: o.textAlign || null,
            text: o.text || null,
          })),
      }, null, 2)}`
    : `No active artboard. Available artboards: ${JSON.stringify(
        (canvasState?.artboards || []).map((ab: any) => ({
          id: ab.id,
          name: ab.name,
          bounds: ab.boundingBox,
          size: ab.size,
          objectCount: ab.objectIds?.length || 0,
        })),
        null,
        2
      )}`;
  
  // Build color context summary
  const colorContext = activeArtboard
    ? (() => {
        const artboardObjects = (canvasState?.objects || [])
          .filter((o: any) => activeArtboard.objectIds?.includes(o.id));
        const colors = {
          fills: artboardObjects.map((o: any) => o.fill).filter(Boolean),
          strokes: artboardObjects.map((o: any) => o.stroke).filter(Boolean),
          textColors: artboardObjects.filter((o: any) => o.type === 'textbox').map((o: any) => o.fill).filter(Boolean),
        };
        return `Color Context: ${JSON.stringify(colors, null, 2)}`;
      })()
    : "";

  const userText =
    `Instruction: ${raw}\n\n` +
    `SPATIAL CONTEXT:\n${spatialContext}\n\n` +
    (colorContext ? `${colorContext}\n\n` : "") +
    `Canvas summary: ${JSON.stringify(canvasState?.summary ?? {}, null, 2)}\n\n` +
    `${hintText}\n\n` +
    (memory ? `Artboard memory: ${JSON.stringify(memory, null, 2)}\n\n` : "") +
    `Guidance: Use the spatial context above to understand layout. Calculate exact coordinates (x, y) and dimensions (w, h) for positioning operations. When aligning or centering, compute positions relative to artboard bounds or object groups. Use color context to understand existing colors and apply color changes appropriately based on object types.`;

  if (onEvent) onEvent({ type: "progress", data: "Planning…" });

  // Use rule-based fallback logic
  if (plan.length === 0) {
    try {
      const hint = parsedHint;
      const text = raw.toLowerCase();
      const targetIds = getTargetIds(hint);
      const objectMap: Record<string, any> = {};
      for (const o of (canvasState?.objects || [])) {
        objectMap[o.id] = o;
      }
      const fallback: any[] = [];
      const percentMatch = raw.match(/(\d+)\s*%/);
      const moveDirFirst = raw.match(/(?:move|shift|nudge)\s+(left|right|up|down)\s*(?:by\s*)?(-?\d+)\s*(?:px|pixels)?/i);
      const moveAmountFirst = raw.match(/(?:move|shift|nudge)\s*(?:by\s*)?(-?\d+)\s*(?:px|pixels)?\s*(left|right|up|down)/i);
      const alignMatch = raw.match(/\balign\s*(left|right|top|bottom|center|middle|horizontally|vertically)\b/i);
      const centerAll = /\b(center|centre)\b/i.test(raw) || /center everything/i.test(raw) || /\bcenter (objects|all)\b/i.test(raw);
      const addTextMatch = raw.match(/(?:add|insert)\s*(?:heading|text)\s*["“']([^"”']+)["”']/i) || raw.match(/(?:add|insert)\s*(?:heading|text)\s*(.+)$/i);
      const deleteMatch = /\b(delete|remove|clear)\b/i.test(raw);
      const bigger = /\b(bigger|increase|enlarge|scale up)\b/i.test(raw);
      const smaller = /\b(smaller|decrease|shrink|scale down)\b/i.test(raw);
      
      // Color-related patterns
      const colorNames: Record<string, string> = {
        red: "#FF0000", green: "#00FF00", blue: "#0000FF", yellow: "#FFFF00",
        orange: "#FFA500", purple: "#800080", pink: "#FFC0CB", brown: "#A52A2A",
        black: "#000000", white: "#FFFFFF", gray: "#808080", grey: "#808080",
        cyan: "#00FFFF", magenta: "#FF00FF", lime: "#00FF00", navy: "#000080",
        olive: "#808000", maroon: "#800000", teal: "#008080", aqua: "#00FFFF",
        silver: "#C0C0C0", gold: "#FFD700", beige: "#F5F5DC", coral: "#FF7F50",
        salmon: "#FA8072", turquoise: "#40E0D0", violet: "#EE82EE", indigo: "#4B0082",
      };
      const colorMatch = raw.match(/\b(make|change|set|color|fill|paint)\s+(?:it|them|the|object|objects|selection|text)?\s*(?:to|as)?\s*([a-z]+)\b/i);
      const hexColorMatch = raw.match(/#([0-9A-Fa-f]{3,6})\b/);
      const borderMatch = /\b(border|stroke|outline)\b/i.test(raw);
      const borderColorMatch = raw.match(/\b(border|stroke|outline)\s*(?:color)?\s*(?:is|to|as)?\s*([a-z]+)\b/i);
      const opacityMatch = raw.match(/\b(opacity|transparency|transparent|fade|semi[-\s]?transparent)\b/i);
      const boldMatch = /\b(bold|bolder|bolden)\b/i.test(raw);
      const italicMatch = /\b(italic|italics)\b/i.test(raw);
      const fontSizeMatch = raw.match(/\b(font\s*size|text\s*size)\s*(?:is|to|as)?\s*(\d+)\b/i);
      const textAlignMatch = raw.match(/\b(align|text\s*align)\s*(left|right|center|centre|justify)\b/i);
      const textColorMatch = raw.match(/\b(text\s*color|font\s*color)\s*(?:is|to|as)?\s*([a-z]+)\b/i);

      // Enhanced alignment with spatial awareness
      const activeAb = deriveActiveArtboardId() 
        ? (canvasState?.artboards || []).find((ab: any) => ab.id === deriveActiveArtboardId())
        : null;
      const abBounds = activeAb?.boundingBox;
      
      if (centerAll) {
        // Center all objects within artboard bounds if available
        if (abBounds && targetIds.length > 0) {
          const centerX = abBounds.centerX || (abBounds.left + abBounds.width / 2);
          const centerY = abBounds.centerY || (abBounds.top + abBounds.height / 2);
          // Use align tool which will compute positions relative to artboard
          fallback.push({ type: "align", objectIds: targetIds, params: { horizontal: "center", vertical: "center" } });
        } else {
          fallback.push({ type: "align", objectIds: targetIds, params: { horizontal: "center", vertical: "center" } });
        }
      }
      if (alignMatch) {
        const dir = (alignMatch[1] || "").toLowerCase();
        if (dir === "middle" || dir === "horizontally") {
          fallback.push({ type: "align", objectIds: targetIds, params: { horizontal: "center" } });
        } else if (dir === "vertically") {
          fallback.push({ type: "align", objectIds: targetIds, params: { vertical: "center" } });
        } else {
          const params: any = {};
          if (dir === "left" || dir === "right" || dir === "center") params.horizontal = dir;
          if (dir === "top" || dir === "bottom" || dir === "center") params.vertical = dir;
          fallback.push({ type: "align", objectIds: targetIds, params });
        }
      }
      if (percentMatch && /(resize|scale|bigger|smaller)/i.test(raw)) {
        const pct = Math.max(1, parseInt(percentMatch[1] || "100", 10)) / 100;
        fallback.push({ type: "resize", objectIds: targetIds, params: { scaleX: pct, scaleY: pct } });
      }
      if (!percentMatch && bigger) {
        fallback.push({ type: "resize", objectIds: targetIds, params: { scaleX: 1.2, scaleY: 1.2 } });
      }
      if (!percentMatch && smaller) {
        fallback.push({ type: "resize", objectIds: targetIds, params: { scaleX: 0.8, scaleY: 0.8 } });
      }
      const resolvedMove = moveDirFirst || moveAmountFirst;
      if (resolvedMove) {
        const dir = ((resolvedMove[1] && isNaN(Number(resolvedMove[1])) ? resolvedMove[1] : resolvedMove[2]) || "").toLowerCase();
        const amtStr = (resolvedMove[1] && !isNaN(Number(resolvedMove[1])) ? resolvedMove[1] : resolvedMove[2]) || "0";
        const amount = parseInt(amtStr, 10);
        const dx = dir === "left" ? -amount : dir === "right" ? amount : 0;
        const dy = dir === "up" ? -amount : dir === "down" ? amount : 0;
        for (const id of targetIds) {
          const obj = objectMap[id];
          if (!obj) continue;
          const left = typeof obj.left === "number" ? obj.left : obj.boundingBox?.left || 0;
          const top = typeof obj.top === "number" ? obj.top : obj.boundingBox?.top || 0;
          fallback.push({ type: "move", objectIds: [id], params: { left: left + dx, top: top + dy } });
        }
      }
      if (addTextMatch) {
        const textToAdd = (addTextMatch[1] || addTextMatch[2] || "").trim();
        const abId = deriveActiveArtboardId();
        fallback.push({ type: "add_text", objectIds: [], params: { text: textToAdd, artboardId: abId } });
      }
      if (deleteMatch && (canvasState?.selectedObjectIds || []).length > 0) {
        fallback.push({ type: "delete", objectIds: (canvasState?.selectedObjectIds || []).slice(), params: {} });
      }
      
      // Color fallbacks
      if (colorMatch || hexColorMatch) {
        const colorName = colorMatch?.[2]?.toLowerCase();
        const hexColor = hexColorMatch ? `#${hexColorMatch[1].toUpperCase()}` : (colorName && colorNames[colorName] ? colorNames[colorName] : null);
        if (hexColor && targetIds.length > 0) {
          // Determine if it's text or shape based on object types
          const hasTextObjects = targetIds.some((id: string) => {
            const obj = objectMap[id];
            return obj?.type === 'textbox';
          });
          if (hasTextObjects && /\b(text|heading|label)\b/i.test(raw)) {
            fallback.push({ type: "set_text_style", objectIds: targetIds, params: { fill: hexColor } });
          } else {
            fallback.push({ type: "set_fill", objectIds: targetIds, params: { fill: hexColor } });
          }
        }
      }
      
      if (borderMatch || borderColorMatch) {
        const borderColorName = borderColorMatch?.[2]?.toLowerCase();
        const borderColor = borderColorName && colorNames[borderColorName] ? colorNames[borderColorName] : "#000000";
        const strokeWidth = raw.match(/\b(\d+)\s*(?:px|pixels)?\s*(?:border|stroke|outline)\b/i)?.[1] || "2";
        fallback.push({ type: "set_stroke", objectIds: targetIds, params: { stroke: borderColor, strokeWidth: parseInt(strokeWidth, 10) } });
      }
      
      if (opacityMatch) {
        const opacityValue = raw.match(/\b(\d+(?:\.\d+)?)\s*(?:%|percent)?\s*(?:opacity|transparency)\b/i)?.[1] 
          || (raw.includes("semi-transparent") || raw.includes("semitransparent") ? "0.5" : null)
          || (raw.includes("transparent") ? "0" : "0.5");
        if (opacityValue) {
          const opacity = parseFloat(opacityValue);
          const normalizedOpacity = opacity > 1 ? opacity / 100 : opacity;
          fallback.push({ type: "set_opacity", objectIds: targetIds, params: { opacity: Math.max(0, Math.min(1, normalizedOpacity)) } });
        }
      }
      
      if (boldMatch && targetIds.length > 0) {
        const hasTextObjects = targetIds.some((id: string) => {
          const obj = objectMap[id];
          return obj?.type === 'textbox';
        });
        if (hasTextObjects) {
          fallback.push({ type: "set_text_style", objectIds: targetIds, params: { fontWeight: "bold" } });
        }
      }
      
      if (fontSizeMatch && targetIds.length > 0) {
        const size = parseInt(fontSizeMatch[2] || "16", 10);
        const hasTextObjects = targetIds.some((id: string) => {
          const obj = objectMap[id];
          return obj?.type === 'textbox';
        });
        if (hasTextObjects) {
          fallback.push({ type: "set_text_style", objectIds: targetIds, params: { fontSize: Math.max(8, Math.min(200, size)) } });
        }
      }
      
      if (textAlignMatch && targetIds.length > 0) {
        const align = textAlignMatch[2]?.toLowerCase();
        const hasTextObjects = targetIds.some((id: string) => {
          const obj = objectMap[id];
          return obj?.type === 'textbox';
        });
        if (hasTextObjects && (align === "left" || align === "right" || align === "center" || align === "centre" || align === "justify")) {
          fallback.push({ type: "set_text_style", objectIds: targetIds, params: { textAlign: align === "centre" ? "center" : align } });
        }
      }
      
      if (textColorMatch && targetIds.length > 0) {
        const colorName = textColorMatch[2]?.toLowerCase();
        const hexColor = colorName && colorNames[colorName] ? colorNames[colorName] : null;
        const hasTextObjects = targetIds.some((id: string) => {
          const obj = objectMap[id];
          return obj?.type === 'textbox';
        });
        if (hexColor && hasTextObjects) {
          fallback.push({ type: "set_text_style", objectIds: targetIds, params: { fill: hexColor } });
        }
      }
      
      if (fallback.length > 0) {
        plan.push(...fallback);
      }
    } catch {
      // ignore fallback errors
    }
  }

  const response = {
    actions: plan,
    message: plan.length > 0 ? "Applied your instruction." : "I couldn't derive concrete changes. Please try a clearer instruction.",
  };

  const safe = AgentResponse.safeParse(response);
  const final = safe.success
    ? safe.data
    : ({ actions: [], message: "I couldn't confidently interpret that." } as z.infer<typeof AgentResponse>);

  if (onEvent) onEvent({ type: "done", data: final });
  return final;
}


