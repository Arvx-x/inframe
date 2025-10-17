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

export const Action = z.discriminatedUnion("type", [
  MoveAction,
  ResizeAction,
  AlignAction,
  AddTextAction,
  DeleteAction,
  GroupAction,
]);

export const AgentResponse = z.object({
  actions: z.array(Action).default([]),
  message: z.string().default("")
});

export type AgentAction = z.infer<typeof Action>;
export type AgentParsedResponse = z.infer<typeof AgentResponse>;


