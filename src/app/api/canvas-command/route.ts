// app/api/canvas-command/route.ts
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

if (!INFRAME_API_KEY) {
  throw new Error("Missing INFRAME_API_KEY environment variable.");
}

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

    // Build system prompt (kept same as your Deno function)
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

    // Call AI Gateway
    const res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INFRAME_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Command: "${command}"\n\nCanvas State: ${JSON.stringify(canvasState ?? {}, null, 2)}\n\nRespond with JSON only.`
          }
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error("AI API error:", res.status, errorText);

      if (res.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again in a moment." },
          { status: 429 }
        );
      }
      if (res.status === 402) {
        return NextResponse.json(
          { error: "Insufficient credits. Please add credits to continue." },
          { status: 402 }
        );
      }

      return NextResponse.json(
        { error: `AI API error: ${res.status}`, details: errorText },
        { status: 502 }
      );
    }

    const data = await res.json().catch((e) => {
      console.error("Failed to parse AI response JSON", e);
      return null;
    });

    // Extract text content (robust to different response shapes)
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      data?.output?.[0]?.content ??
      null;

    if (!content || typeof content !== "string") {
      console.warn("No textual content in AI response", data);
      return NextResponse.json({
        actions: [],
        message: "I understood your request, but couldn't generate specific actions. Try being more specific."
      });
    }

    // Parse JSON from content; handle code fences if present
    let parsedResponse: any;
    try {
      const jsonMatch =
        content.match(/```json\s*([\s\S]*?)\s*```/) ||
        content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      parsedResponse = JSON.parse(jsonString.trim());
    } catch (err) {
      console.error("Failed to parse AI response as JSON:", err, "content:", content);
      parsedResponse = {
        actions: [],
        message: "I understood your request, but couldn't generate specific actions. Try being more specific."
      };
    }

    return NextResponse.json(parsedResponse);
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
