const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export type VeoReferenceImage = {
  bytesBase64Encoded: string;
  mimeType: string;
};

export async function generateVideoWithVeo(options: {
  prompt: string;
  durationSeconds?: number;
  referenceImages?: VeoReferenceImage[];
}): Promise<{ videoBase64: string; mimeType: string }> {
  const { prompt, durationSeconds = 8, referenceImages } = options;
  const boundedDurationSeconds = Math.max(
    4,
    Math.min(8, Math.round(durationSeconds))
  );

  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.INFRAME_API_KEY ?? "";
  const model =
    process.env.GEMINI_VIDEO_MODEL ?? "veo-3.1-generate-preview";

  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY or INFRAME_API_KEY must be set.");
  }

  const generationRequest = {
    instances: [
      {
        prompt,
        referenceImages:
          referenceImages && referenceImages.length > 0
            ? referenceImages.map((img) => ({
                image: {
                  bytesBase64Encoded: img.bytesBase64Encoded,
                  mimeType: img.mimeType,
                },
                referenceType: "asset",
              }))
            : undefined,
      },
    ],
    parameters: {
      aspectRatio: "16:9",
      durationSeconds: boundedDurationSeconds,
      sampleCount: 1,
    },
  };

  const operationResponse = await fetch(
    `${GEMINI_BASE_URL}/models/${model}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify(generationRequest),
    }
  );

  if (!operationResponse.ok) {
    const errorText = await operationResponse.text();
    throw new Error(
      `Failed to start Veo generation. ${errorText}`.trim()
    );
  }

  const operation = (await operationResponse.json()) as { name?: string };
  if (!operation.name) {
    throw new Error("Missing operation name from Veo.");
  }

  type OperationStatusPayload = {
    done?: boolean;
    error?: unknown;
    response?: {
      generateVideoResponse?: {
        generatedSamples?: Array<{
          video?: {
            mimeType?: string;
            bytesBase64Encoded?: string;
            uri?: string;
          };
        }>;
      };
    };
  };

  let statusPayload: OperationStatusPayload | null = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const statusResponse = await fetch(
      `${GEMINI_BASE_URL}/${operation.name}`,
      {
        headers: { "x-goog-api-key": geminiKey },
      }
    );

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(
        `Failed to fetch Veo operation status. ${errorText}`.trim()
      );
    }

    statusPayload = (await statusResponse.json()) as OperationStatusPayload;
    if (statusPayload?.error) {
      throw new Error(
        `Veo generation failed. ${JSON.stringify(
          statusPayload.error
        )}`.trim()
      );
    }
    if (statusPayload?.done) break;
    await sleep(5000);
  }

  if (!statusPayload?.done || !statusPayload?.response) {
    throw new Error("Veo generation timed out.");
  }

  const video =
    statusPayload.response.generateVideoResponse?.generatedSamples?.[0]?.video;
  const mimeType = video?.mimeType ?? "video/mp4";

  let videoBase64 = video?.bytesBase64Encoded;
  if (!videoBase64 && video?.uri) {
    const videoResponse = await fetch(video.uri, {
      headers: { "x-goog-api-key": geminiKey },
    });

    if (!videoResponse.ok) {
      throw new Error("Failed to download generated video.");
    }

    const buffer = Buffer.from(await videoResponse.arrayBuffer());
    videoBase64 = buffer.toString("base64");
  }

  if (!videoBase64) {
    throw new Error("No video returned from Veo.");
  }

  return { videoBase64, mimeType };
}
