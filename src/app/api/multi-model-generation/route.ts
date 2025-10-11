// app/api/multi-model-generation/route.ts
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY as string | undefined;
const HUGGING_FACE_KEY = process.env.HUGGING_FACE_ACCESS_TOKEN;
const STABILITYAI_API_KEY = process.env.STABILITYAI_API_KEY;

if (!INFRAME_API_KEY) {
  throw new Error("Missing INFRAME_API_KEY environment variable.");
}

/**
 * Helper: generate image via Google Generative Language API (Gemini)
 */
async function generateWithGemini(prompt: string, apiKey: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

  const extractImageUrl = (data: any): string | null => {
    return (
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
      data?.choices?.[0]?.message?.images?.[0]?.url ||
      data?.choices?.[0]?.message?.image_url?.url ||
      data?.imageUrl ||
      null
    );
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Retry on 429 or 5xx
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, attempt * 500));
          continue;
        }
        return null;
      }

      const data = await res.json().catch(() => null);
      const partsOut: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      let base64Data: string | null = null;
      let mime: string | null = null;
      for (const p of partsOut) {
        const d1 = p?.inline_data?.data as string | undefined;
        const d2 = p?.inlineData?.data as string | undefined;
        if (d1 || d2) {
          base64Data = d1 || d2 || null;
          mime = (p?.inline_data?.mime_type as string | undefined) || (p?.inlineData?.mimeType as string | undefined) || "image/png";
          break;
        }
      }
      const imageUrl = base64Data ? `data:${mime};base64,${base64Data}` : null;
      if (imageUrl) return imageUrl;
      // If missing image, retry
      await new Promise((r) => setTimeout(r, attempt * 500));
    } catch (err) {
      // network / timeout - retry
      await new Promise((r) => setTimeout(r, attempt * 500));
    }
  }

  return null;
}

/**
 * Helper: generate image via Hugging Face (returns base64 data URL)
 */
async function generateWithHuggingFace(prompt: string, apiKey?: string): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!res.ok) {
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    // Use Buffer to create base64 in Node environment
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.error("Hugging Face generation error:", err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { direction, basePrompt } = body as {
      direction?: { id: string; name: string; compositionRules?: string; moodKeywords?: string[] };
      basePrompt?: string;
    };

    if (!direction || !direction.id) {
      return NextResponse.json({ success: false, error: "Missing direction" }, { status: 400 });
    }

    if (!basePrompt || typeof basePrompt !== "string") {
      return NextResponse.json({ success: false, error: "Missing basePrompt" }, { status: 400 });
    }

    const HF_KEY = HUGGING_FACE_KEY; // may be undefined

    const fullPrompt = `${basePrompt}

Style direction: ${direction.name}
Composition: ${direction.compositionRules ?? ""}
Mood: ${(direction.moodKeywords || []).join(", ")}

Create a high-quality, professional image following these guidelines precisely.`;

    // Stability AI - Stable Diffusion 3.5 Flash helper (sd3.5-large-turbo)
    const generateWithStability = async (prompt: string, apiKey?: string): Promise<string | null> => {
      if (!apiKey) return null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const form = new FormData();
          form.append("model", "sd3.5-flash");
          form.append("prompt", prompt);
          form.append("output_format", "png");
          form.append("mode", "text-to-image");

          const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "application/json",
            },
            body: form,
          });
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            console.error("Stability API error:", res.status, txt);
            if (res.status >= 500 || res.status === 429) {
              await new Promise(r => setTimeout(r, attempt * 600));
              continue;
            }
            return null;
          }

          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json().catch(() => null);
            const b64 = (data?.image as string | undefined) || (data?.artifacts?.[0]?.base64 as string | undefined);
            return b64 ? `data:image/png;base64,${b64}` : null;
          }

          const arrayBuffer = await res.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          return `data:image/png;base64,${base64}`;
        } catch (e) {
          await new Promise(r => setTimeout(r, attempt * 600));
        }
      }
      return null;
    };

    // Launch parallel generation calls (Gemini x2 + Stability + optional HF)
    const promises = [
      generateWithGemini(fullPrompt, INFRAME_API_KEY!),
      generateWithStability(fullPrompt, STABILITYAI_API_KEY),
    ];

    const settled = await Promise.allSettled(promises);

    const variants: Array<{ model: string; imageUrl: string }> = [];

    settled.forEach((res, idx) => {
      if (res.status === "fulfilled" && res.value) {
        // Map index -> model name
        const model = idx === 0 ? "gemini" : "stability";
        variants.push({ model, imageUrl: res.value });
      }
    });

    return NextResponse.json({
      success: true,
      directionId: direction.id,
      variants,
    });
  } catch (err: any) {
    console.error("Error in /api/multi-model-generation:", err);
    return NextResponse.json({ success: false, error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
