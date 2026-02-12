import { z } from "zod";

export const AlignH = z.enum(["left", "center", "right"]);
export const AlignV = z.enum(["top", "center", "bottom"]);

export const MoveAction = z.object({
  type: z.literal("move"),
  objectIds: z.array(z.string()).optional(),
  params: z.object({ left: z.number(), top: z.number() })
});

export const ResizeAction = z.object({
  type: z.literal("resize"),
  objectIds: z.array(z.string()),
  params: z.object({ scaleX: z.number().positive(), scaleY: z.number().positive() })
});

export const AlignAction = z.object({
  type: z.literal("align"),
  objectIds: z.array(z.string()).optional(),
  params: z.object({ horizontal: AlignH.optional(), vertical: AlignV.optional() })
});

export const AddTextAction = z.object({
  type: z.literal("add_text"),
  params: z.object({
    text: z.string().min(1),
    left: z.number().optional(),
    top: z.number().optional(),
    fontSize: z.number().min(8).max(200).optional()
  })
});

export const DeleteAction = z.object({
  type: z.literal("delete"),
  objectIds: z.array(z.string())
});

export const GroupAction = z.object({
  type: z.literal("group"),
  objectIds: z.array(z.string()),
  params: z.object({ spacing: z.number().min(0).max(400).default(20) })
});

export const SetFillAction = z.object({
  type: z.literal("set_fill"),
  objectIds: z.array(z.string()),
  params: z.object({
    fill: z.string(),
    opacity: z.number().min(0).max(1).optional()
  })
});

export const SetStrokeAction = z.object({
  type: z.literal("set_stroke"),
  objectIds: z.array(z.string()),
  params: z.object({
    stroke: z.string(),
    strokeWidth: z.number().min(0).max(100).optional(),
    strokeOpacity: z.number().min(0).max(1).optional()
  })
});

export const SetOpacityAction = z.object({
  type: z.literal("set_opacity"),
  objectIds: z.array(z.string()),
  params: z.object({
    opacity: z.number().min(0).max(1)
  })
});

export const SetTextStyleAction = z.object({
  type: z.literal("set_text_style"),
  objectIds: z.array(z.string()),
  params: z.object({
    fill: z.string().optional(),
    fontSize: z.number().min(8).max(200).optional(),
    fontFamily: z.string().optional(),
    fontWeight: z.union([z.string(), z.number()]).optional(),
    textAlign: z.enum(["left", "center", "right", "justify"]).optional()
  })
});

// --- New AI-native actions for campaign builder ---

export const GenerateLayoutAction = z.object({
  type: z.literal("generate_layout"),
  params: z.object({
    description: z.string().min(1),
    width: z.number().optional(),
    height: z.number().optional(),
    style: z.string().optional(), // "minimal", "bold", "corporate", etc.
  })
});

export const ApplyBrandKitAction = z.object({
  type: z.literal("apply_brand_kit"),
  objectIds: z.array(z.string()).optional(), // empty = apply to all
  params: z.object({
    brandKitId: z.string().optional(),
    applyColors: z.boolean().default(true),
    applyFonts: z.boolean().default(true),
  })
});

export const GenerateVariationsAction = z.object({
  type: z.literal("generate_variations"),
  params: z.object({
    count: z.number().min(1).max(5).default(3),
    varyColors: z.boolean().default(true),
    varyLayout: z.boolean().default(true),
    varyCopy: z.boolean().default(false),
  })
});

export const AddBrandedTextAction = z.object({
  type: z.literal("add_branded_text"),
  params: z.object({
    text: z.string().min(1),
    role: z.enum(["headline", "subheadline", "body", "cta"]),
    left: z.number().optional(),
    top: z.number().optional(),
  })
});

export const ApplyStyleAction = z.object({
  type: z.literal("apply_style"),
  objectIds: z.array(z.string()).optional(),
  params: z.object({
    style: z.string(), // "make it bolder", "more minimal", etc.
  })
});

export const GenerateCopyAction = z.object({
  type: z.literal("generate_copy"),
  objectIds: z.array(z.string()).optional(),
  params: z.object({
    instruction: z.string().min(1), // "write a tagline", "shorter CTA"
    tone: z.string().optional(),
    maxLength: z.number().optional(),
  })
});

export const RecomposeForFormatAction = z.object({
  type: z.literal("recompose_for_format"),
  params: z.object({
    targetWidth: z.number(),
    targetHeight: z.number(),
    platform: z.string().optional(),
  })
});

export const Action = z.discriminatedUnion("type", [
  MoveAction,
  ResizeAction,
  AlignAction,
  AddTextAction,
  DeleteAction,
  GroupAction,
  SetFillAction,
  SetStrokeAction,
  SetOpacityAction,
  SetTextStyleAction,
  // New AI-native actions
  GenerateLayoutAction,
  ApplyBrandKitAction,
  GenerateVariationsAction,
  AddBrandedTextAction,
  ApplyStyleAction,
  GenerateCopyAction,
  RecomposeForFormatAction,
]);

export const AgentResponse = z.object({
  actions: z.array(Action).default([]),
  message: z.string().default("")
});

export type AgentAction = z.infer<typeof Action>;
export type AgentParsedResponse = z.infer<typeof AgentResponse>;


