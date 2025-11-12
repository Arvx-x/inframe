import { z } from "zod";
import type { AgentAction } from "@/app/lib/agent/canvas-schema";

// Simple tool interface to replace DynamicStructuredTool
interface Tool {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  invoke: (input: any) => Promise<string>;
}

// Helper function to create a tool
function createTool<T extends z.ZodObject<any>>(
  name: string,
  description: string,
  schema: T,
  func: (input: z.infer<T>) => Promise<string>
): Tool {
  return {
    name,
    description,
    schema,
    invoke: func,
  };
}

type CanvasState = {
  objects: any[];
  artboards: Array<{
    id: string;
    name?: string;
    boundingBox: { left: number; top: number; width: number; height: number; right: number; bottom: number; centerX: number; centerY: number };
    objectIds: string[];
  }>;
  selectedObjectIds: string[];
  selectionBounds?: any;
  summary?: any;
};

type ToolContext = {
  canvasState: CanvasState;
  plan: AgentAction[];
};

const pickTargetIds = (
  ctx: ToolContext,
  args: { targets?: string[]; selection?: boolean; artboardId?: string; includeArtboard?: boolean }
): string[] => {
  const { canvasState } = ctx;
  if (args.selection) {
    return canvasState.selectedObjectIds ?? [];
  }
  if (args.targets && args.targets.length > 0) {
    return args.targets;
  }
  if (args.artboardId) {
    const ab = (canvasState.artboards || []).find((a) => a.id === args.artboardId);
    if (ab) {
      const ids = ab.objectIds.slice();
      if (args.includeArtboard) ids.unshift(ab.id);
      return ids;
    }
  }
  // Prefer active artboard objects when available
  const activeAbId = (canvasState as any)?.summary?.activeArtboardIds?.[0];
  if (activeAbId) {
    const ab = (canvasState.artboards || []).find((a) => a.id === activeAbId);
    if (ab) return ab.objectIds.slice();
  }
  // Fallback to all non-artboard objects
  const nonArtboard = (canvasState.objects || []).filter((o) => !o.isArtboard).map((o) => o.id);
  return nonArtboard;
};

export function buildCanvasTools(ctx: ToolContext) {
  // move
  const moveInput = z.object({
    targets: z.array(z.string()).optional().describe("Explicit object ids, e.g., obj_2"),
    selection: z.boolean().optional().describe("Operate on current selection"),
    artboardId: z.string().optional().describe("Operate on objects contained by this artboard id"),
    includeArtboard: z.boolean().optional().describe("When artboardId is provided, include the artboard rectangle itself"),
    dx: z.number().optional().describe("Relative x offset in pixels (+right, -left)"),
    dy: z.number().optional().describe("Relative y offset in pixels (+down, -up)"),
    left: z.number().optional().describe("Absolute left position in pixels"),
    top: z.number().optional().describe("Absolute top position in pixels"),
  });
  const move = createTool(
    "move",
    "Move one or more objects by absolute coordinates (left, top) or relative offsets (dx, dy). Use artboard bounds to constrain positions. Calculate absolute coordinates: newLeft = currentLeft + dx, newTop = currentTop + dy. Consider artboard boundaries when positioning.",
    moveInput,
    async (input: z.infer<typeof moveInput>) => {
      const ids = pickTargetIds(ctx, input);
      if (ids.length === 0) return "No targets to move";
      const { canvasState } = ctx;
      const actions: AgentAction[] = [];
      for (const id of ids) {
        const obj = (canvasState.objects || []).find((o) => o.id === id);
        if (!obj) continue;
        const targetLeft = typeof input.left === "number" ? input.left : (obj.left ?? obj.boundingBox?.left ?? 0) + (input.dx ?? 0);
        const targetTop = typeof input.top === "number" ? input.top : (obj.top ?? obj.boundingBox?.top ?? 0) + (input.dy ?? 0);
        actions.push({
          type: "move",
          objectIds: [id],
          params: { left: targetLeft, top: targetTop },
        } as AgentAction);
      }
      ctx.plan.push(...actions);
      return `Moved ${actions.length} object(s).`;
    }
  );

  // resize
  const resizeInput = z.object({
    targets: z.array(z.string()).optional(),
    selection: z.boolean().optional(),
    artboardId: z.string().optional(),
    includeArtboard: z.boolean().optional(),
    scaleX: z.number().optional().describe("Absolute scaleX factor, e.g., 1.2"),
    scaleY: z.number().optional().describe("Absolute scaleY factor, e.g., 0.8"),
    percent: z.number().optional().describe("Uniform percent scale, e.g., 120 for +20%"),
  });
  const resize = createTool(
    "resize",
    "Resize one or more objects. Use percent for uniform scaling if specified.",
    resizeInput,
    async (input: z.infer<typeof resizeInput>) => {
      const ids = pickTargetIds(ctx, input);
      if (ids.length === 0) return "No targets to resize";
      const factor = typeof input.percent === "number" ? input.percent / 100 : undefined;
      const sx = typeof factor === "number" ? factor : (typeof input.scaleX === "number" ? input.scaleX : undefined);
      const sy = typeof factor === "number" ? factor : (typeof input.scaleY === "number" ? input.scaleY : undefined);
      if (typeof sx !== "number" && typeof sy !== "number") return "No scaling provided";
      ctx.plan.push({
        type: "resize",
        objectIds: ids,
        params: { scaleX: sx ?? 1, scaleY: sy ?? 1 },
      } as AgentAction);
      return `Resized ${ids.length} object(s).`;
    }
  );

  // align
  const alignInput = z.object({
    targets: z.array(z.string()).optional(),
    selection: z.boolean().optional(),
    artboardId: z.string().optional(),
    includeArtboard: z.boolean().optional(),
    horizontal: z.enum(["left", "center", "right"]).optional(),
    vertical: z.enum(["top", "center", "bottom"]).optional(),
  });
  const align = createTool(
    "align",
    "Align a set of objects horizontally (left/center/right) or vertically (top/center/bottom). Use artboard boundingBox to determine alignment targets. For center alignment, compute: targetX = artboard.centerX or objectGroup.centerX. For left/right: use artboard.boundingBox.left or artboard.boundingBox.right. Calculate exact coordinates for each object based on alignment direction and artboard/group bounds.",
    alignInput,
    async (input: z.infer<typeof alignInput>) => {
      const ids = pickTargetIds(ctx, input);
      if (ids.length === 0) return "No targets to align";
      const params: any = {};
      if (input.horizontal) params.horizontal = input.horizontal;
      if (input.vertical) params.vertical = input.vertical;
      ctx.plan.push({
        type: "align",
        objectIds: ids,
        params,
      } as AgentAction);
      return `Aligned ${ids.length} object(s).`;
    }
  );

  // add_text
  const addTextInput = z.object({
    text: z.string().min(1),
    artboardId: z.string().optional(),
    includeArtboard: z.boolean().optional(),
    left: z.number().optional(),
    top: z.number().optional(),
    fontSize: z.number().optional(),
  });
  const add_text = createTool(
    "add_text",
    "Add a new text object. Defaults to center of artboard if left/top not provided.",
    addTextInput,
    async (input: z.infer<typeof addTextInput>) => {
      let left = input.left;
      let top = input.top;
      if ((left == null || top == null) && input.artboardId) {
        const ab = (ctx.canvasState.artboards || []).find((a) => a.id === input.artboardId);
        if (ab) {
          left = left ?? ab.boundingBox.centerX;
          top = top ?? Math.max(ab.boundingBox.top + 32, ab.boundingBox.centerY - 24);
        }
      }
      ctx.plan.push({
        type: "add_text",
        objectIds: [],
        params: {
          text: input.text,
          left,
          top,
          fontSize: input.fontSize,
        },
      } as AgentAction);
      return "Added text.";
    }
  );

  // delete
  const delInput = z.object({
    targets: z.array(z.string()).optional(),
    selection: z.boolean().optional(),
    artboardId: z.string().optional(),
    includeArtboard: z.boolean().optional(),
  });
  const delete_tool = createTool(
    "delete",
    "Delete one or more objects.",
    delInput,
    async (input: z.infer<typeof delInput>) => {
      const ids = pickTargetIds(ctx, input);
      if (ids.length === 0) return "No targets to delete";
      ctx.plan.push({
        type: "delete",
        objectIds: ids,
        params: {},
      } as AgentAction);
      return `Deleted ${ids.length} object(s).`;
    }
  );

  // group
  const groupInput = z.object({
    targets: z.array(z.string()).optional(),
    selection: z.boolean().optional(),
    spacing: z.number().default(24),
  });
  const group = createTool(
    "group",
    "Group objects horizontally with spacing.",
    groupInput,
    async (input: z.infer<typeof groupInput>) => {
      const ids = pickTargetIds(ctx, input);
      if (ids.length < 2) return "Need 2+ objects to group";
      ctx.plan.push({
        type: "group",
        objectIds: ids,
        params: { spacing: input.spacing },
      } as AgentAction);
      return `Grouped ${ids.length} object(s).`;
    }
  );

  // Color name to hex converter
  const colorNameToHex: Record<string, string> = {
    red: "#FF0000", green: "#00FF00", blue: "#0000FF", yellow: "#FFFF00",
    orange: "#FFA500", purple: "#800080", pink: "#FFC0CB", brown: "#A52A2A",
    black: "#000000", white: "#FFFFFF", gray: "#808080", grey: "#808080",
    cyan: "#00FFFF", magenta: "#FF00FF", lime: "#00FF00", navy: "#000080",
    olive: "#808000", maroon: "#800000", teal: "#008080", aqua: "#00FFFF",
    silver: "#C0C0C0", gold: "#FFD700", beige: "#F5F5DC", coral: "#FF7F50",
    salmon: "#FA8072", turquoise: "#40E0D0", violet: "#EE82EE", indigo: "#4B0082",
  };
  const normalizeColor = (color: string): string => {
    const trimmed = (color || "").trim().toLowerCase();
    if (trimmed.startsWith("#")) return trimmed.toUpperCase();
    if (trimmed === "transparent") return "transparent";
    if (colorNameToHex[trimmed]) return colorNameToHex[trimmed];
    // Try to parse as hex without #
    if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toUpperCase()}`;
    if (/^[0-9A-Fa-f]{3}$/.test(trimmed)) {
      // Expand shorthand hex
      return `#${trimmed.split("").map(c => c + c).join("").toUpperCase()}`;
    }
    return color; // Return as-is if cannot parse
  };

  // set_fill
  const setFillInput = z.object({
    targets: z.array(z.string()).optional(),
    selection: z.boolean().optional(),
    artboardId: z.string().optional(),
    includeArtboard: z.boolean().optional(),
    fill: z.string().describe("Color: hex code (e.g., '#FF0000'), color name (e.g., 'red'), or 'transparent'"),
    opacity: z.number().min(0).max(1).optional().describe("Fill opacity (0-1)"),
  });
  const set_fill = createTool(
    "set_fill",
    "Set fill color for shapes and text objects. Accepts hex codes (#FF0000), color names (red, blue), or 'transparent'. For images, this may not apply as images maintain their original appearance. Check object.type to determine if fill is applicable.",
    setFillInput,
    async (input: z.infer<typeof setFillInput>) => {
      const ids = pickTargetIds(ctx, input);
      if (ids.length === 0) return "No targets to set fill";
      const fillColor = normalizeColor(input.fill);
      ctx.plan.push({
        type: "set_fill",
        objectIds: ids,
        params: { fill: fillColor, opacity: input.opacity },
      } as AgentAction);
      return `Set fill color to ${fillColor} for ${ids.length} object(s).`;
    }
  );

  // set_stroke
  const setStrokeInput = z.object({
    targets: z.array(z.string()).optional(),
    selection: z.boolean().optional(),
    artboardId: z.string().optional(),
    includeArtboard: z.boolean().optional(),
    stroke: z.string().describe("Stroke color: hex code, color name, or 'transparent'"),
    strokeWidth: z.number().min(0).max(100).optional().describe("Stroke width in pixels"),
    strokeOpacity: z.number().min(0).max(1).optional(),
  });
  const set_stroke = createTool(
    "set_stroke",
    "Set stroke (border) color and width for objects. Accepts hex codes, color names, or 'transparent'. Use strokeWidth to set border thickness.",
    setStrokeInput,
    async (input: z.infer<typeof setStrokeInput>) => {
      const ids = pickTargetIds(ctx, input);
      if (ids.length === 0) return "No targets to set stroke";
      const strokeColor = normalizeColor(input.stroke);
      ctx.plan.push({
        type: "set_stroke",
        objectIds: ids,
        params: { stroke: strokeColor, strokeWidth: input.strokeWidth, strokeOpacity: input.strokeOpacity },
      } as AgentAction);
      return `Set stroke to ${strokeColor} for ${ids.length} object(s).`;
    }
  );

  // set_opacity
  const setOpacityInput = z.object({
    targets: z.array(z.string()).optional(),
    selection: z.boolean().optional(),
    artboardId: z.string().optional(),
    includeArtboard: z.boolean().optional(),
    opacity: z.number().min(0).max(1).describe("Opacity value from 0 (transparent) to 1 (opaque)"),
  });
  const set_opacity = createTool(
    "set_opacity",
    "Set opacity for objects. 0 = fully transparent, 1 = fully opaque. Can be used for fade effects or making objects semi-transparent.",
    setOpacityInput,
    async (input: z.infer<typeof setOpacityInput>) => {
      const ids = pickTargetIds(ctx, input);
      if (ids.length === 0) return "No targets to set opacity";
      ctx.plan.push({
        type: "set_opacity",
        objectIds: ids,
        params: { opacity: input.opacity },
      } as AgentAction);
      return `Set opacity to ${input.opacity} for ${ids.length} object(s).`;
    }
  );

  // set_text_style
  const setTextStyleInput = z.object({
    targets: z.array(z.string()).optional(),
    selection: z.boolean().optional(),
    artboardId: z.string().optional(),
    fill: z.string().optional().describe("Text color (hex code or color name)"),
    fontSize: z.number().min(8).max(200).optional(),
    fontFamily: z.string().optional().describe("Font family name, e.g., 'Inter', 'Arial', 'Helvetica'"),
    fontWeight: z.string().optional().describe("Font weight: 'normal', 'bold', '400', '700', etc. Can be a string or numeric string."),
    textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  });
  const set_text_style = createTool(
    "set_text_style",
    "Set text styling properties for text objects. Includes color (fill), font size, font family, font weight, and text alignment. Only applies to text objects (type === 'textbox').",
    setTextStyleInput,
    async (input: z.infer<typeof setTextStyleInput>) => {
      const ids = pickTargetIds(ctx, input);
      if (ids.length === 0) return "No targets to set text style";
      const params: any = {};
      if (input.fill) params.fill = normalizeColor(input.fill);
      if (input.fontSize != null) params.fontSize = input.fontSize;
      if (input.fontFamily) params.fontFamily = input.fontFamily;
      if (input.fontWeight != null) {
        // Handle both string and numeric string inputs
        const weight = input.fontWeight;
        // If it's a numeric string, convert to number; otherwise keep as string
        params.fontWeight = /^\d+$/.test(String(weight)) ? Number(weight) : weight;
      }
      if (input.textAlign) params.textAlign = input.textAlign;
      ctx.plan.push({
        type: "set_text_style",
        objectIds: ids,
        params,
      } as AgentAction);
      return `Updated text style for ${ids.length} object(s).`;
    }
  );

  return [move, resize, align, add_text, delete_tool, group, set_fill, set_stroke, set_opacity, set_text_style];
}


