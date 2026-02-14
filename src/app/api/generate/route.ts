import { NextResponse } from "next/server";
import { generateVideoWithVeo } from "@/lib/veo";

const toBase64 = async (file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const userPrompt = String(formData.get("prompt") ?? "").trim();
  const briefContext = String(formData.get("briefContext") ?? "").trim();
  const referenceImages = formData
    .getAll("referenceImages")
    .filter((item): item is File => item instanceof File);

  if (!userPrompt) {
    return NextResponse.json(
      { error: "Prompt is required." },
      { status: 400 }
    );
  }

  const prompt = briefContext
    ? `[Campaign/product context: ${briefContext}]\n\n${userPrompt}`
    : userPrompt;

  try {
    const referencePayload =
      referenceImages.length > 0
        ? await Promise.all(
            referenceImages.slice(0, 3).map(async (file) => ({
              bytesBase64Encoded: await toBase64(file),
              mimeType: file.type || "image/png",
            }))
          )
        : undefined;

    const { videoBase64, mimeType } = await generateVideoWithVeo({
      prompt,
      durationSeconds: 8,
      referenceImages: referencePayload,
    });

    return NextResponse.json({
      videoBase64,
      mimeType,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error generating video.";
    return NextResponse.json(
      { error: "Generation failed.", details: message },
      { status: 502 }
    );
  }
}
