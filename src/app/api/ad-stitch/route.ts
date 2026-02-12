// app/api/ad-stitch/route.ts
// Composes multiple images/clips into a cohesive video ad using Gemini Veo
import { NextResponse } from "next/server";

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;
const VIDEO_MODEL = "veo-2.0-generate-001";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      prompt,
      images,
      videos,
      duration,
    } = body as {
      prompt?: string;
      images?: string[];
      videos?: string[];
      duration?: number;
    };

    const imageList = images || [];
    const firstImage = imageList[0];
    if (!firstImage && (!videos || videos.length === 0)) {
      return NextResponse.json(
        { error: "At least one image or video is required" },
        { status: 400 }
      );
    }

    const textPrompt =
      prompt ||
      "Create a cohesive, professional video ad. Use smooth transitions and compelling motion.";

    const base64 = firstImage
      ? (firstImage.includes(",") ? firstImage.split(",")[1] : firstImage)
      : null;

    if (!base64) {
      return NextResponse.json(
        { error: "Could not extract image data" },
        { status: 400 }
      );
    }

    const imagePart = {
      inlineData: {
        mimeType: "image/png",
        data: base64.replace(/^data:image\/\w+;base64,/, ""),
      },
    };

    const enhancedPrompt =
      imageList.length > 1 || (videos && videos.length > 0)
        ? `${textPrompt} Compose these ${imageList.length + (videos?.length || 0)} assets into a cohesive video ad with smooth transitions.`
        : textPrompt;

    const generateResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${VIDEO_MODEL}:predictLongRunning?key=${INFRAME_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: enhancedPrompt, image: imagePart }],
          parameters: {
            sampleCount: 1,
            durationSeconds: duration || 4,
            aspectRatio: "16:9",
          },
        }),
      }
    );

    if (!generateResponse.ok) {
      const fallbackResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${INFRAME_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: `Generate a short video ad. ${enhancedPrompt}` },
                  imagePart,
                ],
              },
            ],
            generationConfig: { responseModalities: ["VIDEO"] },
          }),
        }
      );

      if (!fallbackResponse.ok) {
        const errText = await fallbackResponse.text();
        return NextResponse.json(
          { error: "Ad stitch failed", details: errText },
          { status: 502 }
        );
      }

      const fallbackResult = await fallbackResponse.json();
      const videoPart = fallbackResult.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData?.mimeType?.startsWith("video/")
      );

      if (videoPart?.inlineData) {
        return NextResponse.json({
          status: "completed",
          videoBase64: videoPart.inlineData.data,
          mimeType: videoPart.inlineData.mimeType,
        });
      }

      return NextResponse.json({
        status: "pending",
        message: "Video ad generation requires Gemini Veo access.",
        raw: fallbackResult,
      });
    }

    const generateResult = await generateResponse.json();

    if (generateResult.name) {
      return NextResponse.json({
        status: "processing",
        operationName: generateResult.name,
        message: "Video ad is being generated. Poll the operation status.",
      });
    }

    return NextResponse.json({
      status: "completed",
      result: generateResult,
    });
  } catch (error: any) {
    console.error("ad-stitch error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
