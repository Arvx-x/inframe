// app/api/design-review/route.ts
// AI reviews a canvas design and provides feedback + improvement suggestions
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      canvasData,
      canvasImageUrl,
      campaignBrief,
      brandKit,
      targetPlatform,
    } = body as {
      canvasData?: any;
      canvasImageUrl?: string;
      campaignBrief?: string;
      brandKit?: {
        name: string;
        colors: string[];
        fonts: { primary?: string; secondary?: string; body?: string };
        voiceTone?: string;
      } | null;
      targetPlatform?: string;
    };

    if (!canvasData && !canvasImageUrl) {
      return NextResponse.json(
        { error: "Either canvasData or canvasImageUrl is required" },
        { status: 400 }
      );
    }

    const contextParts: string[] = [];
    if (campaignBrief) contextParts.push(`Campaign brief: ${campaignBrief}`);
    if (targetPlatform) contextParts.push(`Target platform: ${targetPlatform}`);
    if (brandKit) {
      contextParts.push(`Brand: ${brandKit.name}`);
      if (brandKit.colors?.length) contextParts.push(`Brand colors: ${brandKit.colors.join(", ")}`);
      if (brandKit.fonts?.primary) contextParts.push(`Primary font: ${brandKit.fonts.primary}`);
      if (brandKit.voiceTone) contextParts.push(`Brand voice: ${brandKit.voiceTone}`);
    }

    const systemPrompt = `You are an expert design reviewer for a marketing design platform. Analyze the provided design and give actionable feedback.

Review criteria:
1. Visual hierarchy — is there a clear focal point?
2. Typography — are fonts readable, consistent, and well-sized?
3. Color usage — are colors harmonious and on-brand?
4. Layout & spacing — is there good use of whitespace and alignment?
5. Brand consistency — does it match the brand guidelines?
6. Platform fit — is it optimized for the target platform?
7. Copy effectiveness — is the text compelling and clear?

Respond in JSON:
{
  "overallScore": number (1-10),
  "summary": "string (1-2 sentence overall assessment)",
  "strengths": ["string"],
  "improvements": [
    {
      "area": "string (e.g. Typography, Color, Layout)",
      "issue": "string",
      "suggestion": "string (specific, actionable fix)",
      "priority": "high" | "medium" | "low"
    }
  ],
  "canvasCommands": [
    {
      "description": "string (what this command would fix)",
      "command": "string (natural language command for the canvas agent)"
    }
  ]
}`;

    // Build the request - if we have an image URL, use multimodal
    const parts: any[] = [];
    parts.push({ text: systemPrompt });

    if (contextParts.length > 0) {
      parts.push({ text: "\nContext:\n" + contextParts.join("\n") });
    }

    if (canvasData) {
      // Summarize canvas data (don't send raw fabric JSON)
      const objectSummary = canvasData.objects?.map((obj: any) => ({
        type: obj.type,
        text: obj.text?.slice(0, 100),
        fill: obj.fill,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        left: obj.left,
        top: obj.top,
        width: obj.width,
        height: obj.height,
      }));
      parts.push({
        text: `\nCanvas objects summary:\n${JSON.stringify(objectSummary, null, 2)}`,
      });
    }

    if (canvasImageUrl) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: canvasImageUrl.replace(/^data:image\/\w+;base64,/, ""),
        },
      });
    }

    const apiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${INFRAME_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 3072,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json(
        { error: "AI review failed", details: errText },
        { status: 502 }
      );
    }

    const result = await apiResponse.json();
    const textContent =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let review;
    try {
      review = JSON.parse(textContent);
    } catch {
      review = { raw: textContent };
    }

    return NextResponse.json({ review });
  } catch (error: any) {
    console.error("design-review error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
