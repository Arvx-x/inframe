// app/api/enhance-video-prompt/route.ts
// Creative director: Gemini thinking model enhances user prompt for Veo video generation.
// Based on reference image, user prompt, and video type tab (product-video, advert, listing).
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;
// Creative director: prefer Gemini 3 Flash (thinking model) for deeper reasoning
const THINKING_MODEL = "gemini-3-flash-preview";
const FALLBACK_MODEL = "gemini-2.5-flash";

const VIDEO_TYPE_GUIDANCE: Record<string, string> = {
  "product-video":
    "Product closeup video: focus on the product, subtle motion, professional lighting, showcase details, gentle rotation or reveal. Ideal for product demos, hero shots, and brand showcases.",
  advert:
    "Ad video / commercial: dynamic, attention-grabbing, lifestyle or aspirational context, strong visual storytelling, suitable for social ads, TV spots, or promotional content.",
  listing:
    "Product listing video: e-commerce focused, 360° or multi-angle view, quick highlights, clear product visibility, optimized for marketplaces and product pages.",
};

export async function POST(request: Request) {
  try {
    if (!INFRAME_API_KEY) {
      return NextResponse.json(
        { error: "Missing INFRAME_API_KEY" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      sourceImageBase64,
      userPrompt,
      videoType = "product-video",
    } = body as {
      sourceImageBase64?: string;
      userPrompt?: string;
      videoType?: "product-video" | "advert" | "listing";
    };

    const base64 = sourceImageBase64
      ? sourceImageBase64.replace(/^data:image\/\w+;base64,/, "")
      : null;

    const typeGuidance =
      VIDEO_TYPE_GUIDANCE[videoType] ||
      VIDEO_TYPE_GUIDANCE["product-video"];

    const systemPrompt = `You are a creative director for video production. Your job is to create an enhanced, detailed prompt that will be sent to Veo (Google's video generation model) to produce the best possible video for the user's needs.

Context:
- Video type: ${videoType}
- Type-specific guidance: ${typeGuidance}

CRITICAL: The video uses a reference image to guide the subject's appearance. The video must START WITH MOTION from frame 1 — no static hold, no transition from a frozen image. The motion should be continuous and begin immediately.

Based on the reference image (if provided) and the user's prompt, create a single enhanced prompt that:
1. Describes the exact motion, camera movement, and visual style Veo should create — motion begins immediately
2. Aligns with the video type (product closeup, ad, or listing)
3. Incorporates the user's intent while adding professional video direction
4. Explicitly directs that the shot opens with movement already in progress (e.g. "The camera pans as the product rotates...", "Opening with a dynamic reveal...")
5. Is concise but specific (2-4 sentences max) — Veo works best with clear, actionable prompts

Return ONLY the enhanced prompt text, nothing else. No quotes, no preamble.`;

    const userContent = base64
      ? `Reference image is attached. User's prompt: "${userPrompt || "Animate this image naturally."}"`
      : `User's prompt: "${userPrompt || "Animate this image naturally."}"`;

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [{ text: `${systemPrompt}\n\n${userContent}` }];

    if (base64) {
      parts.push({
        inlineData: { mimeType: "image/png", data: base64 },
      });
    }

    const basePayload = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
        responseMimeType: "text/plain",
      },
    };

    const thinkingPayload = {
      ...basePayload,
      generationConfig: {
        ...basePayload.generationConfig,
        thinkingConfig: { thinkingLevel: "high" as const },
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${THINKING_MODEL}:generateContent?key=${INFRAME_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(thinkingPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Creative director API error:", res.status, errText);
      // Fallback: try without thinking config (2.5 Flash)
      const fallbackRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent?key=${INFRAME_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basePayload),
        }
      );
      if (!fallbackRes.ok) {
        return NextResponse.json(
          {
            error: "Failed to enhance prompt",
            details: await fallbackRes.text(),
          },
          { status: 502 }
        );
      }
      const fallbackData = await fallbackRes.json();
      const enhanced =
        fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        userPrompt;
      return NextResponse.json({ enhancedPrompt: enhanced });
    }

    const data = await res.json();
    const enhanced =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || userPrompt;

    return NextResponse.json({ enhancedPrompt: enhanced });
  } catch (error: unknown) {
    console.error("enhance-video-prompt error:", error);
    const msg =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
