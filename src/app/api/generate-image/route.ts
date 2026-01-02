// app/api/generate-image/route.ts
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

if (!INFRAME_API_KEY) {
  throw new Error("Missing INFRAME_API_KEY environment variable.");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { prompt, currentImageUrl, isEdit, selection, selectionImageUrl, editIntent, textEditOptions, referenceImageUrl } = body as {
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
    };

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Build messages payload similar to your Deno function
    let messages: any[] = [];

    if (isEdit && currentImageUrl) {
      messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...(selection ? [{ type: "text", text: `Selection JSON: ${JSON.stringify(selection)}` }] : []),
            {
              type: "image_url",
              image_url: {
                url: currentImageUrl,
              },
            },
          ],
        },
      ];
    } else {
      messages = [
        {
          role: "user",
          content: `Create a high-quality, detailed image: ${prompt}`,
        },
      ];
    }

    // Call Google Generative Language API directly for image generation
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${INFRAME_API_KEY}`;

    // Build parts for request
    const parts: any[] = [];
    
    // If a reference image is provided, include it first with analysis instructions
    if (referenceImageUrl && typeof referenceImageUrl === "string" && !isEdit) {
      parts.push({
        text: "DESIGN REFERENCE IMAGE ANALYSIS: Carefully analyze the following reference image for its design elements including: color palette and color harmony, typography style and font choices, layout and composition, visual style (minimalist, bold, vintage, modern, etc.), mood and atmosphere, textures and patterns, spacing and proportions. Use these design elements as inspiration and guidance for the image you will create.",
      });
      const refBase64 = referenceImageUrl.split(",")[1] || referenceImageUrl;
      const refMime = referenceImageUrl.includes("image/jpeg") ? "image/jpeg" : 
                      referenceImageUrl.includes("image/png") ? "image/png" :
                      referenceImageUrl.includes("image/webp") ? "image/webp" : "image/png";
      parts.push({ inline_data: { mime_type: refMime, data: refBase64 } });
      parts.push({
        text: `Now, using the design elements, style, color palette, and visual aesthetic from the reference image above, create a new image based on this prompt: ${prompt}. The new image should feel cohesive with the reference in terms of visual style while being a unique creation based on the prompt.`,
      });
    } else if (isEdit && currentImageUrl) {
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
      // Expect data URL like data:image/png;base64,XXXX
      const base64 = currentImageUrl.split(",")[1] || currentImageUrl;
      parts.push({ inline_data: { mime_type: "image/png", data: base64 } });
      // If a cropped selection image is provided, include it as well
      if (selectionImageUrl && typeof selectionImageUrl === "string") {
        const selBase64 = selectionImageUrl.split(",")[1] || selectionImageUrl;
        parts.push({ inline_data: { mime_type: "image/png", data: selBase64 } });
      }
      parts.push({
        text:
          "Return the edited image at exactly the same resolution as the base image so the selected patch can be reapplied without scaling artifacts.",
      });
    } else {
      parts.push({ text: `Create a high-quality, detailed image: ${prompt}` });
    }

    let res: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts,
              },
            ],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) break;

        const text = await res.text().catch(() => "");
        console.error("Gemini image API error:", res.status, text);
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, attempt * 600));
          continue;
        }
        // Non-retryable
        return NextResponse.json({ error: "Failed to generate image", details: text }, { status: 502 });
      } catch (e) {
        // network/timeout
        await new Promise((r) => setTimeout(r, attempt * 600));
      }
    }

    if (!res || !res.ok) {
      return NextResponse.json({ error: "Failed to generate image after retries" }, { status: 502 });
    }

    const data = await res.json().catch((e) => {
      console.error("Failed to parse Google response JSON:", e);
      return null;
    });

    // Try to extract base64 image supporting both inline_data and inlineData shapes
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

    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data));
      return NextResponse.json({ error: "No image generated", raw: data }, { status: 502 });
    }

    return NextResponse.json({ imageUrl });
  } catch (err: any) {
    console.error("Error in /api/generate-image:", err);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
