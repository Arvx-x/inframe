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

Available canvas state:
- objects: array of objects with { id, type, left, top, width, height, scaleX, scaleY }
- canvasWidth: number
- canvasHeight: number

You must respond with a JSON object containing:
{
  "actions": [
    {
      "type": "move" | "resize" | "align" | "add_text" | "delete" | "group",
      "objectIds": ["id1", "id2"],  // which objects to affect
      "params": { /* action-specific params */ }
    }
  ],
  "message": "Brief confirmation of what was done"
}

Action types and params:
- move: { left: number, top: number }
- resize: { scaleX: number, scaleY: number }
- align: { horizontal: "left"|"center"|"right", vertical: "top"|"center"|"bottom" }
- add_text: { text: string, left: number, top: number, fontSize: number }
- delete: {} (no params needed)
- group: { spacing: number } (for "side by side" etc)

Examples:
"Center everything" → align all objects to center
"Move logo to top-left" → find object with "logo" in name, move to (20, 20)
"Make images smaller" → resize all image objects to 0.8 scale
"Place side by side" → group selected objects horizontally
"Add heading 'Welcome'" → add text at top center

Be intelligent about interpreting natural language. If user says "smaller", reduce scale by 20%. If "larger", increase by 20%.`;

    if (!INFRAME_API_KEY) {
      return NextResponse.json(
        { error: "Missing INFRAME_API_KEY. Set it in .env.local or your hosting env." },
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
