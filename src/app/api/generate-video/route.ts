// app/api/generate-video/route.ts
// Veo 3.1 image-to-video via Gemini REST API (predictLongRunning)
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const VIDEO_MODEL = "veo-3.1-generate-preview";

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
      sourceImageUrl,
      sourceImageBase64,
      prompt,
      videoType,
      aspectRatio = "16:9",
    } = body as {
      sourceImageUrl?: string;
      sourceImageBase64?: string;
      prompt?: string;
      videoType?: "product-video" | "advert" | "listing";
      aspectRatio?: "16:9" | "9:16";
    };

    if (!sourceImageUrl && !sourceImageBase64) {
      return NextResponse.json(
        { error: "Either sourceImageUrl or sourceImageBase64 is required" },
        { status: 400 }
      );
    }

    const base64 = sourceImageBase64
      ? sourceImageBase64.replace(/^data:image\/\w+;base64,/, "")
      : null;

    const videoTypeContext: Record<string, string> = {
      "product-video":
        "Product closeup video: professional, subtle motion, showcase product details.",
      advert:
        "Ad/commercial video: dynamic, attention-grabbing, suitable for ads and promotions.",
      listing:
        "Product listing video: e-commerce focused, clear product visibility, marketplace-ready.",
    };
    const typeHint =
      videoType && videoTypeContext[videoType]
        ? videoTypeContext[videoType]
        : "Product videos, ads, and marketing content.";
    const systemContext = `You are an ad director. Video type: ${typeHint}. Follow the user's exact request precisely.`;
    const userRequest = prompt?.trim() || "Animate this image naturally for product or ad use.";
    const textPrompt = `${systemContext}\n\n${userRequest}`;

    const imagePart = base64
      ? { bytesBase64Encoded: base64, mimeType: "image/png" }
      : sourceImageUrl
        ? { fileUri: sourceImageUrl, mimeType: "image/png" }
        : null;

    // Use referenceImages (asset) instead of image to avoid static first frame.
    // Reference images guide subject appearance; video starts with motion from frame 1.
    // Using "image" would make the source the first frame, causing image→video transition.
    const instances = imagePart
      ? [
          {
            prompt: textPrompt,
            referenceImages: [
              {
                image: imagePart,
                referenceType: "asset",
              },
            ],
          },
        ]
      : [{ prompt: textPrompt }];

    const negativePrompt =
      "static first frame, frozen image, image hold, still image at start, no motion at beginning";
    const parameters = { aspectRatio, negativePrompt };

    let res = await fetch(
      `${BASE_URL}/models/${VIDEO_MODEL}:predictLongRunning?key=${INFRAME_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instances, parameters }),
      }
    );

    // Fallback: if referenceImages is not supported (e.g. Gemini API vs Vertex),
    // use image but prepend motion-from-start instruction to reduce static hold
    if (!res.ok && imagePart) {
      const errText = await res.text();
      const isParamError =
        res.status === 400 ||
        /referenceImages|referenceType|invalid.*instance/i.test(errText);
      if (isParamError) {
        const motionPrompt = `Motion begins immediately from frame 1. No static hold. ${textPrompt}`;
        res = await fetch(
          `${BASE_URL}/models/${VIDEO_MODEL}:predictLongRunning?key=${INFRAME_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instances: [{ prompt: motionPrompt, image: imagePart }],
              parameters: { aspectRatio, negativePrompt },
            }),
          }
        );
      } else {
        console.error("Veo 3.1 API error:", errText);
        return NextResponse.json(
          { error: "Video generation failed", details: errText, status: "failed" },
          { status: 502 }
        );
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("Veo 3.1 API error:", errText);
      return NextResponse.json(
        { error: "Video generation failed", details: errText, status: "failed" },
        { status: 502 }
      );
    }

    const result = await res.json();

    if (result.name) {
      return NextResponse.json({
        status: "processing",
        operationName: result.name,
        message: "Video is being generated. Poll the operation status endpoint.",
      });
    }

    return NextResponse.json({
      status: "completed",
      result,
    });
  } catch (error: unknown) {
    console.error("generate-video error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: msg, status: "failed" },
      { status: 500 }
    );
  }
}

// GET: poll video generation status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const operationName = searchParams.get("operation");

  if (!operationName) {
    return NextResponse.json({ error: "operation parameter required" }, { status: 400 });
  }

  if (!INFRAME_API_KEY) {
    return NextResponse.json({ error: "Missing INFRAME_API_KEY" }, { status: 500 });
  }

  try {
    const statusResponse = await fetch(
      `${BASE_URL}/${operationName}?key=${INFRAME_API_KEY}`,
      { method: "GET", headers: { "Content-Type": "application/json" } }
    );

    if (!statusResponse.ok) {
      const errText = await statusResponse.text();
      return NextResponse.json(
        { error: "Failed to check status", details: errText },
        { status: 502 }
      );
    }

    const statusResult = await statusResponse.json();

    if (statusResult.done) {
      const resp = statusResult.response;
      const videoUri =
        resp?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
        resp?.predictions?.[0]?.videoUri ||
        resp?.predictions?.[0]?.video?.uri;

      if (!videoUri) {
        return NextResponse.json({
          status: "completed",
          videoUrl: null,
          error: "Video completed but no URI returned",
          result: resp,
        });
      }

      const proxyUrl = `/api/video-proxy?uri=${encodeURIComponent(videoUri)}`;
      return NextResponse.json({
        status: "completed",
        videoUrl: proxyUrl,
      });
    }

    return NextResponse.json({
      status: "processing",
      progress: statusResult.metadata?.progress ?? 0,
      message: "Video is still being generated...",
    });
  } catch (error: unknown) {
    console.error("video status check error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
