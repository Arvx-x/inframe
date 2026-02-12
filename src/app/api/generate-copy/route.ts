// app/api/generate-copy/route.ts
// Generates marketing copy: headlines, taglines, CTAs, body text
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      instruction,
      context,
      tone,
      maxLength,
      count,
    } = body as {
      instruction?: string;
      context?: {
        campaignBrief?: string;
        brandVoice?: string;
        existingCopy?: string;
        platform?: string;
        format?: string;
      };
      tone?: string;
      maxLength?: number;
      count?: number;
    };

    if (!instruction || typeof instruction !== "string" || instruction.trim() === "") {
      return NextResponse.json({ error: "Instruction is required" }, { status: 400 });
    }

    const contextParts: string[] = [];
    if (context?.campaignBrief) contextParts.push(`Campaign: ${context.campaignBrief}`);
    if (context?.brandVoice) contextParts.push(`Brand voice: ${context.brandVoice}`);
    if (context?.existingCopy) contextParts.push(`Existing copy: "${context.existingCopy}"`);
    if (context?.platform) contextParts.push(`Platform: ${context.platform}`);
    if (context?.format) contextParts.push(`Format: ${context.format}`);
    if (tone) contextParts.push(`Tone: ${tone}`);
    if (maxLength) contextParts.push(`Max length: ${maxLength} characters`);

    const variations = count || 3;

    const systemPrompt = `You are an expert marketing copywriter for an AI-native design platform. Generate compelling, on-brand copy based on the user's instructions.

Rules:
- Be concise and impactful
- Match the requested tone and brand voice
- Respect character limits when specified
- Generate ${variations} variations
- For each variation, include the text and a brief rationale

Respond in JSON:
{
  "variations": [
    {
      "text": "string",
      "rationale": "string (brief reason why this works)"
    }
  ],
  "recommendation": "string (which variation is best and why)"
}`;

    const userPrompt = `Instruction: ${instruction}
${contextParts.length > 0 ? "\nContext:\n" + contextParts.join("\n") : ""}

Generate ${variations} copy variations.`;

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
            temperature: 0.9,
            maxOutputTokens: 2048,
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

    let copyResult;
    try {
      copyResult = JSON.parse(textContent);
    } catch {
      copyResult = { raw: textContent };
    }

    return NextResponse.json({ copy: copyResult });
  } catch (error: any) {
    console.error("generate-copy error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
