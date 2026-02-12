// app/api/generate-campaign/route.ts
// Takes a brief + optional brand kit context and returns a campaign strategy + design suggestions
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      brief,
      brandKit,
      targetAudience,
      platforms,
    } = body as {
      brief?: string;
      brandKit?: {
        name: string;
        colors: string[];
        fonts: { primary?: string; secondary?: string; body?: string };
        voiceTone?: string;
        guidelines?: string;
      } | null;
      targetAudience?: string;
      platforms?: string[];
    };

    if (!brief || typeof brief !== "string" || brief.trim() === "") {
      return NextResponse.json({ error: "Brief is required" }, { status: 400 });
    }

    const brandContext = brandKit
      ? `\n\nBrand Context:
- Brand: ${brandKit.name}
- Colors: ${brandKit.colors?.join(", ") || "not specified"}
- Primary Font: ${brandKit.fonts?.primary || "not specified"}
- Voice & Tone: ${brandKit.voiceTone || "not specified"}
- Guidelines: ${brandKit.guidelines || "none"}`
      : "";

    const platformsList = platforms?.length ? `\nTarget Platforms: ${platforms.join(", ")}` : "";
    const audienceStr = targetAudience ? `\nTarget Audience: ${targetAudience}` : "";

    const systemPrompt = `You are an expert marketing campaign strategist and creative director for an AI-native design platform.

Given a campaign brief, generate a comprehensive campaign strategy including:
1. A refined campaign name
2. Campaign objectives (2-3 bullet points)
3. Key messages (3-5 core messages)
4. Design recommendations (color palette suggestions, style direction, mood)
5. Content plan with specific design deliverables (list each design with format, platform, description)
6. Copy suggestions for headlines, taglines, CTAs
7. A recommended campaign timeline

Respond in JSON format:
{
  "campaignName": "string",
  "objectives": ["string"],
  "keyMessages": ["string"],
  "designDirection": {
    "style": "string (e.g. minimal, bold, playful)",
    "colorSuggestions": ["hex colors"],
    "moodKeywords": ["string"],
    "typography": "string description"
  },
  "deliverables": [
    {
      "name": "string",
      "format": "string (e.g. Instagram Post 1080x1080)",
      "platform": "string",
      "description": "string",
      "suggestedCopy": { "headline": "string", "body": "string", "cta": "string" }
    }
  ],
  "copyBank": {
    "taglines": ["string"],
    "headlines": ["string"],
    "ctas": ["string"]
  },
  "timeline": "string (brief timeline recommendation)"
}`;

    const userPrompt = `Campaign Brief: ${brief}${audienceStr}${platformsList}${brandContext}

Generate a complete campaign strategy.`;

    const apiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${INFRAME_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json(
        { error: "AI generation failed", details: errText },
        { status: 502 }
      );
    }

    const result = await apiResponse.json();
    const textContent =
      result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse the JSON response
    let strategy;
    try {
      strategy = JSON.parse(textContent);
    } catch {
      // If JSON parsing fails, return the raw text
      strategy = { raw: textContent };
    }

    return NextResponse.json({ strategy });
  } catch (error: any) {
    console.error("generate-campaign error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
