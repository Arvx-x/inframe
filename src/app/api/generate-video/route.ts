// app/api/generate-video/route.ts
// Uses Gemini Veo 3.1 (image-to-video) to generate short video clips from design images
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Veo 3.1 model for image-to-video generation
const VIDEO_MODEL = "veo-3.1-generate-preview";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      sourceImageUrl,
      sourceImageBase64,
      prompt,
      duration,
    } = body as {
      sourceImageUrl?: string;
      sourceImageBase64?: string;
      prompt?: string;
      duration?: number;
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

    // Veo 3.1 uses bytesBase64Encoded / fileUri directly — NOT inlineData
    const imagePart: any = base64
      ? {
          bytesBase64Encoded: base64,
          mimeType: "image/png",
        }
      : sourceImageUrl
        ? { fileUri: sourceImageUrl, mimeType: "image/png" }
        : null;

    const textPrompt =
      prompt ||
      "Create a smooth, cinematic motion from this still image. Add subtle zoom and parallax effects.";

    const instances: any[] = imagePart
      ? [{ prompt: textPrompt, image: imagePart }]
      : [{ prompt: textPrompt }];

    const parameters: Record<string, unknown> = {
      aspectRatio: "16:9",
    };

    const generateResponse = await fetch(
      `${BASE_URL}/models/${VIDEO_MODEL}:predictLongRunning?key=${INFRAME_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instances, parameters }),
      }
    );

    if (!generateResponse.ok) {
      const errText = await generateResponse.text();
      console.error("Veo 3.1 API error:", errText);
      return NextResponse.json(
        { error: "Video generation failed", details: errText, status: "failed" },
        { status: 502 }
      );
    }

    const generateResult = await generateResponse.json();

    if (generateResult.name) {
      return NextResponse.json({
        status: "processing",
        operationName: generateResult.name,
        message: "Video is being generated. Poll the operation status endpoint.",
      });
    }

    return NextResponse.json({
      status: "completed",
      result: generateResult,
    });
  } catch (error: any) {
    console.error("generate-video error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error", status: "failed" },
      { status: 500 }
    );
  }
}

// GET endpoint to poll video generation status (Veo 3.1)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const operationName = searchParams.get("operation");

  if (!operationName) {
    return NextResponse.json({ error: "operation parameter required" }, { status: 400 });
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

      // Return a proxy URL that the client can use directly as a <video> src.
      // The proxy endpoint streams the video from Google (with API key) to the client.
      const proxyUrl = `/api/video-proxy?uri=${encodeURIComponent(videoUri)}`;

      return NextResponse.json({
        status: "completed",
        videoUrl: proxyUrl,
      });
    }

    return NextResponse.json({
      status: "processing",
      progress: statusResult.metadata?.progress || 0,
      message: "Video is still being generated...",
    });
  } catch (error: any) {
    console.error("video status check error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
