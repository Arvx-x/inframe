import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      image,
      mode = "quick",
      mask,
      context
    }: {
      image?: string;
      mode?: "quick" | "select";
      mask?: string | null;
      context?: string;
    } = body;

    if (!image) {
      return NextResponse.json({ success: false, error: "Image is required" }, { status: 400 });
    }

    if (!INFRAME_API_KEY) {
      return NextResponse.json({ success: false, error: "API key not configured" }, { status: 500 });
    }

    const baseImage = image.includes(",") ? image.split(",")[1] : image;
    const userInstruction = [
      "Remove the background from the provided image while keeping the subject perfectly intact.",
      "Return a high-resolution PNG with transparent background (preserve alpha channel).",
      "Match the original resolution exactly and keep edges crisp, free of halos.",
      mode === "select"
        ? "Only keep the regions highlighted by the mask image. Treat the mask as the foreground to preserve."
        : "Automatically keep the most salient subject (people, products, logos) and remove everything else."
    ]
      .filter(Boolean)
      .join(" ");

    const parts: any[] = [
      { text: `${userInstruction} ${context ?? ""}`.trim() },
      {
        inline_data: {
          mime_type: "image/png",
          data: baseImage
        }
      }
    ];

    if (mode === "select" && mask) {
      const maskData = mask.includes(",") ? mask.split(",")[1] : mask;
      parts.push({
        text: "A mask image is attached where painted pixels represent the content to KEEP. Remove everything else."
      });
      parts.push({
        inline_data: {
          mime_type: "image/png",
          data: maskData
        }
      });
    }

    let response: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${INFRAME_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
              ]
            }),
            signal: controller.signal
          }
        );

        clearTimeout(timeout);

        if (response.ok) break;

        const text = await response.text().catch(() => "");
        console.error(`Remove background API error (attempt ${attempt}):`, response.status, text);
        if (response.status === 429 || response.status >= 500) {
          await new Promise((r) => setTimeout(r, attempt * 800));
          continue;
        }
        return NextResponse.json({ success: false, error: text || "Gemini API error" }, { status: response.status });
      } catch (error) {
        console.error("Remove background request error:", error);
        if (attempt === 3) {
          return NextResponse.json({ success: false, error: "Failed to contact Gemini API" }, { status: 502 });
        }
        await new Promise((r) => setTimeout(r, attempt * 800));
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json({ success: false, error: "Image editing failed after retries" }, { status: 502 });
    }

    const data = await response.json().catch((err) => {
      console.error("Failed to parse remove background response:", err);
      return null;
    });

    if (!data) {
      return NextResponse.json({ success: false, error: "Invalid response from Gemini" }, { status: 502 });
    }

    const partsOut: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    let base64Data: string | null = null;
    let mime: string | null = null;
    for (const p of partsOut) {
      const inline = p?.inline_data || p?.inlineData;
      if (inline?.data) {
        base64Data = inline.data;
        mime = inline.mime_type || inline.mimeType || "image/png";
        break;
      }
    }

    if (!base64Data) {
      return NextResponse.json({ success: false, error: "No image returned", raw: data }, { status: 502 });
    }

    const imageUrl = `data:${mime};base64,${base64Data}`;
    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Remove background route error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

