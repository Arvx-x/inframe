// app/api/generate-image/route.ts
import { NextResponse } from "next/server";
import { generateImageWithGemini } from "@/lib/imagen";

const GENERATION_VARIATIONS = 4;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY ?? process.env.INFRAME_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY or INFRAME_API_KEY must be set.");
  }
  return key;
}

function extractImageFromResponse(data: any): string | null {
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
  return base64Data ? `data:${mime};base64,${base64Data}` : null;
}

async function callGeminiImageApi(parts: any[]): Promise<string | null> {
  const apiKey = getApiKey();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Gemini image API error:", res.status, text);
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, attempt * 600));
          continue;
        }
        return null;
      }

      const data = await res.json().catch(() => null);
      return extractImageFromResponse(data);
    } catch (e) {
      await new Promise((r) => setTimeout(r, attempt * 600));
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { prompt, currentImageUrl, isEdit, selection, selectionImageUrl, editIntent, textEditOptions, referenceImageUrl, referenceMode, briefContext } = body as {
      prompt?: string;
      currentImageUrl?: string;
      isEdit?: boolean;
      selection?: any;
      selectionImageUrl?: string | null;
      editIntent?: string | null;
      textEditOptions?: {
        allowFontChange?: boolean;
        allowSizeChange?: boolean;
        allowPositionChange?: boolean;
      } | null;
      referenceImageUrl?: string | null;
      referenceMode?: "branding" | "inspiration";
      briefContext?: string | null;
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const isGenerationMode = !isEdit || !currentImageUrl;

    // Build parts only for edit mode
    const parts: any[] = [];

    if (isEdit && currentImageUrl) {
      parts.push({ text: prompt });
      if (selection) {
        parts.push({ text: `Selection JSON: ${JSON.stringify(selection)}` });
        parts.push({
          text:
            "Guardrail: Focus the edit on the region identified by the selection rectangle. You may extend or add new content outside that region when it is necessary for a coherent result, but avoid unrelated global changes elsewhere in the image.",
        });
        parts.push({
          text:
            "The returned edit will be reinserted by sampling the rectangle (x,y,width,height) from your output and pasting it back onto the original base image at the same coordinates. Keep the edited content perfectly registered with the original pixels so that the patch lines up exactly—no global shifts, scaling, or perspective changes.",
        });
      }
      if (editIntent === "text") {
        const allowFontChange = Boolean(textEditOptions?.allowFontChange);
        const allowSizeChange = Boolean(textEditOptions?.allowSizeChange);
        const allowPositionChange = Boolean(textEditOptions?.allowPositionChange);
        const textGuardrails: string[] = [];
        textGuardrails.push(
          "Text edit request: rewrite or update the text inside the selection with the instructions in the prompt while keeping edges sharp, legible, and free of artifacts."
        );
        if (!allowFontChange) {
          textGuardrails.push(
            "Preserve the original typeface, weight, kerning, and overall typography unless the prompt explicitly requests a change."
          );
        } else {
          textGuardrails.push(
            "You may change the font or weight to satisfy the prompt, but maintain a professional, high-quality typographic result with smooth anti-aliasing."
          );
        }
        if (!allowSizeChange) {
          textGuardrails.push(
            "Keep the text size and baseline positioning exactly aligned with the original so the text sits naturally in the design."
          );
        } else {
          textGuardrails.push(
            "Adjust text size only as needed by the prompt, ensuring the new scale is harmonious with surrounding layout."
          );
        }
        if (!allowPositionChange) {
          textGuardrails.push(
            "Do not move the text bounding box; keep alignment, perspective, and positioning identical to the original."
          );
        } else {
          textGuardrails.push(
            "You may reposition the text per the prompt, but respect the scene perspective and ensure alignment remains natural."
          );
        }
        textGuardrails.push(
          "Match lighting, shading, and depth cues of the surrounding scene so the updated text blends seamlessly."
        );
        parts.push({ text: textGuardrails.join(" ") });
      }
      const base64 = currentImageUrl.split(",")[1] || currentImageUrl;
      parts.push({ inline_data: { mime_type: "image/png", data: base64 } });
      if (selectionImageUrl && typeof selectionImageUrl === "string") {
        const selBase64 = selectionImageUrl.split(",")[1] || selectionImageUrl;
        parts.push({ inline_data: { mime_type: "image/png", data: selBase64 } });
      }
      parts.push({
        text:
          "Return the edited image at exactly the same resolution as the base image so the selected patch can be reapplied without scaling artifacts.",
      });
    }

    if (isGenerationMode) {
      // Use imagen lib (same as videogen): 4 variations in parallel via generateImageWithGemini
      const referencePayload =
        referenceImageUrl && typeof referenceImageUrl === "string"
          ? {
              bytesBase64Encoded: referenceImageUrl.split(",")[1] || referenceImageUrl,
              mimeType: referenceImageUrl.includes("image/jpeg")
                ? "image/jpeg"
                : referenceImageUrl.includes("image/png")
                  ? "image/png"
                  : referenceImageUrl.includes("image/webp")
                    ? "image/webp"
                    : "image/png",
            }
          : undefined;

      const results = await Promise.all(
        Array.from({ length: GENERATION_VARIATIONS }, () =>
          generateImageWithGemini({
            prompt,
            referenceImage: referencePayload,
            referenceMode: referenceMode ?? "branding",
            briefContext: briefContext?.trim() || undefined,
            nanoBananaOnly: true,
          })
        )
      );

      const imageUrls = results.map(
        (r) => `data:${r.mimeType};base64,${r.imageBase64}`
      );

      if (imageUrls.length === 0) {
        return NextResponse.json({ error: "No images generated", raw: null }, { status: 502 });
      }

      return NextResponse.json({
        imageUrl: imageUrls[0],
        imageUrls,
      });
    }

    // Edit mode: single image
    const imageUrl = await callGeminiImageApi(parts);
    if (!imageUrl) {
      return NextResponse.json({ error: "No image generated" }, { status: 502 });
    }
    return NextResponse.json({ imageUrl, imageUrls: [imageUrl] });
  } catch (err: any) {
    console.error("Error in /api/generate-image:", err);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
