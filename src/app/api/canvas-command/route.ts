// app/api/canvas-command/route.ts
import { NextResponse } from "next/server";
import { AgentResponse } from "@/app/lib/agent/canvas-schema";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { command, canvasState } = body ?? {};

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { error: "Command is required", actions: [], message: "Command is required" },
        { status: 400 }
      );
    }

    // Build system prompt describing the JSON action schema
    const systemPrompt = `You are an intelligent canvas agent that interprets user commands and returns structured actions to manipulate a Fabric.js canvas.

Canvas state is provided as JSON on every request and includes:
- version, timestamp, canvasSize { width, height }, backgroundColor, zoom, and viewportTransform (Fabric matrix [a, b, c, d, e, f])
- objects: array of objects with rich metadata, each containing:
  * id: unique identifier like "obj_0", "obj_1", etc.
  * type/name/zIndex plus transform data (left, top, width, height, scaledWidth, scaledHeight, scaleX, scaleY, angle, opacity)
  * boundingBox { left, top, width, height, right, bottom, centerX, centerY }
  * center { x, y }, artboardIds (artboards that contain this object), styling info (fill, stroke, strokeWidth, fonts/text for textboxes, radius for circles, etc.)
  * memberIds for grouped layers when applicable
- artboards: array where each entry lists { id, name, boundingBox, size, background, zIndex, objectIds[] contained within }
- selectedObjectIds: ids currently selected (expanded for multi-select)
- selectionBounds: bounding rectangle of the current selection (if any)
- summary: quick counts (totalObjects, countsByType, activeArtboardIds, selectedObjects, etc.)

Use this context to understand layout, artboard structure, and element positioning. When an object has artboardIds, treat its primary coordinate system relative to those artboards and keep the object inside their bounding boxes unless the user explicitly asks otherwise.

You must respond with a JSON object containing:
{
  "actions": [
    {
      "type": "move" | "resize" | "align" | "add_text" | "delete" | "group",
      "objectIds": ["obj_0", "obj_1"],  // which objects to affect (use actual IDs from canvas state)
      "params": { /* action-specific params */ }
    }
  ],
  "message": "Brief confirmation of what was done"
}

Action types and params:
- move: { left: number, top: number } — absolute canvas coordinates in pixels. Compute these using current object positions plus any offsets the user requests. Keep objects inside their artboard bounding boxes when appropriate.
- resize: { scaleX: number, scaleY: number } — scaling factors (1.0 = original size). Derive the factors from the current scale when a user requests relative changes (e.g., "make 20% larger").
- align: { horizontal?: "left"|"center"|"right", vertical?: "top"|"center"|"bottom" } — align the target set. You can align to artboard bounds by including all objects the artboard contains.
- add_text: { text: string, left?: number, top?: number, fontSize?: number } — add new text at the requested location (top/left default to artboard center if unspecified).
- delete: {} — remove specified objects.
- group: { spacing: number } — arrange the provided objectIds horizontally with the given spacing (use their artboard context to determine y positions).

Examples:
"Center everything" → { "actions": [{ "type": "align", "params": { "horizontal": "center", "vertical": "center" } }], "message": "Centered all objects" }
"Move the hero image 40px down" → look up its current top, add 40px, supply new absolute top in a move action.
"Place cards side by side on the first artboard" → gather the artboard's objectIds, compute target x positions across its width, return a group action with an appropriate spacing value.
"Add heading 'Welcome' to the main artboard" → use add_text with coordinates near the artboard's top center.

Important guidelines:
- Always use the provided objectIds and artboardIds exactly as listed.
- Prefer keeping objects inside their artboard bounding boxes; adjust coordinates accordingly unless the user explicitly directs otherwise.
- When applying relative changes ("move right 24px", "make smaller"), compute the new absolute values before returning actions.
- If the user references "selection", apply actions to selectedObjectIds; otherwise identify targets by name/type/context from the state summary.
- Be clear and friendly in the message, confirming what changed. If no action is appropriate, return an empty actions array with an explanatory message.`;

    if (!INFRAME_API_KEY) {
      return NextResponse.json(
        { error: "Missing INFRAME_API_KEY. Set it in .env.local or your hosting env.", actions: [], message: "API key not configured." },
        { status: 500 }
      );
    }

    // Call Google Generative Language API (Gemini 2.5 Flash) directly
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${INFRAME_API_KEY}`;

    // Compose single prompt with system guidance and user command/state
    const prompt = `${systemPrompt}\n\nCommand: "${command}"\n\nCanvas State: ${JSON.stringify(canvasState ?? {}, null, 2)}\n\nRespond with JSON only.`;

    let res: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) break;
        const text = await res.text().catch(() => "");
        console.error("Gemini text API error:", res.status, text);
        if (res.status === 401) {
          return NextResponse.json(
            { error: "Unauthorized. Verify INFRAME_API_KEY is a valid Google API key." },
            { status: 401 }
          );
        }
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, attempt * 600));
          continue;
        }
        return NextResponse.json({ error: "Failed to interpret command", details: text }, { status: 502 });
      } catch (e) {
        await new Promise((r) => setTimeout(r, attempt * 600));
      }
    }

    if (!res || !res.ok) {
      return NextResponse.json({ error: "Failed to reach Google API after retries" }, { status: 502 });
    }

    const data = await res.json().catch((e) => {
      console.error("Failed to parse Google response JSON", e);
      return null;
    });

    // Extract plain text from Gemini response parts
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const textOut: string = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n");

    if (!textOut) {
      console.warn("No text in Gemini response", JSON.stringify(data).slice(0, 500));
      return NextResponse.json({ actions: [], message: "No actions returned." });
    }

    // Parse JSON with support for fenced blocks
    let parsedResponse: any;
    try {
      const jsonMatch =
        textOut.match(/```json\s*([\s\S]*?)\s*```/) ||
        textOut.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = (jsonMatch ? jsonMatch[1] : textOut).trim();
      parsedResponse = JSON.parse(jsonString);
    } catch (err) {
      console.error("Failed to parse Gemini JSON:", err, "text:", textOut);
      parsedResponse = { actions: [], message: "I couldn't generate specific actions. Try being more specific." };
    }

    // Validate and sanitize via Zod
    const safe = AgentResponse.safeParse(parsedResponse);
    if (!safe.success) {
      console.warn("Agent response validation failed:", safe.error?.issues);
      return NextResponse.json({
        actions: [],
        message: "I couldn't confidently interpret that. Try a clearer instruction (e.g., 'center everything').",
      });
    }

    return NextResponse.json(safe.data);
  } catch (err: any) {
    console.error("Error in /api/canvas-command:", err);
    return NextResponse.json(
      {
        error: err?.message ?? "Unknown error occurred",
        actions: [],
        message: "Sorry, I couldn't process that command.",
      },
      { status: 500 }
    );
  }
}
